//! Display formatting.
//!
//! Pure, so the rounding and pluralization rules that are easy to get subtly
//! wrong are pinned by tests rather than eyeballed in the running UI.

/// Human byte sizes in binary units. A negative value means "unknown", which
/// is not the same as zero and must not render as `0 B`.
pub fn bytes(n: i64) -> String {
    if n < 0 {
        return "—".into();
    }
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    let mut value = n as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{n} B")
    } else if value >= 10.0 {
        // Ten or more of a unit does not need a tenth to be useful.
        format!("{value:.0} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

/// A compact count: 968 → "968", 21340 → "21.3k", 2_100_000 → "2.1M".
pub fn count(n: i64) -> String {
    match n {
        n if n < 0 => "—".into(),
        n if n < 1_000 => n.to_string(),
        n if n < 1_000_000 => format!("{:.1}k", n as f64 / 1_000.0),
        n => format!("{:.1}M", n as f64 / 1_000_000.0),
    }
}

/// A coarse relative time from a unix-seconds timestamp.
pub fn ago(unix_seconds: i64) -> String {
    if unix_seconds <= 0 {
        return "unknown".into();
    }
    let secs = (chrono::Utc::now().timestamp() - unix_seconds).max(0);
    match secs {
        s if s < 60 => "just now".into(),
        s if s < 3_600 => plural(s / 60, "minute"),
        s if s < 86_400 => plural(s / 3_600, "hour"),
        s if s < 2_592_000 => plural(s / 86_400, "day"),
        s if s < 31_536_000 => plural(s / 2_592_000, "month"),
        s => plural(s / 31_536_000, "year"),
    }
}

/// An elapsed duration, for a job that is still running: "4.2s", "1m 12s".
pub fn duration(secs: u64) -> String {
    match secs {
        s if s < 60 => format!("{s}s"),
        s if s < 3_600 => format!("{}m {}s", s / 60, s % 60),
        s => format!("{}h {}m", s / 3_600, (s % 3_600) / 60),
    }
}

/// Shorten to `max` characters with a trailing ellipsis, counting characters
/// rather than bytes so a multi-byte string does not panic on a slice.
pub fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let head: String = text.chars().take(max.saturating_sub(1)).collect();
    format!("{head}…")
}

fn plural(n: i64, unit: &str) -> String {
    if n == 1 {
        format!("1 {unit} ago")
    } else {
        format!("{n} {unit}s ago")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn byte_sizes_use_binary_units() {
        assert_eq!(bytes(0), "0 B");
        assert_eq!(bytes(512), "512 B");
        assert_eq!(bytes(1024), "1.0 KB");
        assert_eq!(bytes(1536), "1.5 KB");
        assert_eq!(bytes(142 * 1024 * 1024), "142 MB");
        assert_eq!(bytes(2 * 1024 * 1024 * 1024), "2.0 GB");
    }

    #[test]
    fn an_unknown_size_is_not_rendered_as_zero() {
        assert_eq!(bytes(-1), "—");
        assert_eq!(count(-1), "—");
    }

    #[test]
    fn counts_are_compact() {
        assert_eq!(count(968), "968");
        assert_eq!(count(21_340), "21.3k");
        assert_eq!(count(2_100_000), "2.1M");
    }

    #[test]
    fn relative_times_are_singular_at_one() {
        let now = chrono::Utc::now().timestamp();
        assert_eq!(ago(now - 30), "just now");
        assert_eq!(ago(now - 60), "1 minute ago");
        assert_eq!(ago(now - 120), "2 minutes ago");
        assert_eq!(ago(now - 86_400), "1 day ago");
    }

    #[test]
    fn a_missing_timestamp_says_so_rather_than_claiming_1970() {
        assert_eq!(ago(0), "unknown");
        assert_eq!(ago(-5), "unknown");
    }

    #[test]
    fn a_clock_skewed_future_timestamp_does_not_render_negatively() {
        assert_eq!(ago(chrono::Utc::now().timestamp() + 10_000), "just now");
    }

    #[test]
    fn durations_grow_units_as_they_get_long() {
        assert_eq!(duration(9), "9s");
        assert_eq!(duration(72), "1m 12s");
        assert_eq!(duration(3_780), "1h 3m");
    }

    #[test]
    fn truncation_counts_characters_not_bytes() {
        assert_eq!(truncate("short", 10), "short");
        assert_eq!(truncate("abcdefghij", 5), "abcd…");
        // A byte slice here would panic mid-character.
        assert_eq!(truncate("ñññññññ", 3), "ññ…");
    }
}
