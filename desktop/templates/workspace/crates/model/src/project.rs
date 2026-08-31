//! A **project** is the thing the app opens: the unit the home screen lists
//! and the workspace is a view onto. Replace it with whatever this app opens —
//! a database connection, a repository, a document.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    /// Where it lives. A string rather than a `PathBuf` because it is written
    /// into a JSON file and read back on a different platform.
    pub path: String,
    /// ISO 8601, UTC.
    pub created: String,
    /// When it was last opened, so the home screen can lead with it. `None`
    /// until it has been opened once — which is not the same as "opened at the
    /// epoch".
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub opened: Option<String>,
}

impl Project {
    pub fn new(name: impl Into<String>, path: impl Into<String>) -> Self {
        Project {
            id: atlas::core::uuid(),
            name: name.into(),
            path: path.into(),
            created: atlas::core::iso_now(),
            opened: None,
        }
    }

    pub fn matches(&self, query: &str) -> bool {
        let q = query.trim().to_lowercase();
        q.is_empty()
            || self.name.to_lowercase().contains(&q)
            || self.path.to_lowercase().contains(&q)
    }
}

/// Most-recently-opened first, then never-opened by name.
///
/// The two groups are ranked by different things, which is why this is a
/// function with a test rather than a one-line `sort_by_key`.
pub fn by_recency(projects: &mut [Project]) {
    projects.sort_by(|a, b| match (&a.opened, &b.opened) {
        (Some(x), Some(y)) => y.cmp(x),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opened(name: &str, at: Option<&str>) -> Project {
        Project { opened: at.map(str::to_string), ..Project::new(name, "/tmp") }
    }

    #[test]
    fn opened_projects_lead_newest_first() {
        let mut all = vec![
            opened("old", Some("2026-01-01T00:00:00.000Z")),
            opened("new", Some("2026-08-01T00:00:00.000Z")),
        ];
        by_recency(&mut all);
        assert_eq!(all[0].name, "new");
    }

    #[test]
    fn a_project_never_opened_sorts_after_every_one_that_has_been() {
        let mut all = vec![opened("aaa", None), opened("zzz", Some("2020-01-01T00:00:00.000Z"))];
        by_recency(&mut all);
        assert_eq!(all[0].name, "zzz");
    }

    #[test]
    fn unopened_projects_fall_back_to_name_order() {
        let mut all = vec![opened("Zebra", None), opened("apple", None)];
        by_recency(&mut all);
        assert_eq!(all[0].name, "apple");
    }

    #[test]
    fn search_covers_the_path_as_well_as_the_name() {
        let project = Project::new("Reports", "/srv/analytics/reports.db");
        assert!(project.matches("reports"));
        assert!(project.matches("ANALYTICS"));
        assert!(!project.matches("staging"));
    }
}
