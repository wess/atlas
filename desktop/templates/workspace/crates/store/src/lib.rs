//! Where the app's state lives: `~/.__APPSLUG__/`, one JSON document per
//! thing. `__APPENV___DIR` relocates it, which is how tests get a scratch
//! directory.
//!
//! A thin, *typed* layer over `atlas::store` — the document names and their
//! shapes are declared once, here, rather than as string literals scattered
//! through the app. gpui-free.

use atlas::store::{Paths, Store as Inner};
use model::{Project, Settings};

const SETTINGS: &str = "settings.json";
const PROJECTS: &str = "projects.json";

#[derive(Clone, Debug)]
pub struct Store {
    inner: Inner,
}

impl Default for Store {
    fn default() -> Self {
        Store::new()
    }
}

impl Store {
    pub fn new() -> Self {
        Store { inner: Inner::new("__APPSLUG__") }
    }

    pub fn paths(&self) -> &Paths {
        self.inner.paths()
    }

    pub fn settings(&self) -> Settings {
        self.inner.read(SETTINGS)
    }

    pub fn save_settings(&self, settings: &Settings) -> std::io::Result<()> {
        self.inner.write(SETTINGS, settings)
    }

    pub fn projects(&self) -> Vec<Project> {
        self.inner.read(PROJECTS)
    }

    pub fn save_projects(&self, projects: &[Project]) -> std::io::Result<()> {
        self.inner.write(PROJECTS, &projects)
    }

    /// A secret belonging to a project — a password, a token. These go to the
    /// OS keychain rather than into `projects.json`, so a synced or
    /// backed-up settings file never carries a credential.
    pub fn secret(&self, project_id: &str) -> Option<String> {
        self.inner.keychain().get(&format!("project.{project_id}"))
    }

    pub fn save_secret(&self, project_id: &str, secret: &str) -> bool {
        self.inner.keychain().put(&format!("project.{project_id}"), secret)
    }

    pub fn drop_secret(&self, project_id: &str) {
        self.inner.keychain().delete(&format!("project.{project_id}"));
    }
}

/// Add or replace by id, preserving order so the list does not reshuffle when
/// a project is edited.
pub fn upsert(mut all: Vec<Project>, project: Project) -> Vec<Project> {
    match all.iter_mut().find(|p| p.id == project.id) {
        Some(slot) => *slot = project,
        None => all.push(project),
    }
    all
}

pub fn remove(all: Vec<Project>, id: &str) -> Vec<Project> {
    all.into_iter().filter(|p| p.id != id).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(id: &str, name: &str) -> Project {
        Project { id: id.into(), ..Project::new(name, "/tmp") }
    }

    #[test]
    fn upsert_replaces_in_place_rather_than_duplicating() {
        let all = upsert(vec![project("a", "A"), project("b", "B")], project("a", "Renamed"));
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].name, "Renamed");
        // Order preserved, so an edit does not move the card under the cursor.
        assert_eq!(all[1].id, "b");
    }

    #[test]
    fn removing_an_unknown_id_is_a_no_op() {
        assert_eq!(remove(vec![project("a", "A")], "zzz").len(), 1);
    }

    #[test]
    fn a_round_trip_survives_the_disk() {
        let dir = std::env::temp_dir().join(format!("appstore{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        // Ask the paths for the variable name rather than spelling it out — a
        // test that guesses it wrong silently writes to the real
        // ~/.__APPSLUG__ and "passes".
        std::env::set_var(Paths::new("__APPSLUG__").env_var(), &dir);

        let store = Store::new();
        assert!(store.projects().is_empty());

        let projects = vec![project("a", "A")];
        store.save_projects(&projects).unwrap();
        assert_eq!(store.projects(), projects);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
