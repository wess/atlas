//! The window's fallback focus.
//!
//! gpui dispatches an action along the focus path. An action handled on an
//! element is therefore unreachable while nothing is focused — which greys out
//! every menu item bound to it and silently swallows its keyboard shortcut. It
//! reads as a broken menu bar and is not one.
//!
//! The fix is for the root to hold focus whenever it would otherwise go
//! nowhere. In the root view:
//!
//! ```ignore
//! // Root::new
//! let focus = cx.focus_handle();
//!
//! // Root::render
//! atlasshell::focus::claim(window, cx, &self.focus);
//! div()
//!     .track_focus(&self.focus)
//!     .on_action(cx.listener(|this, _: &OpenSettings, _, cx| { /* … */ }))
//! ```

use gpui::{App, FocusHandle, Window};

/// Take focus for `handle` when nothing else in the window has it.
///
/// Safe to call every frame; it does nothing once something is focused, so a
/// text field the user clicked keeps the caret.
pub fn claim(window: &mut Window, cx: &App, handle: &FocusHandle) {
    if window.focused(cx).is_none() {
        window.focus(handle);
    }
}
