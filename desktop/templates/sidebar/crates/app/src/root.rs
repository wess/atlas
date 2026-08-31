//! The UI tree. `Root` owns routing, installs the app-wide context, and holds
//! the window's fallback focus.

use std::sync::Arc;

use atlas::prelude::*;
use atlas::shell::actions::{OpenSettings, Refresh, ShowAbout};
use gpui::prelude::*;
use gpui::{div, Context, Entity, FocusHandle, Window};
use guise::prelude::*;
use host::Host;

use crate::state::{AppState, Route};
use crate::views;

pub struct Root {
    state: AppState,
    dashboard: Entity<views::Dashboard>,
    items: Entity<views::Items>,
    settings: Entity<views::SettingsSheet>,
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
        watch(cx, &state.collapsed);
        watch(cx, &state.about_open);

        let root = Root {
            dashboard: cx.new(views::Dashboard::new),
            items: cx.new(views::Items::new),
            settings: cx.new(views::SettingsSheet::new),
            focus: cx.focus_handle(),
            state,
        };
        root.state.reload(cx);
        root
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

        let route = self.state.route.get(cx);
        let collapsed = self.state.collapsed.get(cx);

        let content = match route {
            Route::Dashboard => div().size_full().child(self.dashboard.clone()),
            Route::Items => div().size_full().child(self.items.clone()),
        };

        let route_signal = self.state.route.clone();
        let collapse = self.state.clone();
        let nav = Nav::new(Route::nav(), route.id())
            .title("__APPNAME__")
            .collapsed(collapsed)
            .on_select(move |id, cx| {
                if let Some(next) = Route::from_id(&id) {
                    route_signal.set(cx, next);
                }
            })
            .on_toggle(move |cx| {
                // Persisted, because a rail that forgets it was collapsed is a
                // setting the user has to re-apply every launch.
                let mut settings = collapse.settings.get(cx);
                settings.sidebar_collapsed = !settings.sidebar_collapsed;
                collapse.collapsed.set(cx, settings.sidebar_collapsed);
                collapse.save_settings(cx, settings);
            })
            .footer(
                Text::new(format!("v{}", env!("CARGO_PKG_VERSION"))).size(Size::Xs).dimmed(),
            );

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
            .child(nav)
            .child(content)
            // Overlays, above everything. The settings sheet renders nothing
            // while it is closed.
            .child(self.settings.clone())
            .children(self.state.about_open.get(cx).then(|| about(&self.state, cx)))
            .child(self.state.toasts.stack())
    }
}

/// The About card, in a sheet that closes the way every other overlay does.
fn about(state: &AppState, _cx: &mut Context<Root>) -> impl IntoElement {
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
