//! The service facade the UI calls.
//!
//! Every operation the app can perform is a method here, and every one of them
//! is `async`. That is the seam: views never touch the store, a client, or a
//! child process directly — they dispatch through `atlas::bridge::run`, which
//! runs the future on tokio and delivers the result to the gpui main thread.
//!
//! Keeping it gpui-free is what makes the app's behavior testable without
//! opening a window, and what keeps UI concerns out of the part of the
//! codebase that outlives the UI framework.
//!
//! The disk work below runs on `spawn_blocking` rather than inline. Reading a
//! small JSON file is fast enough that it looks like pedantry — until the file
//! is on a network mount, or the app grows a real backend here, and a stalled
//! read has been holding a runtime worker the whole time.

use std::sync::{Arc, RwLock};

use model::{Item, Settings};
use store::Store;

pub struct Host {
    store: Store,
    /// The settings are read on almost every frame and written rarely, so the
    /// authoritative copy lives in memory and the file is the durable one.
    settings: RwLock<Settings>,
}

impl Host {
    pub fn new() -> Arc<Self> {
        let store = Store::new();
        let settings = store.settings();
        Arc::new(Host { store, settings: RwLock::new(settings) })
    }

    pub fn settings(&self) -> Settings {
        self.settings.read().expect("settings lock").clone()
    }

    pub fn save_settings(&self, settings: Settings) -> Result<(), String> {
        self.store.save_settings(&settings).map_err(|e| e.to_string())?;
        *self.settings.write().expect("settings lock") = settings;
        Ok(())
    }

    pub async fn items(&self) -> Result<Vec<Item>, String> {
        let store = self.store.clone();
        blocking(move || Ok(store.items())).await
    }

    pub async fn add(&self, name: String) -> Result<Item, String> {
        let store = self.store.clone();
        blocking(move || {
            let item = Item::new(name);
            let all = store::upsert(store.items(), item.clone());
            store.save_items(&all).map_err(|e| e.to_string())?;
            Ok(item)
        })
        .await
    }

    /// Flip an item's done flag. Returns the whole list, because that is what
    /// the view renders — handing back only the changed item makes every
    /// caller reimplement the merge.
    pub async fn toggle(&self, id: String) -> Result<Vec<Item>, String> {
        let store = self.store.clone();
        blocking(move || {
            let mut all = store.items();
            match all.iter_mut().find(|i| i.id == id) {
                Some(item) => item.done = !item.done,
                None => return Err(format!("no item {id}")),
            }
            store.save_items(&all).map_err(|e| e.to_string())?;
            Ok(all)
        })
        .await
    }

    pub async fn remove(&self, id: String) -> Result<Vec<Item>, String> {
        let store = self.store.clone();
        blocking(move || {
            let all = store::remove(store.items(), &id);
            store.save_items(&all).map_err(|e| e.to_string())?;
            Ok(all)
        })
        .await
    }
}

/// Run blocking work on tokio's blocking pool.
///
/// A panic in there is reported as an error rather than propagated: one bad
/// item must not take down the runtime and, with it, every other pending call.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    match tokio::task::spawn_blocking(work).await {
        Ok(result) => result,
        Err(e) => Err(format!("background task failed: {e}")),
    }
}
