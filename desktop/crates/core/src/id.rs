//! Ids and timestamps, in the shapes the on-disk JSON already uses.

/// Now as `new Date().toISOString()` produces it: UTC with milliseconds.
///
/// The format matters because these strings sit in files an earlier build
/// wrote, and sort order is string order.
pub fn iso_now() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// A lowercase hyphenated UUID v4, like `crypto.randomUUID()`.
pub fn uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_are_utc_with_milliseconds() {
        let now = iso_now();
        assert_eq!(now.len(), 24, "{now}");
        assert!(now.ends_with('Z'));
        assert_eq!(&now[10..11], "T");
    }

    #[test]
    fn ids_are_lowercase_and_hyphenated() {
        let id = uuid();
        assert_eq!(id.len(), 36);
        assert_eq!(id.matches('-').count(), 4);
        assert_eq!(id, id.to_lowercase());
        assert_ne!(id, uuid());
    }
}
