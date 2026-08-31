//! The domain types every other crate speaks.
//!
//! Pure serde and nothing else: no gpui, no I/O, no behavior beyond what a
//! value can decide about itself. The serde names mirror the on-disk JSON
//! exactly, so the files under `~/.__APPSLUG__/` round-trip.

mod item;
mod settings;

pub use item::Item;
pub use settings::Settings;
