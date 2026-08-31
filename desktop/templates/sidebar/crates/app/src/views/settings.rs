//! The settings sheet.
//!
//! guise's `SettingsSection`/`SettingsRow` give the shape — the name on the
//! left, the control on the right, a reset arrow when the value is not the
//! default. The page list (`SettingsView`) is worth adding once there are
//! enough settings to group; with three rows it is chrome around nothing.
//!
//! The sheet renders as an empty element while it is closed, so `Root` can
//! keep it as a permanent child instead of building and dropping an entity.

use atlas::prelude::*;
use gpui::prelude::*;
use gpui::{div, Context, IntoElement, Window};
use guise::prelude::*;
use model::Settings;

use crate::state::AppState;

pub struct SettingsSheet {
    state: AppState,
}

impl SettingsSheet {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let state = AppState::get(cx);
        watch(cx, &state.settings_open);
        watch(cx, &state.settings);
        SettingsSheet { state }
    }

    /// Write one field and persist. Taking a closure rather than the whole
    /// struct means a row cannot accidentally save a stale copy of the others.
    fn edit(&self, cx: &mut gpui::App, change: impl FnOnce(&mut Settings)) {
        let mut settings = self.state.settings.get(cx);
        change(&mut settings);
        self.state.save_settings(cx, settings);
    }
}

impl Render for SettingsSheet {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.state.settings_open.get(cx) {
            return div().into_any_element();
        }

        let settings = self.state.settings.get(cx);
        let defaults = Settings::default();
        let open = self.state.settings_open.clone();

        Sheet::new()
            .title("Settings")
            .width(520.0)
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
            .into_any_element()
    }
}
