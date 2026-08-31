//! Where the app's state lives: `~/.__APPSLUG__/`, one JSON document per
//! thing. `__APPENV___DIR` relocates it, which is how tests get a scratch
//! directory.
//!
//! A thin, *typed* layer over `atlas::store` — the document names and their
//! shapes are declared once, here, rather than as string literals scattered
//! through the app. gpui-free.

use atlas::store::{Paths, Store as Inner};
use model::Settings;

const SETTINGS: &str = "settings.json";

#[derive(Clone, Debug)]
pub struct Store {
    inner: Inner,
}

impl Default for Store {
    fn default() -> Self {
        Store::new()
    }
}

impl Store {
    pub fn new() -> Self {
        Store { inner: Inner::new("__APPSLUG__") }
    }

    pub fn paths(&self) -> &Paths {
        self.inner.paths()
    }

    pub fn settings(&self) -> Settings {
        self.inner.read(SETTINGS)
    }

    pub fn save_settings(&self, settings: &Settings) -> std::io::Result<()> {
        self.inner.write(SETTINGS, settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_round_trip_through_the_disk() {
        let dir = std::env::temp_dir().join(format!("appstore{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        // Ask the paths for the variable name rather than spelling it out — a
        // test that guesses it wrong silently writes to the real
        // ~/.__APPSLUG__ and "passes".
        std::env::set_var(Paths::new("__APPSLUG__").env_var(), &dir);

        let store = Store::new();
        assert_eq!(store.settings(), Settings::default());

        let settings = Settings { theme: "light".into(), auto_update: false };
        store.save_settings(&settings).unwrap();
        assert_eq!(store.settings(), settings);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
