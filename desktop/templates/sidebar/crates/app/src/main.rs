//! __APPNAME__ — __APPDESC__
//!
//! `main` installs the theme, wires the menu bar, and opens the root window.
//! Everything else lives in the crates below `app`; the async layer is reached
//! through `atlas::bridge`.

mod root;
mod state;
mod update;
mod views;

use atlas::prelude::*;
use atlas::shell::actions::CheckForUpdates;
use gpui::{App, Application};
use guise::prelude::*;

fn main() {
    Application::new().run(|cx: &mut App| {
        // The host is built before the window so the theme can follow the
        // user's saved preference on the first frame rather than flashing the
        // default and correcting itself.
        let host = host::Host::new();
        let settings = host.settings();

        let scheme = if settings.dark() { ColorScheme::Dark } else { ColorScheme::Light };
        Scheme::new().build(scheme).init(cx);

        Chrome::new("__APPNAME__").docs("https://github.com/__APPREPO__").install(cx);
        cx.on_action::<CheckForUpdates>(|_, cx| update::updater().check_now(cx));
        if settings.auto_update {
            update::updater().start(cx);
        }

        MainWindow::versioned("__APPNAME__", env!("CARGO_PKG_VERSION"))
            .size(1240.0, 820.0)
            .min_size(880.0, 560.0)
            .open(cx, move |cx| root::Root::new(host, cx));
    });
}
