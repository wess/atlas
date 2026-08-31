//! The list: search, add, toggle, delete.
//!
//! Every mutation dispatches through the host and re-publishes the list the
//! host returns, rather than editing the local copy and hoping the disk agrees.
//! It costs one round trip and removes the whole class of bug where the screen
//! and the file have drifted apart.

use atlas::prelude::*;
use gpui::prelude::*;
use gpui::{div, px, Context, Entity, SharedString, Window};
use guise::prelude::*;
use model::Item;

use crate::state::{filter, AppState};

pub struct Items {
    state: AppState,
    search: Entity<TextInput>,
    draft: Entity<TextInput>,
}

impl Items {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let state = AppState::get(cx);
        watch(cx, &state.items);
        watch(cx, &state.search);

        let search = cx.new(|cx| TextInput::new(cx).placeholder("Search").size(Size::Sm));
        let signal = state.search.clone();
        cx.subscribe(&search, move |_this: &mut Items, _input, event, cx| {
            if let TextInputEvent::Change(query) = event {
                signal.set(cx, query.clone());
            }
        })
        .detach();

        let draft = cx.new(|cx| TextInput::new(cx).placeholder("Add an item").size(Size::Sm));

        Items { state, search, draft }
    }

    fn add(&mut self, cx: &mut Context<Self>) {
        let name = self.draft.read(cx).text().trim().to_string();
        if name.is_empty() {
            return;
        }
        self.draft.update(cx, |input, cx| input.set_text("", cx));

        let host = std::sync::Arc::clone(&self.state.host);
        let state = self.state.clone();
        bridge::run(cx, async move { host.add(name).await }, move |result, cx| match result {
            // The add returns the one item; the list is what the view renders,
            // so reload rather than splice.
            Ok(_) => state.reload(cx),
            Err(e) => state.toasts.error(cx, "Could not add", &e),
        });
    }

    fn toggle(&self, cx: &mut gpui::App, id: String) {
        let host = std::sync::Arc::clone(&self.state.host);
        let state = self.state.clone();
        bridge::run(cx, async move { host.toggle(id).await }, move |result, cx| {
            state.apply(cx, "Could not update", result)
        });
    }

    fn remove(&self, cx: &mut gpui::App, id: String) {
        let host = std::sync::Arc::clone(&self.state.host);
        let state = self.state.clone();
        bridge::run(cx, async move { host.remove(id).await }, move |result, cx| {
            state.apply(cx, "Could not delete", result)
        });
    }
}

impl Render for Items {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = palette(cx);
        let query = self.state.search.get(cx);
        let items = self.state.items.get(cx);

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
            Load::Ready(all) => {
                let shown = filter(all, &query);
                if shown.is_empty() {
                    // "Nothing matches your search" and "nothing here yet" are
                    // different problems and need different sentences.
                    let message = if all.is_empty() {
                        "Nothing here yet. Add the first one above."
                    } else {
                        "No items match that search."
                    };
                    div()
                        .py(px(40.0))
                        .flex()
                        .justify_center()
                        .child(Text::new(message).size(Size::Sm).dimmed())
                        .into_any_element()
                } else {
                    let mut list = Stack::new().gap(Size::Xs);
                    for item in shown {
                        list = list.child(self.row(item, colors, cx));
                    }
                    list.into_any_element()
                }
            }
        };

        div()
            .id("items")
            .size_full()
            .overflow_y_scroll()
            .p(px(24.0))
            .child(
                Stack::new()
                    .gap(Size::Lg)
                    .child(
                        Group::new()
                            .gap(Size::Sm)
                            .justify(Justify::Between)
                            .child(Title::new("Items").order(2))
                            .child(div().w(px(220.0)).child(self.search.clone())),
                    )
                    .child(
                        Group::new()
                            .gap(Size::Sm)
                            .child(div().flex_1().child(self.draft.clone()))
                            .child(
                                Button::new("add", "Add")
                                    .variant(Variant::Filled)
                                    .size(Size::Sm)
                                    .left_section(Icon::new(IconName::Plus).size(Size::Xs))
                                    .on_click(cx.listener(|this, _, _, cx| this.add(cx))),
                            ),
                    )
                    .child(body),
            )
    }
}

impl Items {
    fn row(
        &self,
        item: &Item,
        colors: atlas::shell::Palette,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let id = item.id.clone();
        let done = item.done;

        div()
            .flex()
            .items_center()
            .gap_3()
            .px(px(12.0))
            .py(px(10.0))
            .rounded_md()
            .bg(colors.bg_subtle)
            .border_1()
            .border_color(colors.border_subtle)
            .child(
                Checkbox::new(SharedString::from(format!("done-{id}")))
                    .checked(done)
                    .on_change(cx.listener({
                        let id = id.clone();
                        move |this, _, _, cx| this.toggle(cx, id.clone())
                    })),
            )
            .child(div().flex_1().child({
                // A completed item stays legible but recedes; striking it
                // through as well would be two signals for one fact.
                let label = Text::new(item.name.clone()).size(Size::Sm);
                if done {
                    label.dimmed()
                } else {
                    label
                }
            }))
            .child(
                ActionIcon::new(SharedString::from(format!("del-{id}")), IconName::Trash2)
                    .variant(Variant::Subtle)
                    .color(ColorName::Red)
                    .size(Size::Sm)
                    .on_click(cx.listener(move |this, _, _, cx| this.remove(cx, id.clone()))),
            )
    }
}
