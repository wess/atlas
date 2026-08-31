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
    pub sidebar_collapsed: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: "dark".into(),
            auto_update: true,
            sidebar_collapsed: false,
        }
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
        // The key that did not exist yet falls back rather than failing the
        // whole parse.
        assert!(older.auto_update);
    }

    #[test]
    fn an_unknown_theme_reads_as_dark_rather_than_a_blank_window() {
        let odd = Settings { theme: "solarized".into(), ..Settings::default() };
        assert!(odd.dark());
    }
}
