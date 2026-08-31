//! The domain types every other crate speaks.
//!
//! Pure serde and nothing else. The serde names mirror the on-disk JSON
//! exactly, so the files under `~/.__APPSLUG__/` round-trip.

mod entry;
mod project;
mod settings;

pub use entry::Entry;
pub use project::by_recency;
pub use project::Project;
pub use settings::Settings;
