//! The app's record type. Replace this with whatever the app is actually
//! about — it is here so the list, the detail pane, and the store have
//! something real to move around.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub name: String,
    pub note: String,
    /// ISO 8601, UTC. A string rather than a timestamp because it is written
    /// into a file a human might read, and it sorts correctly as text.
    pub created: String,
    pub done: bool,
}

impl Item {
    pub fn new(name: impl Into<String>) -> Self {
        Item {
            id: atlas::core::uuid(),
            name: name.into(),
            note: String::new(),
            created: atlas::core::iso_now(),
            done: false,
        }
    }

    /// Whether this item matches a search box. Name and note together, because
    /// that is what a user types into one field and expects.
    pub fn matches(&self, query: &str) -> bool {
        let q = query.trim().to_lowercase();
        q.is_empty()
            || self.name.to_lowercase().contains(&q)
            || self.note.to_lowercase().contains(&q)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_empty_query_matches_everything() {
        assert!(Item::new("anything").matches("   "));
    }

    #[test]
    fn search_covers_the_note_as_well_as_the_name() {
        let mut item = Item::new("Deploy");
        item.note = "staging cluster".into();
        assert!(item.matches("deploy"));
        assert!(item.matches("CLUSTER"));
        assert!(!item.matches("production"));
    }

    #[test]
    fn every_item_gets_its_own_id() {
        assert_ne!(Item::new("a").id, Item::new("a").id);
    }
}
