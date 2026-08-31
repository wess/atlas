//! The home screen: the projects this app knows about, and the form that adds
//! one.

use atlas::prelude::*;
use gpui::prelude::*;
use gpui::{div, px, Context, Entity, SharedString, Window};
use guise::prelude::*;
use model::Project;

use crate::state::{filter, AppState};

pub struct Home {
    state: AppState,
    search: Entity<TextInput>,
    name: Entity<TextInput>,
    path: Entity<TextInput>,
}

impl Home {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let state = AppState::get(cx);
        watch(cx, &state.projects);
        watch(cx, &state.search);

        let search = cx.new(|cx| TextInput::new(cx).placeholder("Search projects").size(Size::Sm));
        let signal = state.search.clone();
        cx.subscribe(&search, move |_this: &mut Home, _input, event, cx| {
            if let TextInputEvent::Change(query) = event {
                signal.set(cx, query.clone());
            }
        })
        .detach();

        let name = cx.new(|cx| TextInput::new(cx).placeholder("Name").size(Size::Sm));
        let path = cx.new(|cx| TextInput::new(cx).placeholder("Path").size(Size::Sm));

        Home { state, search, name, path }
    }

    fn add(&mut self, cx: &mut Context<Self>) {
        let name = self.name.read(cx).text().trim().to_string();
        let path = self.path.read(cx).text().trim().to_string();
        if name.is_empty() || path.is_empty() {
            self.state.toasts.warn(cx, "Not enough to go on", "A project needs a name and a path.");
            return;
        }
        self.name.update(cx, |input, cx| input.set_text("", cx));
        self.path.update(cx, |input, cx| input.set_text("", cx));

        let host = std::sync::Arc::clone(&self.state.host);
        let state = self.state.clone();
        bridge::run(cx, async move { host.add(name, path).await }, move |result, cx| {
            state.apply(cx, "Could not add the project", result)
        });
    }

    fn forget(&self, cx: &mut gpui::App, id: String) {
        let host = std::sync::Arc::clone(&self.state.host);
        let state = self.state.clone();
        bridge::run(cx, async move { host.forget(id).await }, move |result, cx| {
            state.apply(cx, "Could not remove the project", result)
        });
    }
}

impl Render for Home {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = palette(cx);
        let query = self.state.search.get(cx);
        let projects = self.state.projects.get(cx);

        // Three distinguishable states, three different screens. An error
        // rendered as an empty list is the bug `Load` exists to prevent.
        let body = match &projects {
            Load::Loading => div()
                .flex()
                .justify_center()
                .py(px(48.0))
                .child(Loader::new().size(Size::Md))
                .into_any_element(),
            Load::Failed(error) => Alert::new(error.clone())
                .title("Could not load your projects")
                .color(ColorName::Red)
                .icon(IconName::TriangleAlert)
                .into_any_element(),
            Load::Ready(all) => {
                let shown = filter(all, &query);
                if shown.is_empty() {
                    // "Nothing matches your search" and "nothing here yet" are
                    // different problems and need different sentences.
                    let message = if all.is_empty() {
                        "No projects yet. Add the first one above."
                    } else {
                        "No projects match that search."
                    };
                    div()
                        .py(px(40.0))
                        .flex()
                        .justify_center()
                        .child(Text::new(message).size(Size::Sm).dimmed())
                        .into_any_element()
                } else {
                    let mut grid = SimpleGrid::new(3).spacing(Size::Md);
                    for project in shown {
                        grid = grid.child(self.card(project, colors, cx));
                    }
                    grid.into_any_element()
                }
            }
        };

        div()
            .id("home")
            .size_full()
            .overflow_y_scroll()
            .p(px(28.0))
            .child(
                Stack::new()
                    .gap(Size::Lg)
                    .child(
                        Group::new()
                            .gap(Size::Sm)
                            .justify(Justify::Between)
                            .child(Title::new("Projects").order(2))
                            .child(div().w(px(240.0)).child(self.search.clone())),
                    )
                    .child(
                        Group::new()
                            .gap(Size::Sm)
                            .child(div().w(px(200.0)).child(self.name.clone()))
                            .child(div().flex_1().child(self.path.clone()))
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

impl Home {
    fn card(
        &self,
        project: &Project,
        colors: atlas::shell::Palette,
        cx: &mut Context<Self>,
    ) -> impl IntoElement {
        let id = project.id.clone();
        let opened = match &project.opened {
            // The date half of the ISO timestamp; the time of day is noise on
            // a card.
            Some(at) => format!("Opened {}", at.chars().take(10).collect::<String>()),
            None => "Never opened".to_string(),
        };

        div()
            .id(SharedString::from(format!("project-{id}")))
            .flex()
            .flex_col()
            .gap_2()
            .p(px(16.0))
            .rounded_lg()
            .bg(colors.bg_subtle)
            .border_1()
            .border_color(colors.border_subtle)
            .cursor_pointer()
            .hover(move |s| s.bg(colors.bg_muted))
            .on_click(cx.listener({
                let id = id.clone();
                move |this, _, _, cx| this.state.open(cx, id.clone())
            }))
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(Text::new(project.name.clone()).size(Size::Sm).bold())
                    .child(
                        ActionIcon::new(
                            SharedString::from(format!("forget-{id}")),
                            IconName::Trash2,
                        )
                        .variant(Variant::Subtle)
                        .color(ColorName::Red)
                        .size(Size::Xs)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            // Otherwise the click also reaches the card and
                            // opens the project it just deleted.
                            cx.stop_propagation();
                            this.forget(cx, id.clone());
                        })),
                    ),
            )
            .child(Text::new(project.path.clone()).size(Size::Xs).dimmed())
            .child(Text::new(opened).size(Size::Xs).dimmed())
    }
}
