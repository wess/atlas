//! The two state contracts.
//!
//! [`AppState`] lives for the whole app and is provided as context by `Root`.
//! [`WorkspaceState`] lives only while a project is open and is provided by
//! the workspace view — which is the point: everything scoped to one open
//! project is dropped when it closes, so nothing can leak into the next one.

use std::sync::Arc;

use atlas::prelude::*;
use guise::prelude::*;
use host::Host;
use model::{Entry, Project, Settings};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Route {
    Home,
    /// The id of the open project.
    Workspace(String),
}

#[derive(Clone)]
pub struct AppState {
    pub host: Arc<Host>,
    pub route: Signal<Route>,
    pub settings: Signal<Settings>,
    pub projects: Signal<Load<Vec<Project>>>,
    pub search: Signal<String>,
    pub settings_open: Signal<bool>,
    pub about_open: Signal<bool>,
    pub toasts: Toasts,
}

impl AppState {
    pub fn get(cx: &gpui::App) -> AppState {
        use_context::<AppState>(cx).expect("AppState provided by Root")
    }

    pub fn new(host: Arc<Host>, cx: &mut gpui::App) -> Self {
        let settings = host.settings();
        AppState {
            route: Signal::new(cx, Route::Home),
            settings: Signal::new(cx, settings),
            projects: Signal::new(cx, Load::Loading),
            search: Signal::new(cx, String::new()),
            settings_open: Signal::new(cx, false),
            about_open: Signal::new(cx, false),
            toasts: Toasts::new(cx),
            host,
        }
    }

    pub fn reload(&self, cx: &mut gpui::App) {
        let host = Arc::clone(&self.host);
        let projects = self.projects.clone();
        projects.set(cx, Load::Loading);
        bridge::run(cx, async move { host.projects().await }, move |result, cx| {
            projects.set(cx, result.into());
        });
    }

    /// Replace the list with what a mutation returned, or toast the failure.
    pub fn apply(&self, cx: &mut gpui::App, what: &str, result: Result<Vec<Project>, String>) {
        match result {
            Ok(all) => self.projects.set(cx, Load::Ready(all)),
            Err(e) => self.toasts.error(cx, what, &e),
        }
    }

    /// Open a project and route into its workspace — but only on success. A
    /// route change that runs ahead of the open is how you get a workspace
    /// rendering a project that failed to load.
    pub fn open(&self, cx: &mut gpui::App, id: String) {
        let host = Arc::clone(&self.host);
        let state = self.clone();
        bridge::run(cx, async move { host.open(id).await }, move |result, cx| match result {
            Ok(project) => state.route.set(cx, Route::Workspace(project.id)),
            Err(e) => state.toasts.error(cx, "Could not open", &e),
        });
    }

    pub fn close(&self, cx: &mut gpui::App) {
        self.host.close();
        self.route.set(cx, Route::Home);
        self.reload(cx);
    }

    pub fn save_settings(&self, cx: &mut gpui::App, settings: Settings) {
        match self.host.save_settings(settings.clone()) {
            Ok(()) => {
                // Re-theme immediately: a preference that needs a restart to
                // take effect reads as a bug.
                let scheme = if settings.dark() { ColorScheme::Dark } else { ColorScheme::Light };
                Scheme::new().build(scheme).init(cx);
                self.settings.set(cx, settings);
            }
            Err(e) => self.toasts.error(cx, "Could not save settings", &e),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tab {
    Contents,
    Details,
}

impl Tab {
    pub fn label(self) -> &'static str {
        match self {
            Tab::Contents => "Contents",
            Tab::Details => "Details",
        }
    }

    pub fn all() -> [Tab; 2] {
        [Tab::Contents, Tab::Details]
    }
}

/// Everything scoped to one open project.
#[derive(Clone)]
pub struct WorkspaceState {
    pub project: Project,
    pub entries: Signal<Load<Vec<Entry>>>,
    pub selected: Signal<Option<String>>,
    pub tab: Signal<Tab>,
}

impl WorkspaceState {
    /// How a view reads the state the workspace provided. Unused while the
    /// sidebar and content pane are free functions taking it directly — it is
    /// here because the first *view* inside the workspace will need it.
    #[allow(dead_code)]
    pub fn get(cx: &gpui::App) -> WorkspaceState {
        use_context::<WorkspaceState>(cx).expect("WorkspaceState provided by the workspace view")
    }

    pub fn new(project: Project, cx: &mut gpui::App) -> Self {
        WorkspaceState {
            project,
            entries: Signal::new(cx, Load::Loading),
            selected: Signal::new(cx, None),
            tab: Signal::new(cx, Tab::Contents),
        }
    }

    pub fn reload(&self, host: Arc<Host>, cx: &mut gpui::App) {
        let entries = self.entries.clone();
        let selected = self.selected.clone();
        entries.set(cx, Load::Loading);
        bridge::run(cx, async move { host.entries().await }, move |result, cx| {
            // A selection that survived a reload can point at something that
            // no longer exists, and the detail pane would render a blank.
            if let Ok(list) = &result {
                let current = selected.get(cx);
                if current.is_some_and(|name| !list.iter().any(|e| e.name == name)) {
                    selected.set(cx, None);
                }
            }
            entries.set(cx, result.into());
        });
    }
}

/// Projects filtered by the home screen's search box.
pub fn filter<'a>(projects: &'a [Project], query: &str) -> Vec<&'a Project> {
    projects.iter().filter(|p| p.matches(query)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_tab_has_a_label() {
        assert_eq!(Tab::all().len(), 2);
        assert_eq!(Tab::Contents.label(), "Contents");
    }

    #[test]
    fn filtering_matches_name_and_path() {
        let projects =
            vec![Project::new("Reports", "/srv/reports"), Project::new("Staging", "/srv/staging")];
        assert_eq!(filter(&projects, "").len(), 2);
        assert_eq!(filter(&projects, "reports").len(), 1);
        assert_eq!(filter(&projects, "/srv").len(), 2);
        assert_eq!(filter(&projects, "zzz").len(), 0);
    }
}
