//! The chrome a desktop app has before it has a feature: a theme, a menu bar,
//! a window, a modal that does not fight the dropdowns inside it, a toast
//! stack, an About card, and self-update.
//!
//! None of it is the product, all of it has to exist, and writing it a fourth
//! time is how the fourth app ends up with a menu bar that greys out.
//!
//! The layers stay separable. [`theme`], [`sheet`], [`nav`] and [`toasts`] are
//! ordinary guise components; [`menu`], [`window`] and [`update`] are wiring
//! you call once at startup. Take what you want.
//!
//! ```no_run
//! use atlasshell::{menu::Chrome, window::MainWindow};
//! # use gpui::App;
//! # struct Root;
//! # impl Root { fn new(_: &mut gpui::Context<Self>) -> Self { Root } }
//! # impl gpui::Render for Root {
//! #     fn render(&mut self, _: &mut gpui::Window, _: &mut gpui::Context<Self>) -> impl gpui::IntoElement { gpui::div() }
//! # }
//! fn start(cx: &mut App) {
//!     atlasshell::theme::Scheme::default().build(guise::theme::ColorScheme::Dark).init(cx);
//!     Chrome::new("Hopper").docs("https://github.com/wess/hopper").install(cx);
//!     MainWindow::new("Hopper").size(1380.0, 880.0).open(cx, Root::new);
//! }
//! ```

pub mod about;
pub mod actions;
pub mod focus;
pub mod menu;
pub mod nav;
pub mod sheet;
pub mod theme;
pub mod toasts;
pub mod update;
pub mod window;

pub use nav::{Nav, NavItem};
pub use sheet::Sheet;
pub use theme::{Palette, Scheme};
pub use toasts::Toasts;

/// Re-exported so a downstream crate can name the exact gpui and guise this
/// was built against without a second version in its own manifest.
pub use guise;
pub use gpui;

/// Common imports for building an Atlas Desktop app.
pub mod prelude {
    pub use crate::actions;
    pub use crate::focus;
    pub use crate::menu::Chrome;
    pub use crate::nav::{Nav, NavItem};
    pub use crate::sheet::Sheet;
    pub use crate::theme::{palette, Palette, Scheme};
    pub use crate::toasts::Toasts;
    pub use crate::window::MainWindow;
}
