//! The actions every desktop app has, in one namespace.
//!
//! These are declared here rather than in each app because the standard menu
//! bar has to name them: a `Quit` the shell defines and a `Quit` the app
//! defines are different types, and the menu would dispatch one while the app
//! handled the other. Anything specific to the app gets its own with the
//! [`actions!`](crate::actions) macro.
//!
//! ```ignore
//! atlasshell::actions!(hopper, [NewContainer, PruneImages]);
//! ```

/// Declare a batch of gpui actions in one namespace.
///
/// The expansion is what every app was already writing by hand: a unit struct
/// per action, deriving `gpui::Action` with the app's namespace and no JSON
/// payload. It requires `gpui` as a direct dependency of the calling crate.
#[macro_export]
macro_rules! actions {
    ($ns:ident, [$($name:ident),* $(,)?]) => {
        $(
            #[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
            #[action(namespace = $ns, no_json)]
            pub struct $name;
        )*
    };
}

macro_rules! standard {
    ($($name:ident),* $(,)?) => {
        $(
            #[derive(Clone, PartialEq, Default, Debug, gpui::Action)]
            #[action(namespace = atlas, no_json)]
            pub struct $name;
        )*
    };
}

standard!(
    Quit,
    Hide,
    HideOthers,
    ShowAll,
    ShowAbout,
    CheckForUpdates,
    OpenSettings,
    ShowDocs,
    Refresh,
);

// The edit-menu actions carry an OS role (see `menu`), so they integrate with
// whatever text field has focus. The app dispatches no handler for them — the
// inputs handle the clipboard through their own keybindings — but the menu
// still needs the types.
standard!(Cut, Copy, Paste, SelectAll);
