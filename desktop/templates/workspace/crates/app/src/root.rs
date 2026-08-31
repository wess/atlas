//! The UI tree. `Root` routes Home ⇄ Workspace, installs the app-wide context,
//! and owns what belongs to neither route: the settings sheet and the About
//! card.
//!
//! Settings live here rather than in the workspace because they are app-wide —
//! ⌘, has to work on the home screen too.

use std::sync::Arc;

use atlas::prelude::*;
use atlas::shell::actions::{OpenSettings, Refresh, ShowAbout};
use gpui::prelude::*;
use gpui::{div, Context, Entity, FocusHandle, Window};
use guise::prelude::*;
use host::Host;
use model::Settings;

use crate::home::Home;
use crate::state::{AppState, Route};
use crate::workspace::Workspace;

pub struct Root {
    state: AppState,
    home: Entity<Home>,
    /// Built when a project opens and dropped when it closes, so everything
    /// scoped to one project goes with it.
    workspace: Option<Entity<Workspace>>,
    /// gpui dispatches actions along the focus path, so with nothing focused
    /// the menu bar greys out and swallows its shortcuts.
    focus: FocusHandle,
}

impl Root {
    pub fn new(host: Arc<Host>, cx: &mut Context<Self>) -> Self {
        let state = AppState::new(host, cx);
        provide(cx, state.clone());
        provide(cx, state.toasts.clone());
        watch(cx, &state.route);
        watch(cx, &state.settings);
        watch(cx, &state.settings_open);
        watch(cx, &state.about_open);

        let root = Root {
            home: cx.new(Home::new),
            workspace: None,
            focus: cx.focus_handle(),
            state,
        };
        root.state.reload(cx);
        root
    }

    fn edit(&self, cx: &mut gpui::App, change: impl FnOnce(&mut Settings)) {
        let mut settings = self.state.settings.get(cx);
        change(&mut settings);
        self.state.save_settings(cx, settings);
    }
}

impl Render for Root {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        // Every theme read happens before the first listener: `theme(cx)`
        // borrows cx immutably and `cx.listener` needs it mutably.
        let t = guise::theme::theme(cx);
        let body = t.body().hsla();
        let text = t.text().hsla();
        let font = t.font_family.clone();

        let content = match self.state.route.get(cx) {
            Route::Home => {
                // Dropping the workspace here is what stops a closed project's
                // signals and in-flight loads from outliving it.
                self.workspace = None;
                div().size_full().child(self.home.clone())
            }
            Route::Workspace(id) => {
                let open = self.state.host.active().filter(|p| p.id == id);
                match open {
                    Some(project) => {
                        let view = match self.workspace.clone() {
                            Some(view) if view.read(cx).project_id() == id => view,
                            _ => {
                                let view = cx.new(|cx| Workspace::new(project, cx));
                                self.workspace = Some(view.clone());
                                view
                            }
                        };
                        div().size_full().child(view)
                    }
                    // The route says a project is open and the host disagrees.
                    // Rendering an empty workspace would strand the user with
                    // no way back, so fall to Home instead.
                    None => {
                        self.state.route.set(cx, Route::Home);
                        div().size_full().child(self.home.clone())
                    }
                }
            }
        };

        focus::claim(window, cx, &self.focus);

        div()
            .track_focus(&self.focus)
            .on_action(cx.listener(|this, _: &OpenSettings, _, cx| {
                this.state.settings_open.set(cx, true)
            }))
            .on_action(cx.listener(|this, _: &ShowAbout, _, cx| {
                this.state.about_open.set(cx, true)
            }))
            .on_action(cx.listener(|this, _: &Refresh, _, cx| this.state.reload(cx)))
            .relative()
            .size_full()
            .flex()
            .bg(body)
            .text_color(text)
            .font_family(font)
            .child(content)
            // Overlays, above everything.
            .children(self.state.settings_open.get(cx).then(|| self.settings(cx)))
            .children(self.state.about_open.get(cx).then(|| about(&self.state)))
            .child(self.state.toasts.stack())
    }
}

impl Root {
    /// The settings sheet.
    ///
    /// guise's `SettingsSection`/`SettingsRow` give the shape. The page list
    /// (`SettingsView`) is worth adding once there are enough settings to
    /// group.
    fn settings(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let settings = self.state.settings.get(cx);
        let defaults = Settings::default();
        let open = self.state.settings_open.clone();

        Sheet::new()
            .title("Settings")
            .width(540.0)
            .on_close(move |_, _, cx| open.set(cx, false))
            .child(
                SettingsSection::new("Appearance")
                    .description("How the app looks.")
                    .child(
                        SettingsRow::new("theme", "Dark mode")
                            .description("Light mode follows the same palette.")
                            .modified(settings.theme != defaults.theme)
                            .on_reset(cx.listener(|this, _, _, cx| {
                                this.edit(cx, |s| s.theme = Settings::default().theme)
                            }))
                            .control(Switch::new("theme").checked(settings.dark()).on_change(
                                cx.listener(|this, _, _, cx| {
                                    let dark = this.state.settings.get(cx).dark();
                                    this.edit(cx, |s| {
                                        s.theme = if dark { "light" } else { "dark" }.into()
                                    });
                                }),
                            ))
                            .divider(false),
                    ),
            )
            .child(
                SettingsSection::new("Startup")
                    .child(
                        SettingsRow::new("restore", "Reopen the last project")
                            .description("Skip the home screen when there is somewhere to go.")
                            .modified(settings.restore_last != defaults.restore_last)
                            .on_reset(cx.listener(|this, _, _, cx| {
                                this.edit(cx, |s| s.restore_last = Settings::default().restore_last)
                            }))
                            .control(
                                Switch::new("restore").checked(settings.restore_last).on_change(
                                    cx.listener(|this, _, _, cx| {
                                        let on = this.state.settings.get(cx).restore_last;
                                        this.edit(cx, |s| s.restore_last = !on);
                                    }),
                                ),
                            )
                            .divider(false),
                    ),
            )
            .child(
                SettingsSection::new("Updates")
                    .description("__APPNAME__ installs updates in place.")
                    .child(
                        SettingsRow::new("autoupdate", "Check automatically")
                            .description("At launch, then hourly.")
                            .modified(settings.auto_update != defaults.auto_update)
                            .on_reset(cx.listener(|this, _, _, cx| {
                                this.edit(cx, |s| s.auto_update = Settings::default().auto_update)
                            }))
                            .control(
                                Switch::new("autoupdate").checked(settings.auto_update).on_change(
                                    cx.listener(|this, _, _, cx| {
                                        let on = this.state.settings.get(cx).auto_update;
                                        this.edit(cx, |s| s.auto_update = !on);
                                    }),
                                ),
                            )
                            .divider(false),
                    ),
            )
    }
}

fn about(state: &AppState) -> impl IntoElement {
    let open = state.about_open.clone();
    Sheet::new()
        .title("About __APPNAME__")
        .width(420.0)
        .on_close(move |_, _, cx| open.set(cx, false))
        .child(
            atlas::shell::about::Card::new("__APPNAME__", env!("CARGO_PKG_VERSION"))
                .build(env!("BUILD_KIND"), env!("BUILD_DATE"))
                .tagline("__APPDESC__")
                .icon(IconName::Boxes)
                .repo("https://github.com/__APPREPO__")
                .render(),
        )
}
