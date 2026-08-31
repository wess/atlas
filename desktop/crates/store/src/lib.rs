//! Local persistence: plain JSON documents under `~/.<app>/` and the OS
//! keychain for secrets. gpui-free.
//!
//! A [`Store`] is the pair, bound to one app id:
//!
//! ```no_run
//! use atlasstore::Store;
//! # #[derive(Default, serde::Serialize, serde::Deserialize)] struct Settings;
//! let store = Store::new("hopper");
//! let settings: Settings = store.read("settings.json");
//! store.write("settings.json", &settings).ok();
//! store.keychain().put("github.token", "ghp_…");
//! ```
//!
//! Nothing here is a database. These are files a user can open, diff, and fix
//! by hand, which is worth more than any query the app would have run.

pub mod json;
pub mod keychain;
pub mod paths;

use serde::de::DeserializeOwned;
use serde::Serialize;

pub use keychain::Keychain;
pub use paths::Paths;

/// The app's on-disk state: a directory of JSON documents and a keychain
/// service.
#[derive(Clone, Debug)]
pub struct Store {
    paths: Paths,
    keychain: Keychain,
}

impl Store {
    /// A store for `slug`, using the conventional locations: documents under
    /// `~/.<slug>/` (overridden by `<SLUG>_DIR`) and keychain entries under
    /// the service `io.wess.<slug>`.
    pub fn new(slug: &str) -> Self {
        Store { paths: Paths::new(slug), keychain: Keychain::new(format!("io.wess.{slug}")) }
    }

    /// A store with an explicit keychain service, for an app whose bundle id
    /// is not `io.wess.<slug>` — or one inheriting entries an earlier build
    /// wrote under a different name.
    pub fn with_service(slug: &str, service: impl Into<String>) -> Self {
        Store { paths: Paths::new(slug), keychain: Keychain::new(service) }
    }

    pub fn paths(&self) -> &Paths {
        &self.paths
    }

    pub fn keychain(&self) -> &Keychain {
        &self.keychain
    }

    /// Read a document, falling back to the default when it is missing or
    /// unreadable.
    pub fn read<T: DeserializeOwned + Default>(&self, name: &str) -> T {
        json::read_or_default(&self.paths.file(name))
    }

    /// Write a document atomically.
    pub fn write<T: Serialize>(&self, name: &str, value: &T) -> std::io::Result<()> {
        json::write(&self.paths.file(name), value)
    }

    /// Delete a document. A document that was never written is not an error —
    /// the caller wanted it gone, and it is.
    pub fn remove(&self, name: &str) -> std::io::Result<()> {
        match std::fs::remove_file(self.paths.file(name)) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            other => other,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
    struct Settings {
        theme: String,
    }

    /// A store in a scratch directory of its own.
    ///
    /// The slug differs per test because the override is an environment
    /// variable, and environment variables are process-global: two tests
    /// sharing one would race, and the loser would read the other's scratch
    /// directory after it had been deleted.
    fn scoped(slug: &str) -> Store {
        let dir = std::env::temp_dir().join(format!("atlasstore{}{slug}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::env::set_var(format!("{}_DIR", slug.to_uppercase()), &dir);
        Store::new(slug)
    }

    #[test]
    fn a_document_round_trips_through_the_store() {
        let store = scoped("atlastestroundtrip");
        assert_eq!(store.read::<Settings>("settings.json"), Settings::default());

        let settings = Settings { theme: "dark".into() };
        store.write("settings.json", &settings).unwrap();
        assert_eq!(store.read::<Settings>("settings.json"), settings);
    }

    #[test]
    fn removing_a_document_that_was_never_written_is_not_an_error() {
        let store = scoped("atlastestremove");
        assert!(store.remove("never.json").is_ok());
    }
}
