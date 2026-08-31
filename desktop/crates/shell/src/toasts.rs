//! Transient feedback, stacked top-right over everything.
//!
//! A wrapper over guise's `ToastStack` that fixes the severity vocabulary in
//! one place. Left to itself every call site picks its own color for a failure
//! and its own timeout, and by the third view an error is showing for two
//! seconds in teal.
//!
//! Provided as context by the root, so any view can reach it:
//!
//! ```ignore
//! // Root::new
//! let toasts = Toasts::new(cx);
//! provide(cx, toasts.clone());
//!
//! // Root::render, above everything else
//! .child(toasts.stack())
//!
//! // anywhere
//! Toasts::get(cx).error(cx, "Pull failed", &reason);
//! ```

use std::time::Duration;

use gpui::{App, AppContext, Entity};
use guise::prelude::*;

/// How long a toast stays up, by how much the user needs to read.
const BRIEF: u64 = 2_000;
const NORMAL: u64 = 4_000;

#[derive(Clone)]
pub struct Toasts {
    stack: Entity<ToastStack>,
}

impl Toasts {
    pub fn new(cx: &mut App) -> Self {
        Toasts { stack: cx.new(|_| ToastStack::new().duration(Some(Duration::from_millis(NORMAL)))) }
    }

    /// The stack entity — render it as the last child of the root so toasts
    /// paint above the app.
    pub fn stack(&self) -> Entity<ToastStack> {
        self.stack.clone()
    }

    /// The stack provided as context by the root.
    pub fn get(cx: &App) -> Toasts {
        use_context::<Toasts>(cx).expect("Toasts provided by the root view")
    }

    /// The general form. Prefer the severity helpers below.
    pub fn show(
        &self,
        cx: &mut App,
        title: Option<&str>,
        message: &str,
        color: ColorName,
        ms: u64,
    ) {
        let title = title.map(str::to_string);
        let message = message.to_string();
        self.stack.update(cx, |stack, cx| {
            stack.set_duration(Some(Duration::from_millis(ms)));
            match title {
                Some(title) => stack.push_titled(title, message, color, cx),
                None => stack.push(message, cx),
            };
        });
    }

    /// It worked. Brief, because the result is already on screen.
    pub fn success(&self, cx: &mut App, message: &str) {
        self.show(cx, None, message, ColorName::Teal, BRIEF);
    }

    /// It failed, and the reason matters. Titled, so the stack is scannable.
    pub fn error(&self, cx: &mut App, title: &str, message: &str) {
        self.show(cx, Some(title), message, ColorName::Red, NORMAL);
    }

    /// It half worked — a bulk action where some items failed.
    pub fn warn(&self, cx: &mut App, title: &str, message: &str) {
        self.show(cx, Some(title), message, ColorName::Orange, NORMAL);
    }

    /// Neutral news the user did not ask for.
    pub fn info(&self, cx: &mut App, message: &str) {
        self.show(cx, None, message, ColorName::Gray, NORMAL);
    }
}
