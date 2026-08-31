//! The service facade the UI calls.
//!
//! Every operation the app can perform is a method here, and every one is
//! `async`. That is the seam: views never touch the store or a client
//! directly — they dispatch through `atlas::bridge::run`, which runs the
//! future on tokio and delivers the result to the gpui main thread.
//!
//! The *active project* cursor lives here rather than in the UI, because
//! "which project is open" decides what half these methods do, and a copy in
//! the view is a copy that can disagree.

use std::sync::{Arc, RwLock};

use model::{Entry, Project, Settings};
use store::Store;

pub struct Host {
    store: Store,
    settings: RwLock<Settings>,
    /// The open project, if any.
    active: RwLock<Option<Project>>,
}

impl Host {
    pub fn new() -> Arc<Self> {
        let store = Store::new();
        let settings = store.settings();
        Arc::new(Host {
            store,
            settings: RwLock::new(settings),
            active: RwLock::new(None),
        })
    }

    pub fn settings(&self) -> Settings {
        self.settings.read().expect("settings lock").clone()
    }

    pub fn save_settings(&self, settings: Settings) -> Result<(), String> {
        self.store.save_settings(&settings).map_err(|e| e.to_string())?;
        *self.settings.write().expect("settings lock") = settings;
        Ok(())
    }

    pub fn active(&self) -> Option<Project> {
        self.active.read().expect("active lock").clone()
    }

    pub async fn projects(&self) -> Result<Vec<Project>, String> {
        let store = self.store.clone();
        blocking(move || {
            let mut all = store.projects();
            model::by_recency(&mut all);
            Ok(all)
        })
        .await
    }

    pub async fn add(&self, name: String, path: String) -> Result<Vec<Project>, String> {
        let store = self.store.clone();
        blocking(move || {
            let all = store::upsert(store.projects(), Project::new(name, path));
            store.save_projects(&all).map_err(|e| e.to_string())?;
            Ok(sorted(all))
        })
        .await
    }

    /// Forget a project, and the secret that went with it. Leaving an orphan
    /// keychain entry behind is the kind of thing nobody notices until a
    /// security review.
    pub async fn forget(&self, id: String) -> Result<Vec<Project>, String> {
        let store = self.store.clone();
        blocking(move || {
            store.drop_secret(&id);
            let all = store::remove(store.projects(), &id);
            store.save_projects(&all).map_err(|e| e.to_string())?;
            Ok(sorted(all))
        })
        .await
    }

    /// Open a project: stamp its `opened` time and make it the active one.
    ///
    /// Replace the body with whatever opening actually means — connecting,
    /// scanning, loading. The signature is the part that matters: it is async,
    /// it can fail, and the failure reaches the user as a message rather than
    /// a panic.
    pub async fn open(&self, id: String) -> Result<Project, String> {
        let store = self.store.clone();
        let project = blocking(move || {
            let mut all = store.projects();
            let project = match all.iter_mut().find(|p| p.id == id) {
                Some(project) => {
                    project.opened = Some(atlas::core::iso_now());
                    project.clone()
                }
                None => return Err(format!("no project {id}")),
            };
            store.save_projects(&all).map_err(|e| e.to_string())?;
            Ok(project)
        })
        .await?;

        *self.active.write().expect("active lock") = Some(project.clone());
        Ok(project)
    }

    pub fn close(&self) {
        *self.active.write().expect("active lock") = None;
    }

    /// What the open project contains — the workspace sidebar's list.
    pub async fn entries(&self) -> Result<Vec<Entry>, String> {
        let Some(project) = self.active() else {
            return Err("no project is open".into());
        };
        blocking(move || {
            // Stand-in for the real work. Whatever replaces it belongs on this
            // side of the bridge, not in a view.
            Ok(vec![
                Entry { name: format!("{}.log", project.name), kind: "file".into(), size: 4_096 },
                Entry { name: "config".into(), kind: "folder".into(), size: 0 },
            ])
        })
        .await
    }
}

fn sorted(mut all: Vec<Project>) -> Vec<Project> {
    model::by_recency(&mut all);
    all
}

/// Run blocking work on tokio's blocking pool.
///
/// A panic in there is reported as an error rather than propagated: one bad
/// project must not take down the runtime and, with it, every other pending
/// call.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    match tokio::task::spawn_blocking(work).await {
        Ok(result) => result,
        Err(e) => Err(format!("background task failed: {e}")),
    }
}
