//! Atlas Desktop — the boilerplate a native gpui + guise app starts from.
//!
//! The layers are separate crates so they stay honest about what they depend
//! on: [`core`] and [`store`] never import gpui, [`bridge`] is the one seam
//! between tokio and the UI thread, and [`shell`] is everything that draws.
//! This crate is the front door over all four.
//!
//! ```toml
//! [dependencies]
//! atlas-desktop = "0.1"
//! ```
//!
//! ```no_run
//! use atlas::prelude::*;
//! # struct Root;
//! # impl Root { fn new(_: &mut gpui::Context<Self>) -> Self { Root } }
//! # impl gpui::Render for Root {
//! #     fn render(&mut self, _: &mut gpui::Window, _: &mut gpui::Context<Self>) -> impl gpui::IntoElement { gpui::div() }
//! # }
//! fn main() {
//!     gpui::Application::new().run(|cx| {
//!         Scheme::new().build(guise::theme::ColorScheme::Dark).init(cx);
//!         Chrome::new("Acme").docs("https://github.com/acme/acme").install(cx);
//!         MainWindow::versioned("Acme", env!("CARGO_PKG_VERSION")).open(cx, Root::new);
//!     });
//! }
//! ```
//!
//! ## The shape of an app built on this
//!
//! A Cargo workspace, layered bottom-up, where each crate depends only on
//! those below it:
//!
//! | crate | what it holds | gpui? |
//! |---|---|---|
//! | `model` | the domain types, pure serde | no |
//! | `store` | this crate's [`store`], typed to the app's documents | no |
//! | *(domain)* | whatever the app actually does — a client, a parser, an engine | no |
//! | `host` | the async service facade the UI calls | no |
//! | `app` | the gpui application: `bridge`, `state`, `root`, views | yes |
//!
//! Keeping gpui out of everything below `app` is what makes the domain
//! testable without a window, and what stops UI concerns leaking into the part
//! of the codebase that outlives the UI framework.

pub use atlasbridge as bridge;
pub use atlascore as core;
pub use atlasshell as shell;
pub use atlasstore as store;

/// The gpui and guise this was built against, so a downstream crate can reach
/// them without a second version in its own manifest.
pub use atlasshell::{gpui, guise};

/// Common imports for building an app.
pub mod prelude {
    pub use crate::bridge;
    pub use crate::core::{ago, bytes, count, iso_now, uuid, Load};
    pub use crate::shell::prelude::*;
    pub use crate::store::Store;
}
