//! [`Load`] — the three states a fetched list is actually in.
//!
//! An `Option<Vec<T>>` collapses two of them: a list that failed and a list
//! that has not arrived both read as `None`, and the view renders a spinner
//! over an error. Worse, `Some(vec![])` and a still-loading fetch look the
//! same to a `.is_empty()` check, so an empty table spins forever.

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Load<T> {
    Loading,
    Ready(T),
    Failed(String),
}

impl<T> Load<T> {
    /// The value, if the fetch finished successfully.
    pub fn ready(&self) -> Option<&T> {
        match self {
            Load::Ready(v) => Some(v),
            _ => None,
        }
    }

    pub fn is_loading(&self) -> bool {
        matches!(self, Load::Loading)
    }

    pub fn error(&self) -> Option<&str> {
        match self {
            Load::Failed(e) => Some(e),
            _ => None,
        }
    }

    /// Map the ready value, leaving the other two states alone.
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> Load<U> {
        match self {
            Load::Loading => Load::Loading,
            Load::Ready(v) => Load::Ready(f(v)),
            Load::Failed(e) => Load::Failed(e),
        }
    }
}

/// Hand-written rather than derived: `#[derive(Default)]` would add a
/// `T: Default` bound, and a list that has not loaded yet says nothing about
/// whether its element type has a default.
#[allow(clippy::derivable_impls)]
impl<T> Default for Load<T> {
    fn default() -> Self {
        Load::Loading
    }
}

/// `Result` is what an async call returns; `Load` is what a view renders. This
/// is the one conversion between them, so no view invents its own.
impl<T, E: std::fmt::Display> From<Result<T, E>> for Load<T> {
    fn from(result: Result<T, E>) -> Self {
        match result {
            Ok(v) => Load::Ready(v),
            Err(e) => Load::Failed(e.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_empty_result_is_ready_rather_than_loading() {
        // The bug this prevents: a table with no rows spinning forever because
        // the view checked `is_empty()` on an Option.
        let empty: Load<Vec<u8>> = Load::Ready(vec![]);
        assert!(!empty.is_loading());
        assert_eq!(empty.ready().map(Vec::len), Some(0));
    }

    #[test]
    fn a_failure_carries_its_reason_and_is_not_ready() {
        let failed: Load<Vec<u8>> = Load::Failed("connection refused".into());
        assert_eq!(failed.error(), Some("connection refused"));
        assert!(failed.ready().is_none());
        assert!(!failed.is_loading());
    }

    #[test]
    fn a_result_converts_without_the_caller_writing_the_match() {
        let ok: Load<u8> = Ok::<u8, std::io::Error>(3).into();
        assert_eq!(ok, Load::Ready(3));

        let err: Load<u8> = Err::<u8, _>(std::io::Error::other("boom")).into();
        assert_eq!(err.error(), Some("boom"));
    }

    #[test]
    fn mapping_leaves_loading_and_failed_alone() {
        assert_eq!(Load::Ready(2).map(|n| n * 2), Load::Ready(4));
        assert_eq!(Load::<u8>::Loading.map(|n| n * 2), Load::Loading);
        assert_eq!(Load::<u8>::Failed("x".into()).map(|n| n * 2).error(), Some("x"));
    }
}
