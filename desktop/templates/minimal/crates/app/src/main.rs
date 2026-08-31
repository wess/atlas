//! __APPNAME__ — __APPDESC__
//!
//! One window. `main` installs the theme, wires the menu bar, and opens the
//! root view; `root` is the whole UI.
//!
//! When this grows a second surface, add a nav rail and a `Route` enum — see
//! the `sidebar` template. When it grows an async backend, add a `host` crate
//! and dispatch through `atlas::bridge::run`.

mod root;
mod state;
mod update;

use atlas::prelude::*;
use atlas::shell::actions::CheckForUpdates;
use gpui::{App, Application};
use guise::prelude::*;

fn main() {
    Application::new().run(|cx: &mut App| {
        // The store is read before the window opens so the theme can follow
        // the saved preference on the first frame rather than flashing the
        // default and correcting itself.
        let store = store::Store::new();
        let settings = store.settings();

        let scheme = if settings.dark() { ColorScheme::Dark } else { ColorScheme::Light };
        Scheme::new().build(scheme).init(cx);

        Chrome::new("__APPNAME__").docs("https://github.com/__APPREPO__").install(cx);
        cx.on_action::<CheckForUpdates>(|_, cx| update::updater().check_now(cx));
        if settings.auto_update {
            update::updater().start(cx);
        }

        MainWindow::versioned("__APPNAME__", env!("CARGO_PKG_VERSION"))
            .size(900.0, 640.0)
            .min_size(560.0, 400.0)
            .open(cx, move |cx| root::Root::new(store, cx));
    });
}
