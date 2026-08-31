//! The app's preferences, as they sit on disk.

use serde::{Deserialize, Serialize};

/// `default` on the container, not just the fields: a settings file written by
/// an older version is missing whatever was added since, and without this the
/// whole document fails to parse and the user silently loses every preference
/// they set.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// `"dark"` or `"light"`.
    pub theme: String,
    pub auto_update: bool,
    /// Reopen the last project on launch rather than landing on the home
    /// screen.
    pub restore_last: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { theme: "dark".into(), auto_update: true, restore_last: false }
    }
}

impl Settings {
    pub fn dark(&self) -> bool {
        self.theme != "light"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_document_from_an_older_version_keeps_what_it_does_carry() {
        let older: Settings = serde_json::from_str(r#"{"theme":"light"}"#).unwrap();
        assert_eq!(older.theme, "light");
        assert!(older.auto_update);
    }
}
