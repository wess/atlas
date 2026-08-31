//! The whole UI: one centered surface, plus the two overlays every app has.
//!
//! `Root` also holds the window's fallback focus. gpui dispatches an action
//! along the focus path, so an action registered on an element is unreachable
//! while nothing is focused — which greys out the menu bar and swallows its
//! shortcuts.

use atlas::prelude::*;
use atlas::shell::actions::{OpenSettings, ShowAbout};
use gpui::prelude::*;
use gpui::{div, px, Context, FocusHandle, Window};
use guise::prelude::*;
use model::Settings;
use store::Store;

use crate::state::AppState;

pub struct Root {
    state: AppState,
    focus: FocusHandle,
}

impl Root {
    pub fn new(store: Store, cx: &mut Context<Self>) -> Self {
        let state = AppState::new(store, cx);
        provide(cx, state.clone());
        watch(cx, &state.settings);
        watch(cx, &state.settings_open);
        watch(cx, &state.about_open);

        Root { state, focus: cx.focus_handle() }
    }

    /// Write one field and persist. Taking a closure rather than the whole
    /// struct means a control cannot accidentally save a stale copy of the
    /// others.
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
        let colors = palette(cx);

        focus::claim(window, cx, &self.focus);

        let surface = div()
            .flex()
            .flex_col()
            .gap_4()
            .w(px(420.0))
            .p(px(28.0))
            .rounded_lg()
            .bg(colors.bg_surface)
            .border_1()
            .border_color(colors.border)
            .child(Title::new("__APPNAME__").order(2))
            .child(Text::new("__APPDESC__").size(Size::Sm).dimmed())
            .child(
                Group::new()
                    .gap(Size::Sm)
                    .child(
                        Button::new("settings", "Settings")
                            .variant(Variant::Filled)
                            .size(Size::Sm)
                            .left_section(Icon::new(IconName::Settings).size(Size::Xs))
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.settings_open.set(cx, true)
                            })),
                    )
                    .child(
                        Button::new("about", "About")
                            .variant(Variant::Subtle)
                            .size(Size::Sm)
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.state.about_open.set(cx, true)
                            })),
                    ),
            );

        div()
            .track_focus(&self.focus)
            .on_action(cx.listener(|this, _: &OpenSettings, _, cx| {
                this.state.settings_open.set(cx, true)
            }))
            .on_action(cx.listener(|this, _: &ShowAbout, _, cx| {
                this.state.about_open.set(cx, true)
            }))
            .relative()
            .size_full()
            .flex()
            .items_center()
            .justify_center()
            .bg(body)
            .text_color(text)
            .font_family(font)
            .child(surface)
            // Overlays, above everything.
            .children(self.state.settings_open.get(cx).then(|| self.settings(cx)))
            .children(self.state.about_open.get(cx).then(|| about(&self.state)))
            .child(self.state.toasts.stack())
    }
}

impl Root {
    /// The settings sheet.
    ///
    /// guise's `SettingsSection`/`SettingsRow` give the shape — name on the
    /// left, control on the right, a reset arrow when the value is not the
    /// default. The page list (`SettingsView`) is worth adding once there are
    /// enough settings to group; with two rows it is chrome around nothing.
    fn settings(&self, cx: &mut Context<Self>) -> impl IntoElement {
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
    }
}

/// The About card, in a sheet that closes the way every other overlay does.
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
