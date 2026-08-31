//! The native menu bar.
//!
//! [`Chrome`] builds the four menus that are the same in every app —
//! Application, Edit, View, Help — installs their keybindings, and handles the
//! four actions that belong to the OS rather than to the app (quit, hide, hide
//! others, show all). What is left for the app is what is actually its own:
//! [`OpenSettings`](crate::actions::OpenSettings),
//! [`ShowAbout`](crate::actions::ShowAbout),
//! [`Refresh`](crate::actions::Refresh), and any menus it adds.
//!
//! ```no_run
//! # use gpui::App;
//! use atlasshell::menu::{item, menu, Chrome};
//! use atlasshell::actions::Refresh;
//!
//! # fn go(cx: &mut App) {
//! Chrome::new("Hopper")
//!     .docs("https://github.com/wess/hopper")
//!     .menu(menu("Container", vec![item("Refresh", Refresh)]))
//!     .install(cx);
//! # }
//! ```
//!
//! One thing to know, because it looks like a bug in the menu bar and is not:
//! **gpui dispatches an action along the focus path.** An action handled on an
//! element is unreachable while nothing is focused, which greys out the item
//! and swallows its shortcut. See [`crate::focus`].

use gpui::{App, KeyBinding, Menu, MenuItem, OsAction, SharedString};

use crate::actions::{
    CheckForUpdates, Copy, Cut, Hide, HideOthers, OpenSettings, Paste, Quit, Refresh, SelectAll,
    ShowAbout, ShowAll, ShowDocs,
};

/// A menu with a static name.
pub fn menu(name: impl Into<SharedString>, items: Vec<MenuItem>) -> Menu {
    Menu { name: name.into(), items }
}

/// A menu item that dispatches an action.
pub fn item(name: impl Into<SharedString>, action: impl gpui::Action) -> MenuItem {
    MenuItem::action(name, action)
}

pub fn separator() -> MenuItem {
    MenuItem::separator()
}

/// The standard menu bar and the wiring behind it.
pub struct Chrome {
    name: String,
    docs: Option<String>,
    extra: Vec<Menu>,
    keys: Vec<KeyBinding>,
}

impl Chrome {
    pub fn new(name: impl Into<String>) -> Self {
        Chrome { name: name.into(), docs: None, extra: Vec::new(), keys: Vec::new() }
    }

    /// Where Help → Documentation goes. Without one the item is omitted rather
    /// than opening nothing.
    pub fn docs(mut self, url: impl Into<String>) -> Self {
        self.docs = Some(url.into());
        self
    }

    /// An app-specific menu, placed between Edit and View in the order added.
    pub fn menu(mut self, menu: Menu) -> Self {
        self.extra.push(menu);
        self
    }

    /// An extra keybinding, installed alongside the standard ones.
    pub fn key(mut self, binding: KeyBinding) -> Self {
        self.keys.push(binding);
        self
    }

    /// The assembled menu bar, if you would rather call `cx.set_menus` yourself.
    pub fn menus(self) -> Vec<Menu> {
        let Chrome { name, docs, extra, .. } = self;
        let mut menus = vec![app_menu(&name), edit_menu()];
        menus.extend(extra);
        menus.push(view_menu());
        if docs.is_some() {
            menus.push(help_menu());
        }
        menus
    }

    /// Install everything: the menu bar, the standard keybindings, and
    /// handlers for the actions that belong to the OS.
    pub fn install(self, cx: &mut App) {
        let docs = self.docs.clone();
        let mut keys = standard_keys();
        keys.extend(self.keys.iter().cloned());

        cx.bind_keys(keys);
        cx.set_menus(self.menus());

        cx.on_action::<Quit>(|_, cx| cx.quit());
        cx.on_action::<Hide>(|_, cx| cx.hide());
        cx.on_action::<HideOthers>(|_, cx| cx.hide_other_apps());
        cx.on_action::<ShowAll>(|_, cx| cx.unhide_other_apps());
        if let Some(url) = docs {
            cx.on_action::<ShowDocs>(move |_, cx| cx.open_url(&url));
        }
    }
}

/// The application menu: About, updates, settings, hide, quit.
pub fn app_menu(name: &str) -> Menu {
    menu(
        SharedString::from(name.to_string()),
        vec![
            item(format!("About {name}"), ShowAbout),
            item("Check for Updates…", CheckForUpdates),
            separator(),
            item("Settings…", OpenSettings),
            separator(),
            item(format!("Hide {name}"), Hide),
            item("Hide Others", HideOthers),
            item("Show All", ShowAll),
            separator(),
            item(format!("Quit {name}"), Quit),
        ],
    )
}

/// The edit menu. Every item carries its OS role, so the platform routes it to
/// the focused text field instead of the app having to.
pub fn edit_menu() -> Menu {
    menu(
        "Edit",
        vec![
            MenuItem::os_action("Cut", Cut, OsAction::Cut),
            MenuItem::os_action("Copy", Copy, OsAction::Copy),
            MenuItem::os_action("Paste", Paste, OsAction::Paste),
            MenuItem::os_action("Select All", SelectAll, OsAction::SelectAll),
        ],
    )
}

pub fn view_menu() -> Menu {
    menu("View", vec![item("Refresh", Refresh)])
}

pub fn help_menu() -> Menu {
    menu("Help", vec![item("Documentation", ShowDocs)])
}

/// The keybindings that come with the standard menus.
pub fn standard_keys() -> Vec<KeyBinding> {
    vec![
        KeyBinding::new("cmd-q", Quit, None),
        KeyBinding::new("cmd-h", Hide, None),
        KeyBinding::new("alt-cmd-h", HideOthers, None),
        KeyBinding::new("cmd-,", OpenSettings, None),
        KeyBinding::new("cmd-r", Refresh, None),
    ]
}
