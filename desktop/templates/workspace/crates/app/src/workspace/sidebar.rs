//! What the open project contains, down the left.
//!
//! A free function rather than a view of its own: it holds no state, so an
//! entity would only add a handle for `Workspace` to keep in sync.

use atlas::prelude::*;
use gpui::prelude::*;
use gpui::{div, px, SharedString};
use guise::prelude::*;

use crate::state::WorkspaceState;

pub fn render(
    state: &WorkspaceState,
    colors: atlas::shell::Palette,
    cx: &mut gpui::App,
) -> impl IntoElement {
    let entries = state.entries.get(cx);
    let selected = state.selected.get(cx);

    let body = match &entries {
        Load::Loading => div()
            .flex()
            .justify_center()
            .py(px(24.0))
            .child(Loader::new().size(Size::Sm))
            .into_any_element(),
        Load::Failed(error) => div()
            .p(px(12.0))
            .child(Text::new(error.clone()).size(Size::Xs).dimmed())
            .into_any_element(),
        Load::Ready(list) if list.is_empty() => div()
            .p(px(12.0))
            .child(Text::new("Nothing in this project yet.").size(Size::Xs).dimmed())
            .into_any_element(),
        Load::Ready(list) => {
            let mut items = Stack::new().gap(Size::Xs);
            for entry in list {
                let is_selected = selected.as_deref() == Some(entry.name.as_str());
                let signal = state.selected.clone();
                let name = entry.name.clone();
                let icon = if entry.kind == "folder" { IconName::Folder } else { IconName::File };

                items = items.child(
                    div()
                        .id(SharedString::from(format!("entry-{name}")))
                        .flex()
                        .items_center()
                        .gap_2()
                        .px_2()
                        .py(px(6.0))
                        .rounded_md()
                        .cursor_pointer()
                        .when(is_selected, |d| d.bg(colors.bg_muted))
                        .when(!is_selected, |d| d.hover(move |s| s.bg(colors.bg_muted)))
                        .child(Icon::new(icon).size(Size::Xs))
                        .child(Text::new(entry.name.clone()).size(Size::Xs))
                        .on_click(move |_, _, cx| signal.set(cx, Some(name.clone()))),
                );
            }
            items.into_any_element()
        }
    };

    div()
        .id("workspace-sidebar")
        .w(px(240.0))
        .flex_none()
        .h_full()
        .overflow_y_scroll()
        .p(px(10.0))
        .bg(colors.bg_subtle)
        .border_r_1()
        .border_color(colors.border_subtle)
        .child(body)
}
