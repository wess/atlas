//! Reading and writing the JSON documents under the app's root.
//!
//! Writes go to a temporary file in the same directory and are renamed into
//! place, so a crash mid-write leaves the previous document intact rather than
//! a truncated one. A settings file the user cannot load is a support ticket;
//! a settings file that lost the last change is a shrug.

use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::Path;

/// Read and decode a document, falling back to the default when it is missing
/// or unreadable.
///
/// A corrupt file is backed up rather than deleted — it may be the only copy
/// of something the user typed, and silently discarding it is worse than an
/// unexplained extra file.
pub fn read_or_default<T: DeserializeOwned + Default>(path: &Path) -> T {
    let Ok(text) = std::fs::read_to_string(path) else {
        return T::default();
    };
    match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("{} is not valid JSON ({e}); backing it up", path.display());
            let _ = std::fs::rename(path, path.with_extension("json.corrupt"));
            T::default()
        }
    }
}

/// Read and decode a document, distinguishing "missing" from "unreadable".
/// Use this where the difference changes what the app does; [`read_or_default`]
/// where it does not.
pub fn read<T: DeserializeOwned>(path: &Path) -> std::io::Result<Option<T>> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e),
    };
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
}

/// Write a document atomically, creating parent directories as needed.
pub fn write<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(value)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

    // Same directory, so the rename is atomic — a temp file in /tmp is often
    // on another filesystem and the rename degrades to a copy.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, text.as_bytes())?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
    struct Doc {
        name: String,
        count: u32,
    }

    fn tmpdir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("atlasjson{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_missing_file_reads_as_the_default() {
        let path = tmpdir().join("missing.json");
        let _ = std::fs::remove_file(&path);
        assert_eq!(read_or_default::<Doc>(&path), Doc::default());
        assert!(read::<Doc>(&path).unwrap().is_none());
    }

    #[test]
    fn a_document_round_trips() {
        let path = tmpdir().join("roundtrip.json");
        let doc = Doc { name: "shop".into(), count: 3 };
        write(&path, &doc).unwrap();
        assert_eq!(read_or_default::<Doc>(&path), doc);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn a_corrupt_file_is_backed_up_rather_than_lost() {
        let path = tmpdir().join("corrupt.json");
        let backup = path.with_extension("json.corrupt");
        let _ = std::fs::remove_file(&backup);
        std::fs::write(&path, b"{not json").unwrap();

        assert_eq!(read_or_default::<Doc>(&path), Doc::default());
        assert!(backup.exists(), "the unreadable document should be kept");
        assert_eq!(std::fs::read_to_string(&backup).unwrap(), "{not json");
        let _ = std::fs::remove_file(&backup);
    }

    #[test]
    fn the_strict_read_reports_corruption_instead_of_swallowing_it() {
        let path = tmpdir().join("strict.json");
        std::fs::write(&path, b"{not json").unwrap();
        assert!(read::<Doc>(&path).is_err());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn writing_creates_missing_parent_directories() {
        let nested = tmpdir().join("nested");
        let _ = std::fs::remove_dir_all(&nested);
        let path = nested.join("deep").join("doc.json");
        write(&path, &Doc::default()).unwrap();
        assert!(path.exists());
        let _ = std::fs::remove_dir_all(&nested);
    }

    #[test]
    fn no_temporary_file_survives_a_successful_write() {
        let path = tmpdir().join("clean.json");
        write(&path, &Doc::default()).unwrap();
        assert!(!path.with_extension("json.tmp").exists());
        let _ = std::fs::remove_file(&path);
    }
}
