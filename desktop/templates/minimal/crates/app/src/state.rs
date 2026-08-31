//! App-wide state, provided as context by `Root`.
//!
//! Even a one-window app wants this: the settings sheet and the root view both
//! need to read and write the same settings, and threading a handle through
//! every constructor is how that ends up with two copies that disagree.

use atlas::prelude::*;
use guise::prelude::*;
use model::Settings;
use store::Store;

#[derive(Clone)]
pub struct AppState {
    pub store: Store,
    pub settings: Signal<Settings>,
    pub settings_open: Signal<bool>,
    pub about_open: Signal<bool>,
    pub toasts: Toasts,
}

impl AppState {
    /// How a view reads the state `Root` provided. Unused while `Root` is the
    /// only view and holds its own handle — it is here because the first view
    /// this app grows will need it, and finding it is easier than deriving it.
    #[allow(dead_code)]
    pub fn get(cx: &gpui::App) -> AppState {
        use_context::<AppState>(cx).expect("AppState provided by Root")
    }

    pub fn new(store: Store, cx: &mut gpui::App) -> Self {
        let settings = store.settings();
        AppState {
            store,
            settings: Signal::new(cx, settings),
            settings_open: Signal::new(cx, false),
            about_open: Signal::new(cx, false),
            toasts: Toasts::new(cx),
        }
    }

    pub fn save_settings(&self, cx: &mut gpui::App, settings: Settings) {
        match self.store.save_settings(&settings) {
            Ok(()) => {
                // Re-theme immediately: a preference that needs a restart to
                // take effect reads as a bug.
                let scheme = if settings.dark() { ColorScheme::Dark } else { ColorScheme::Light };
                Scheme::new().build(scheme).init(cx);
                self.settings.set(cx, settings);
            }
            Err(e) => self.toasts.error(cx, "Could not save settings", &e.to_string()),
        }
    }
}
