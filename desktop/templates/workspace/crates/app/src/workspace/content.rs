//! The main pane: whichever tab is active.

use gpui::prelude::*;
use gpui::{div, px};
use guise::prelude::*;
use model::Entry;

use crate::state::{Tab, WorkspaceState};

pub fn render(
    state: &WorkspaceState,
    colors: atlas::shell::Palette,
    cx: &mut gpui::App,
) -> impl IntoElement {
    let entries = state.entries.get(cx);
    let selected = state.selected.get(cx);
    let current = selected
        .as_deref()
        .and_then(|name| entries.ready()?.iter().find(|e| e.name == name))
        .cloned();

    let body = match state.tab.get(cx) {
        Tab::Contents => match current {
            Some(entry) => detail(&entry, colors).into_any_element(),
            None => empty("Select something on the left.").into_any_element(),
        },
        Tab::Details => Stack::new()
            .gap(Size::Sm)
            .child(field("Name", state.project.name.clone(), colors))
            .child(field("Path", state.project.path.clone(), colors))
            .child(field("Created", state.project.created.clone(), colors))
            .child(field(
                "Items",
                entries.ready().map_or_else(|| "—".into(), |list| list.len().to_string()),
                colors,
            ))
            .into_any_element(),
    };

    div().id("workspace-content").flex_1().h_full().overflow_y_scroll().p(px(20.0)).child(body)
}

fn detail(entry: &Entry, colors: atlas::shell::Palette) -> impl IntoElement {
    Stack::new()
        .gap(Size::Sm)
        .child(Title::new(entry.name.clone()).order(3))
        .child(field("Kind", entry.kind.clone(), colors))
        // `bytes` renders -1 as "—" rather than "0 B", which is what an
        // unknown size should look like.
        .child(field("Size", atlas::core::bytes(entry.size), colors))
}

fn field(
    label: &'static str,
    value: String,
    colors: atlas::shell::Palette,
) -> impl IntoElement {
    div()
        .flex()
        .items_center()
        .justify_between()
        .px(px(12.0))
        .py(px(9.0))
        .rounded_md()
        .bg(colors.bg_subtle)
        .child(Text::new(label).size(Size::Xs).dimmed())
        .child(Text::new(value).size(Size::Xs))
}

fn empty(message: &'static str) -> impl IntoElement {
    div()
        .py(px(48.0))
        .flex()
        .justify_center()
        .child(Text::new(message).size(Size::Sm).dimmed())
}
