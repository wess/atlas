//! The landing surface: what the app knows right now, at a glance.

use atlas::prelude::*;
use gpui::prelude::*;
use gpui::{div, px, Context, Window};
use guise::prelude::*;
use model::Item;

use crate::state::AppState;

pub struct Dashboard {
    state: AppState,
}

impl Dashboard {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let state = AppState::get(cx);
        watch(cx, &state.items);
        Dashboard { state }
    }
}

impl Render for Dashboard {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = palette(cx);
        let items = self.state.items.get(cx);

        // Three distinguishable states, three different screens. An error
        // rendered as an empty list is the bug `Load` exists to prevent.
        let body = match &items {
            Load::Loading => div()
                .flex()
                .justify_center()
                .py(px(48.0))
                .child(Loader::new().size(Size::Md))
                .into_any_element(),
            Load::Failed(error) => Alert::new(error.clone())
                .title("Could not load")
                .color(ColorName::Red)
                .icon(IconName::TriangleAlert)
                .into_any_element(),
            Load::Ready(list) => summary(list, colors, cx).into_any_element(),
        };

        div()
            .id("dashboard")
            .size_full()
            .overflow_y_scroll()
            .p(px(24.0))
            .child(
                Stack::new()
                    .gap(Size::Lg)
                    .child(Title::new("Dashboard").order(2))
                    .child(body),
            )
    }
}

fn summary(
    items: &[Item],
    colors: atlas::shell::Palette,
    cx: &gpui::App,
) -> impl IntoElement {
    let done = items.iter().filter(|i| i.done).count();
    let open = items.len() - done;

    // Resolved here rather than inside `stat`, which has no cx to read from.
    let t = guise::theme::theme(cx);
    let shade = t.primary_shade();

    let recent: Vec<_> = {
        let mut sorted: Vec<&Item> = items.iter().collect();
        // Newest first. The timestamps are ISO 8601, so string order is time
        // order — no parsing needed.
        sorted.sort_by(|a, b| b.created.cmp(&a.created));
        sorted.into_iter().take(5).collect()
    };

    Stack::new()
        .gap(Size::Lg)
        .child(
            Group::new()
                .gap(Size::Md)
                .child(stat("Open", open, t.color(ColorName::Blue, shade), colors))
                .child(stat("Done", done, t.color(ColorName::Teal, shade), colors))
                .child(stat("Total", items.len(), t.color(ColorName::Gray, shade), colors)),
        )
        .child(
            Stack::new().gap(Size::Sm).child(Text::new("Recent").size(Size::Sm).dimmed()).children(
                recent.into_iter().map(|item| {
                    div()
                        .flex()
                        .items_center()
                        .justify_between()
                        .px(px(12.0))
                        .py(px(9.0))
                        .rounded_md()
                        .bg(colors.bg_subtle)
                        .child(Text::new(item.name.clone()).size(Size::Sm))
                        // The date half of the ISO timestamp; the time of day
                        // is noise in a list this coarse.
                        .child(
                            Text::new(item.created.chars().take(10).collect::<String>())
                                .size(Size::Xs)
                                .dimmed(),
                        )
                }),
            ),
        )
}

fn stat(
    label: &'static str,
    value: usize,
    color: guise::theme::Color,
    colors: atlas::shell::Palette,
) -> impl IntoElement {
    div()
        .flex()
        .flex_col()
        .gap_1()
        .min_w(px(120.0))
        .px(px(16.0))
        .py(px(14.0))
        .rounded_lg()
        .bg(colors.bg_subtle)
        .border_1()
        .border_color(colors.border_subtle)
        .child(Text::new(label).size(Size::Xs).dimmed())
        .child(Title::new(value.to_string()).order(3).color(color))
}
