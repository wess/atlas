//! The workspace: what an open project looks like.
//!
//! A sidebar listing what the project contains, a tabbed main pane, and a
//! header that gets you back out. The per-project state is provided as context
//! here rather than at the root, so it is dropped when the project closes.

mod content;
mod sidebar;

use atlas::prelude::*;
use gpui::prelude::*;
use gpui::{div, px, Context, SharedString, Window};
use guise::prelude::*;
use model::Project;

use crate::state::{AppState, Tab, WorkspaceState};

pub struct Workspace {
    app: AppState,
    state: WorkspaceState,
}

impl Workspace {
    pub fn new(project: Project, cx: &mut Context<Self>) -> Self {
        let app = AppState::get(cx);
        let state = WorkspaceState::new(project, cx);
        provide(cx, state.clone());
        watch(cx, &state.entries);
        watch(cx, &state.selected);
        watch(cx, &state.tab);

        state.reload(std::sync::Arc::clone(&app.host), cx);
        Workspace { app, state }
    }

    /// Which project this view is for, so `Root` can tell whether the one it
    /// holds is still the right one.
    pub fn project_id(&self) -> &str {
        &self.state.project.id
    }
}

impl Render for Workspace {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = palette(cx);
        let active = self.state.tab.get(cx);

        let mut tabs = Group::new().gap(Size::Xs);
        for tab in Tab::all() {
            let signal = self.state.tab.clone();
            tabs = tabs.child(
                Button::new(SharedString::from(format!("tab-{}", tab.label())), tab.label())
                    .variant(if tab == active { Variant::Light } else { Variant::Subtle })
                    .size(Size::Sm)
                    .on_click(move |_, _, cx| signal.set(cx, tab)),
            );
        }

        let header = div()
            .flex()
            .items_center()
            .justify_between()
            .px(px(16.0))
            .py(px(10.0))
            .border_b_1()
            .border_color(colors.border_subtle)
            .bg(colors.bg_subtle)
            .child(
                Group::new()
                    .gap(Size::Sm)
                    .child(
                        ActionIcon::new("close-project", IconName::ChevronLeft)
                            .variant(Variant::Subtle)
                            .color(ColorName::Gray)
                            .size(Size::Sm)
                            .on_click(cx.listener(|this, _, _, cx| this.app.close(cx))),
                    )
                    .child(Text::new(self.state.project.name.clone()).size(Size::Sm).bold())
                    .child(Text::new(self.state.project.path.clone()).size(Size::Xs).dimmed()),
            )
            .child(tabs);

        div()
            .size_full()
            .flex()
            .flex_col()
            .child(header)
            .child(
                div()
                    .flex_1()
                    .min_h(px(0.0))
                    .flex()
                    .child(sidebar::render(&self.state, colors, cx))
                    .child(content::render(&self.state, colors, cx)),
            )
    }
}
