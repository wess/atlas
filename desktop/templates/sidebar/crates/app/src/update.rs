//! Self-update, wired to this repository's GitHub releases.
//!
//! guise owns the feature; this says which repository to watch and what a
//! genuine build of this app is signed with.

use atlas::shell::update::Update;

pub fn updater() -> Update {
    Update::github("__APPNAME__", env!("CARGO_PKG_VERSION"), "__APPREPO__")
    // The Developer ID team the release workflow notarizes under. Without it
    // guise refuses to execute a downloaded bundle and opens the release page
    // instead, so an app that ships signed builds and leaves this off has
    // quietly lost its own update path.
    //
    // .team_id("XXXXXXXXXX")
}
