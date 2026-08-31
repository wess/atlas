//! The About card — what this build is, and where it came from.
//!
//! guise ships the card itself; this fills it in from the app's package
//! metadata and the [`atlas-build`](https://docs.rs/atlas-build) stamp, and
//! adds the three links every one of these ends up with.
//!
//! ```ignore
//! let card = atlasshell::about::Card::new("Hopper", env!("CARGO_PKG_VERSION"))
//!     .build(env!("BUILD_KIND"), env!("BUILD_DATE"))
//!     .tagline("Run containers without Docker Desktop.")
//!     .icon(IconName::Box)
//!     .repo("https://github.com/wess/hopper")
//!     .sponsor("https://github.com/sponsors/wess")
//!     .render();
//!
//! Sheet::new().title("About Hopper").width(420.0).child(card)
//! ```

use gpui::prelude::*;
use gpui::{div, px};
use guise::prelude::*;
use guise::{About, BuildKind};

/// `"released"` (what the release workflow stamps) or anything else.
pub fn kind(raw: &str) -> BuildKind {
    match raw {
        "released" => BuildKind::Released,
        _ => BuildKind::Development,
    }
}

pub struct Card {
    name: String,
    version: String,
    kind: BuildKind,
    date: String,
    tagline: Option<String>,
    credits: String,
    icon: Option<IconName>,
    repo: Option<String>,
    sponsor: Option<String>,
}

impl Card {
    pub fn new(name: impl Into<String>, version: impl Into<String>) -> Self {
        Card {
            name: name.into(),
            version: version.into(),
            kind: BuildKind::Development,
            date: String::new(),
            tagline: None,
            credits: "Built with gpui and guise.".into(),
            icon: None,
            repo: None,
            sponsor: None,
        }
    }

    /// The build stamp. Pass `env!("BUILD_KIND")` and `env!("BUILD_DATE")`.
    pub fn build(mut self, kind_env: &str, date: impl Into<String>) -> Self {
        self.kind = kind(kind_env);
        self.date = date.into();
        self
    }

    pub fn tagline(mut self, tagline: impl Into<String>) -> Self {
        self.tagline = Some(tagline.into());
        self
    }

    pub fn credits(mut self, credits: impl Into<String>) -> Self {
        self.credits = credits.into();
        self
    }

    pub fn icon(mut self, icon: IconName) -> Self {
        self.icon = Some(icon);
        self
    }

    /// The repository. Adds both the Source and the Report-an-issue links.
    pub fn repo(mut self, url: impl Into<String>) -> Self {
        self.repo = Some(url.into());
        self
    }

    pub fn sponsor(mut self, url: impl Into<String>) -> Self {
        self.sponsor = Some(url.into());
        self
    }

    /// The guise card, ready to drop into a [`Sheet`](crate::Sheet) or a page.
    pub fn render(self) -> About {
        let mut card = About::new(self.name)
            .version(self.version)
            .build(self.kind, self.date)
            .credits(self.credits);

        if let Some(tagline) = self.tagline {
            card = card.tagline(tagline);
        }
        if let Some(icon) = self.icon {
            card = card.icon(
                div()
                    .flex()
                    .items_center()
                    .justify_center()
                    .size(px(56.0))
                    .child(Icon::new(icon).size(Size::Xl)),
            );
        }
        if let Some(repo) = self.repo {
            let issues = format!("{}/issues", repo.trim_end_matches('/'));
            card = card
                .link(Anchor::new("about-repo", "Source").on_click(move |_, _, cx| cx.open_url(&repo)))
                .link(
                    Anchor::new("about-issues", "Report an issue")
                        .on_click(move |_, _, cx| cx.open_url(&issues)),
                );
        }
        if let Some(sponsor) = self.sponsor {
            card = card.link(
                Anchor::new("about-sponsor", "Sponsor")
                    .on_click(move |_, _, cx| cx.open_url(&sponsor)),
            );
        }
        card
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_release_workflows_stamp_counts_as_a_release() {
        assert_eq!(kind("released"), BuildKind::Released);
        // A local build, a CI build, a distro rebuild — all say what they are.
        assert_eq!(kind("development"), BuildKind::Development);
        assert_eq!(kind(""), BuildKind::Development);
    }
}
