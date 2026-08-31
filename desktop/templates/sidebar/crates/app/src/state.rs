//! Cross-view state.
//!
//! `AppState` lives for the whole app and is provided as context by `Root`;
//! views read the signals they care about and `watch` them, which is what
//! makes an update anywhere repaint the views that depend on it and only
//! those.

use std::sync::Arc;

use atlas::prelude::*;
use guise::prelude::*;
use host::Host;
use model::{Item, Settings};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Route {
    Dashboard,
    Items,
}

impl Route {
    /// The stable id the nav rail reports back. Not the label — a label is
    /// copy and changing it must not change behavior.
    pub fn id(self) -> &'static str {
        match self {
            Route::Dashboard => "dashboard",
            Route::Items => "items",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Route::Dashboard => "Dashboard",
            Route::Items => "Items",
        }
    }

    pub fn icon(self) -> IconName {
        match self {
            Route::Dashboard => IconName::LayoutDashboard,
            Route::Items => IconName::ListChecks,
        }
    }

    /// Sidebar order.
    pub fn all() -> [Route; 2] {
        [Route::Dashboard, Route::Items]
    }

    pub fn from_id(id: &str) -> Option<Route> {
        Route::all().into_iter().find(|r| r.id() == id)
    }

    pub fn nav() -> Vec<NavItem> {
        Route::all().into_iter().map(|r| NavItem::new(r.id(), r.label(), r.icon())).collect()
    }
}

#[derive(Clone)]
pub struct AppState {
    pub host: Arc<Host>,
    pub route: Signal<Route>,
    pub settings: Signal<Settings>,
    pub items: Signal<Load<Vec<Item>>>,
    pub search: Signal<String>,
    pub collapsed: Signal<bool>,
    /// The two overlays. Signals rather than fields on `Root` so any view can
    /// open them without reaching back up the tree.
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
            route: Signal::new(cx, Route::Dashboard),
            collapsed: Signal::new(cx, settings.sidebar_collapsed),
            settings: Signal::new(cx, settings),
            items: Signal::new(cx, Load::Loading),
            search: Signal::new(cx, String::new()),
            settings_open: Signal::new(cx, false),
            about_open: Signal::new(cx, false),
            toasts: Toasts::new(cx),
            host,
        }
    }

    /// Fetch the list and publish it.
    ///
    /// The three states go into one signal, so a view cannot accidentally
    /// render an error as an empty list — see [`Load`].
    pub fn reload(&self, cx: &mut gpui::App) {
        let host = Arc::clone(&self.host);
        let items = self.items.clone();
        items.set(cx, Load::Loading);
        bridge::run(cx, async move { host.items().await }, move |result, cx| {
            items.set(cx, result.into());
        });
    }

    /// Replace the list with what a mutation returned, or toast the failure.
    ///
    /// Every write goes through here rather than each view deciding for
    /// itself, which is what keeps one failed action from leaving a stale list
    /// on screen with no explanation.
    pub fn apply(&self, cx: &mut gpui::App, what: &str, result: Result<Vec<Item>, String>) {
        match result {
            Ok(all) => self.items.set(cx, Load::Ready(all)),
            Err(e) => self.toasts.error(cx, what, &e),
        }
    }

    pub fn save_settings(&self, cx: &mut gpui::App, settings: Settings) {
        match self.host.save_settings(settings.clone()) {
            Ok(()) => {
                // Re-theme immediately: a preference that needs a restart to
                // take effect reads as a bug.
                let scheme =
                    if settings.dark() { ColorScheme::Dark } else { ColorScheme::Light };
                Scheme::new().build(scheme).init(cx);
                self.settings.set(cx, settings);
            }
            Err(e) => self.toasts.error(cx, "Could not save settings", &e),
        }
    }
}

/// Items filtered by the search box, and by nothing else — a view that also
/// wants them sorted or grouped does that on top.
pub fn filter<'a>(items: &'a [Item], query: &str) -> Vec<&'a Item> {
    items.iter().filter(|i| i.matches(query)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_round_trip_through_their_ids() {
        for route in Route::all() {
            assert_eq!(Route::from_id(route.id()), Some(route));
        }
        assert_eq!(Route::from_id("nope"), None);
    }

    #[test]
    fn the_nav_rail_offers_every_route_once() {
        let nav = Route::nav();
        assert_eq!(nav.len(), Route::all().len());
        assert_eq!(nav[0].id.as_ref(), "dashboard");
    }

    #[test]
    fn filtering_matches_name_and_note() {
        let mut items = vec![Item::new("Deploy"), Item::new("Rotate keys")];
        items[1].note = "quarterly".into();
        assert_eq!(filter(&items, "").len(), 2);
        assert_eq!(filter(&items, "deploy").len(), 1);
        assert_eq!(filter(&items, "quarterly").len(), 1);
        assert_eq!(filter(&items, "zzz").len(), 0);
    }
}
