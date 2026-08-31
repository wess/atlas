//! Self-update, wired to the app's GitHub releases.
//!
//! guise owns the whole feature — the release feed, the in-place install, the
//! prompt window. This says which repository to watch and what a genuine build
//! of this app is signed with, which is all an app should have to decide.
//!
//! ```no_run
//! # use gpui::App;
//! use atlasshell::update::Update;
//!
//! fn updater() -> Update {
//!     Update::github("Hopper", env!("CARGO_PKG_VERSION"), "wess/hopper")
//!         .team_id("XJDC46F35X")
//! }
//!
//! # fn go(cx: &mut App) {
//! updater().start(cx);      // at launch, then hourly — behind the user's preference
//! updater().check_now(cx);  // the "Check for Updates…" menu item
//! # }
//! ```
//!
//! The codesign requirement is what makes an unattended install safe. Without
//! one guise refuses to execute a downloaded bundle and opens the release page
//! instead — so an app that ships notarized builds and forgets to set
//! [`team_id`](Update::team_id) silently loses its own update path.

use gpui::App;
use guise::update::{self, Updater};

#[derive(Clone, Debug)]
pub struct Update {
    name: String,
    version: String,
    repo: String,
    team_id: Option<String>,
}

impl Update {
    /// Releases come from `owner/repo` — the same repository the release
    /// workflow publishes to.
    pub fn github(
        name: impl Into<String>,
        version: impl Into<String>,
        repo: impl Into<String>,
    ) -> Self {
        Update { name: name.into(), version: version.into(), repo: repo.into(), team_id: None }
    }

    /// The Developer ID team the release workflow signs and notarizes under. A
    /// downloaded bundle that does not satisfy it is never executed, so a DMG
    /// served from anywhere else fails the check rather than running.
    pub fn team_id(mut self, team_id: impl Into<String>) -> Self {
        self.team_id = Some(team_id.into());
        self
    }

    pub fn updater(&self) -> Updater {
        let updater = Updater::github(self.name.clone(), self.version.clone(), self.repo.clone());
        match &self.team_id {
            Some(team) => updater.codesign_requirement(format!(
                "anchor apple generic and certificate leaf[subject.OU] = {team}"
            )),
            None => updater,
        }
    }

    /// Start the launch-and-hourly check. Call once, behind the user's
    /// preference — guise itself guards against being started twice.
    pub fn start(&self, cx: &mut App) {
        update::start(self.updater(), cx);
    }

    /// Check now, from the menu. Always answers: the prompt when there is
    /// something to install, a short notice saying why not when there isn't.
    pub fn check_now(&self, cx: &mut App) {
        update::check_now(self.updater(), cx);
    }
}
