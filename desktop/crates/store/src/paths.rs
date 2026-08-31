//! Where an app keeps its state on disk.
//!
//! Everything lives under one directory so a user can back it up, inspect it,
//! or delete it in a single move — and so an uninstall has one thing to name.
//! `<SLUG>_DIR` overrides the root, which is how tests get a scratch
//! directory without stubbing the filesystem.

use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct Paths {
    slug: String,
}

impl Paths {
    pub fn new(slug: &str) -> Self {
        Paths { slug: slug.to_string() }
    }

    /// The environment variable that overrides the root: `HOPPER_DIR` for
    /// `hopper`.
    pub fn env_var(&self) -> String {
        format!("{}_DIR", self.slug.to_uppercase())
    }

    /// `$<SLUG>_DIR`, else `~/.<slug>`, else `./.<slug>` when there is no home
    /// directory to speak of.
    pub fn root(&self) -> PathBuf {
        if let Ok(dir) = std::env::var(self.env_var()) {
            if !dir.trim().is_empty() {
                return PathBuf::from(dir);
            }
        }
        dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(format!(".{}", self.slug))
    }

    /// A document directly under the root.
    pub fn file(&self, name: &str) -> PathBuf {
        self.root().join(name)
    }

    /// A subdirectory of the root, created if it does not exist.
    pub fn dir(&self, name: &str) -> std::io::Result<PathBuf> {
        let dir = self.root().join(name);
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    /// The app's log file.
    pub fn log_file(&self) -> PathBuf {
        self.file(&format!("{}.log", self.slug))
    }

    /// Create the root (and any parents) if it does not exist yet.
    pub fn ensure_root(&self) -> std::io::Result<PathBuf> {
        let dir = self.root();
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    /// Whether `path` sits inside the root. Anything the app writes on a
    /// user-supplied name should be checked with this first.
    pub fn contains(&self, path: &Path) -> bool {
        path.starts_with(self.root())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_override_variable_follows_the_slug() {
        assert_eq!(Paths::new("hopper").env_var(), "HOPPER_DIR");
    }

    #[test]
    fn every_path_sits_under_the_root() {
        let paths = Paths::new("atlaspathtest");
        let root = paths.root();
        for p in [paths.file("settings.json"), paths.log_file()] {
            assert!(paths.contains(&p), "{p:?} escaped {root:?}");
        }
    }

    #[test]
    fn an_empty_override_falls_back_rather_than_writing_to_the_cwd() {
        // An unset variable and one set to "" must behave the same; a shell
        // that exports an empty value should not redirect the app's state to
        // whatever directory it happened to launch from.
        std::env::set_var("ATLASEMPTY_DIR", "   ");
        let root = Paths::new("atlasempty").root();
        assert!(root.ends_with(".atlasempty"), "{root:?}");
    }
}
