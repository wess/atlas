//! One module per surface. A view owns its own widgets and reads what it needs
//! from `AppState`; nothing here reaches into another view.

mod dashboard;
mod items;
mod settings;

pub use dashboard::Dashboard;
pub use items::Items;
pub use settings::SettingsSheet;
