//! The navigation rail: an icon and a label per destination, collapsing to
//! icons only.
//!
//! Deliberately not guise's `NavLink`. A rail row reads better left-aligned
//! than a centered button, and the collapsed state swaps the whole row for an
//! icon rather than hiding the label — a hidden label still reserves its
//! width, which is the usual reason a "collapsed" sidebar is 140px wide.
//!
//! The rail owns no state. Which item is active, and whether it is collapsed,
//! live in the app's state; this renders them and reports clicks.
//!
//! ```ignore
//! Nav::new(&items, route.as_str())
//!     .title("Hopper")
//!     .collapsed(collapsed)
//!     .on_select(move |id, cx| route.set(cx, Route::parse(&id)))
//!     .on_toggle(move |cx| sidebar.update(cx, |c| *c = !*c))
//!     .footer(status_badge(cx))
//! ```

use std::rc::Rc;

use gpui::prelude::*;
use gpui::{div, px, AnyElement, App, IntoElement, SharedString, Window};
use guise::prelude::*;

/// One destination in the rail.
#[derive(Clone, Debug)]
pub struct NavItem {
    pub id: SharedString,
    pub label: SharedString,
    pub icon: IconName,
}

impl NavItem {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>, icon: IconName) -> Self {
        NavItem { id: id.into(), label: label.into(), icon }
    }
}

type SelectFn = Rc<dyn Fn(SharedString, &mut App)>;
type ToggleFn = Rc<dyn Fn(&mut App)>;

#[derive(IntoElement)]
pub struct Nav {
    title: Option<SharedString>,
    items: Vec<NavItem>,
    active: SharedString,
    collapsed: bool,
    width: f32,
    collapsed_width: f32,
    on_select: Option<SelectFn>,
    on_toggle: Option<ToggleFn>,
    footer: Option<AnyElement>,
}

impl Nav {
    pub fn new(items: impl IntoIterator<Item = NavItem>, active: impl Into<SharedString>) -> Self {
        Nav {
            title: None,
            items: items.into_iter().collect(),
            active: active.into(),
            collapsed: false,
            width: 212.0,
            collapsed_width: 60.0,
            on_select: None,
            on_toggle: None,
            footer: None,
        }
    }

    /// The app's name, shown beside the collapse toggle.
    pub fn title(mut self, title: impl Into<SharedString>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn collapsed(mut self, collapsed: bool) -> Self {
        self.collapsed = collapsed;
        self
    }

    pub fn width(mut self, expanded: f32, collapsed: f32) -> Self {
        self.width = expanded;
        self.collapsed_width = collapsed;
        self
    }

    pub fn on_select(mut self, handler: impl Fn(SharedString, &mut App) + 'static) -> Self {
        self.on_select = Some(Rc::new(handler));
        self
    }

    /// Wire the collapse toggle. Without one the toggle is not drawn — a
    /// button that cannot do anything is worse than no button.
    pub fn on_toggle(mut self, handler: impl Fn(&mut App) + 'static) -> Self {
        self.on_toggle = Some(Rc::new(handler));
        self
    }

    /// Anything pinned to the bottom: a connection badge, a version, an
    /// account. Rendered only when expanded.
    pub fn footer(mut self, footer: impl IntoElement) -> Self {
        self.footer = Some(footer.into_any_element());
        self
    }
}

impl RenderOnce for Nav {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        // Everything the listeners need, resolved before the first one exists.
        let palette = crate::theme::palette(cx);
        let t = guise::theme::theme(cx);
        let accent = t.color(t.primary_color, t.primary_shade()).hsla();
        let label_color = t.text().hsla();
        let selected_bg = gpui::hsla(accent.h, accent.s, accent.l, 0.15);
        let hover_bg = palette.bg_muted;
        let collapsed = self.collapsed;

        let mut list = Stack::new().gap(Size::Xs);
        for item in self.items {
            let selected = item.id == self.active;
            let select = self.on_select.clone();
            let id = item.id.clone();
            let element_id = SharedString::from(format!("nav-{}", item.id));

            let entry = if collapsed {
                div()
                    .flex()
                    .justify_center()
                    .child(
                        ActionIcon::new(element_id, item.icon)
                            .variant(if selected { Variant::Light } else { Variant::Subtle })
                            .color(if selected { t.primary_color } else { ColorName::Gray })
                            .size(Size::Md)
                            .on_click(move |_, _, cx| {
                                if let Some(select) = &select {
                                    select(id.clone(), cx);
                                }
                            }),
                    )
                    .into_any_element()
            } else {
                div()
                    .id(element_id)
                    .flex()
                    .items_center()
                    .gap_2()
                    .w_full()
                    .px_2()
                    .py(px(7.0))
                    .rounded_md()
                    .cursor_pointer()
                    .text_color(if selected { accent } else { label_color })
                    .when(selected, |d| d.bg(selected_bg))
                    .when(!selected, |d| d.hover(move |s| s.bg(hover_bg)))
                    .child(Icon::new(item.icon).size(Size::Sm))
                    .child(Text::new(item.label).size(Size::Sm))
                    .on_click(move |_, _, cx| {
                        if let Some(select) = &select {
                            select(id.clone(), cx);
                        }
                    })
                    .into_any_element()
            };
            list = list.child(entry);
        }

        let toggle = self.on_toggle.map(|handler| {
            ActionIcon::new(
                "nav-toggle",
                if collapsed { IconName::PanelLeftOpen } else { IconName::PanelLeftClose },
            )
            .variant(Variant::Subtle)
            .color(ColorName::Gray)
            .size(Size::Sm)
            .on_click(move |_, _, cx| handler(cx))
        });

        let header = match (collapsed, self.title) {
            (true, _) | (false, None) => {
                div().flex().justify_center().children(toggle.map(IntoElement::into_any_element))
            }
            (false, Some(title)) => div()
                .flex()
                .items_center()
                .justify_between()
                .child(Text::new(title).size(Size::Lg).bold())
                .children(toggle.map(IntoElement::into_any_element)),
        };

        div()
            .flex()
            .flex_col()
            .justify_between()
            .w(px(if collapsed { self.collapsed_width } else { self.width }))
            .flex_none()
            .h_full()
            .p_3()
            .bg(palette.bg_subtle)
            .border_r_1()
            .border_color(palette.border_subtle)
            .child(Stack::new().gap(Size::Sm).child(header).child(list))
            .children((!collapsed).then_some(self.footer).flatten())
    }
}
