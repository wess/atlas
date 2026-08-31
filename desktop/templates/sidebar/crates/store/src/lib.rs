//! Where the app's state lives: `~/.__APPSLUG__/`, one JSON document per
//! thing. `__APPENV___DIR` relocates it, which is how tests get a scratch
//! directory.
//!
//! This is a thin, *typed* layer over `atlas::store` — the point is that the
//! document names and their shapes are declared once, here, rather than as
//! string literals scattered through the app. gpui-free.

use atlas::store::{Paths, Store as Inner};
use model::{Item, Settings};

const SETTINGS: &str = "settings.json";
const ITEMS: &str = "items.json";

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

    pub fn items(&self) -> Vec<Item> {
        self.inner.read(ITEMS)
    }

    pub fn save_items(&self, items: &[Item]) -> std::io::Result<()> {
        self.inner.write(ITEMS, &items)
    }
}

/// Add or replace by id, preserving order so the list does not reshuffle when
/// something is edited.
pub fn upsert(mut all: Vec<Item>, item: Item) -> Vec<Item> {
    match all.iter_mut().find(|i| i.id == item.id) {
        Some(slot) => *slot = item,
        None => all.push(item),
    }
    all
}

pub fn remove(all: Vec<Item>, id: &str) -> Vec<Item> {
    all.into_iter().filter(|i| i.id != id).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, name: &str) -> Item {
        Item { id: id.into(), ..Item::new(name) }
    }

    #[test]
    fn upsert_appends_something_new() {
        let all = upsert(vec![], item("a", "A"));
        assert_eq!(all.len(), 1);
    }

    #[test]
    fn upsert_replaces_in_place_rather_than_duplicating() {
        let all = upsert(vec![item("a", "A"), item("b", "B")], item("a", "Renamed"));
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].name, "Renamed");
        // Order preserved, so an edit does not move the row under the cursor.
        assert_eq!(all[1].id, "b");
    }

    #[test]
    fn removing_an_unknown_id_is_a_no_op() {
        assert_eq!(remove(vec![item("a", "A")], "zzz").len(), 1);
    }

    #[test]
    fn a_round_trip_survives_the_disk() {
        let dir = std::env::temp_dir().join(format!("appstore{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        // Ask the paths for the variable name rather than spelling it out — a
        // test that guesses it wrong silently writes to the real ~/.__APPSLUG__
        // and "passes".
        std::env::set_var(Paths::new("__APPSLUG__").env_var(), &dir);

        let store = Store::new();
        assert!(store.items().is_empty());

        let items = vec![item("a", "A")];
        store.save_items(&items).unwrap();
        assert_eq!(store.items(), items);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
