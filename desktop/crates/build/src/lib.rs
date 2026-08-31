//! Build metadata for the About card.
//!
//! Two facts a binary cannot work out at runtime: the day it was built, and
//! whether it is *the* build of its version or just some checkout carrying
//! that number. Printing "Released 2026-08-21" on a developer's local build is
//! a small lie that costs a bug report, so the release workflow — and nothing
//! else — sets `<PREFIX>_RELEASE=1`.
//!
//! In `crates/app/build.rs`:
//!
//! ```no_run
//! // crates/app/build.rs
//! atlasbuild::stamp("HOPPER");
//! ```
//!
//! and in the app: `env!("BUILD_DATE")` and `env!("BUILD_KIND")`
//! (`"released"` or `"development"`).

use std::process::Command;

/// Emit `BUILD_DATE` and `BUILD_KIND` for the crate being built.
///
/// `prefix` is the app's env-var prefix — `stamp("HOPPER")` watches
/// `HOPPER_RELEASE`.
pub fn stamp(prefix: &str) {
    let release_var = format!("{prefix}_RELEASE");
    println!("cargo:rerun-if-env-changed={release_var}");
    println!("cargo:rerun-if-env-changed=SOURCE_DATE_EPOCH");

    println!("cargo:rustc-env=BUILD_DATE={}", build_date());

    let released = std::env::var(&release_var).is_ok_and(|v| v == "1");
    println!("cargo:rustc-env=BUILD_KIND={}", if released { "released" } else { "development" });
}

/// The build date as `YYYY-MM-DD`, or `unknown` when there is nothing to ask.
///
/// `SOURCE_DATE_EPOCH` first, so a reproducible build stamps the source date
/// rather than the day the rebuild happened. `date` is the fallback; if that
/// is missing too the About card reads "Development build" with no date, which
/// is the honest answer rather than a wrong one.
pub fn build_date() -> String {
    if let Ok(epoch) = std::env::var("SOURCE_DATE_EPOCH") {
        if let Ok(secs) = epoch.parse::<i64>() {
            return utc_date(secs);
        }
    }

    Command::new("date")
        .args(["-u", "+%Y-%m-%d"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Civil date from a Unix timestamp, by Howard Hinnant's `civil_from_days`.
/// Only whole days matter here, so this needs no timezone database.
pub fn utc_date(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_epoch_and_a_few_known_days_convert() {
        assert_eq!(utc_date(0), "1970-01-01");
        assert_eq!(utc_date(1_000_000_000), "2001-09-09");
        // A leap day, which is where a hand-rolled calendar goes wrong.
        assert_eq!(utc_date(1_709_164_800), "2024-02-29");
    }

    #[test]
    fn dates_before_the_epoch_do_not_wrap() {
        assert_eq!(utc_date(-86_400), "1969-12-31");
    }
}
