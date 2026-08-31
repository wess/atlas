//! App-owned secrets, kept in the OS keychain.
//!
//! One service per app, one entry per key. The value is whatever the caller
//! stores; [`Keychain::put_json`] serializes a document into a single entry,
//! which is how a whole map of credentials lives under one key.
//!
//! **Stored values must stay newline-free.** The macOS keychain returns a
//! value containing a newline hex-encoded, which silently corrupts it on read
//! — so every document is written as single-line JSON, and that is asserted
//! rather than assumed.
//!
//! Every operation degrades to `None`/`false` rather than panicking. A machine
//! with no keychain (a headless Linux box with no secret service running) must
//! still start the app; it just cannot remember a password.

use serde::de::DeserializeOwned;
use serde::Serialize;

#[derive(Clone, Debug)]
pub struct Keychain {
    service: String,
}

impl Keychain {
    pub fn new(service: impl Into<String>) -> Self {
        Keychain { service: service.into() }
    }

    pub fn service(&self) -> &str {
        &self.service
    }

    fn entry(&self, key: &str) -> Option<keyring::Entry> {
        match keyring::Entry::new(&self.service, key) {
            Ok(entry) => Some(entry),
            Err(e) => {
                tracing::warn!("keychain unavailable for {key}: {e}");
                None
            }
        }
    }

    /// The stored value, or `None` when there is no entry — or no keychain.
    pub fn get(&self, key: &str) -> Option<String> {
        match self.entry(key)?.get_password() {
            Ok(v) => Some(v),
            Err(keyring::Error::NoEntry) => None,
            Err(e) => {
                tracing::warn!("keychain read failed for {key}: {e}");
                None
            }
        }
    }

    /// Store a value. Returns whether it landed.
    pub fn put(&self, key: &str, value: &str) -> bool {
        let Some(entry) = self.entry(key) else { return false };
        if let Err(e) = entry.set_password(value) {
            tracing::warn!("keychain write failed for {key}: {e}");
            return false;
        }
        true
    }

    /// Remove an entry. A key that was never stored is not an error.
    pub fn delete(&self, key: &str) {
        let Some(entry) = self.entry(key) else { return };
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => tracing::warn!("keychain delete failed for {key}: {e}"),
        }
    }

    /// Read a JSON document. A value that no longer parses is treated as
    /// absent — the shape of a stored secret changes between versions, and a
    /// stale one must not stop the app.
    pub fn get_json<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        serde_json::from_str(&self.get(key)?).ok()
    }

    /// Store a JSON document as a single line.
    pub fn put_json<T: Serialize>(&self, key: &str, value: &T) -> bool {
        match single_line(value) {
            Some(raw) => self.put(key, &raw),
            None => false,
        }
    }
}

/// Serialize without newlines. `serde_json::to_string` never emits them, but
/// this is load-bearing enough on macOS to assert rather than assume.
fn single_line<T: Serialize>(value: &T) -> Option<String> {
    let s = serde_json::to_string(value).ok()?;
    debug_assert!(!s.contains('\n'), "keychain values must be newline-free");
    Some(s.replace('\n', ""))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use std::collections::BTreeMap;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct Cred {
        username: String,
        secret: String,
    }

    // The keychain itself is not exercised here: a unit test that writes to
    // the login keychain prompts on macOS and fails on a headless runner. What
    // is testable — and what actually broke in production — is the encoding.
    #[test]
    fn stored_documents_serialize_to_a_single_line() {
        let mut doc = BTreeMap::new();
        doc.insert(
            "https://index.docker.io/v1/".to_string(),
            Cred { username: "someone".into(), secret: "a\nsecret\nwith\nnewlines".into() },
        );

        let raw = single_line(&doc).unwrap();
        assert!(
            !raw.contains('\n'),
            "a newline here is hex-encoded by the macOS keychain and corrupts the value"
        );

        // The escaped form still round-trips.
        let back: BTreeMap<String, Cred> = serde_json::from_str(&raw).unwrap();
        assert_eq!(back, doc);
    }

    #[test]
    fn the_service_defaults_follow_the_app() {
        assert_eq!(Keychain::new("io.wess.hopper").service(), "io.wess.hopper");
    }
}
