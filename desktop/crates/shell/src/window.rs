//! Opening the main window.
//!
//! The defaults are the ones every app converged on anyway: centered, a
//! minimum size that keeps the layout honest, and a title carrying the
//! version, so a screenshot in a bug report says which build it is.

use gpui::{
    px, size, App, AppContext, Bounds, Render, TitlebarOptions, WindowBackgroundAppearance,
    WindowBounds, WindowOptions,
};

pub struct MainWindow {
    title: String,
    width: f32,
    height: f32,
    min_width: f32,
    min_height: f32,
    blurred: bool,
}

impl MainWindow {
    /// A window titled `<name>`. Prefer [`MainWindow::versioned`] — a bare
    /// name in a screenshot tells you nothing about which build it is.
    pub fn new(title: impl Into<String>) -> Self {
        MainWindow {
            title: title.into(),
            width: 1200.0,
            height: 800.0,
            min_width: 720.0,
            min_height: 480.0,
            blurred: false,
        }
    }

    /// A window titled `<name> v<version>`. Pass `env!("CARGO_PKG_VERSION")`.
    pub fn versioned(name: &str, version: &str) -> Self {
        MainWindow::new(format!("{name} v{version}"))
    }

    pub fn size(mut self, width: f32, height: f32) -> Self {
        self.width = width;
        self.height = height;
        self
    }

    pub fn min_size(mut self, width: f32, height: f32) -> Self {
        self.min_width = width;
        self.min_height = height;
        self
    }

    /// Draw the window background blurred (macOS vibrancy). The app's own
    /// surfaces must then be translucent for it to show, so this is opt-in.
    pub fn blurred(mut self, blurred: bool) -> Self {
        self.blurred = blurred;
        self
    }

    pub fn options(&self, cx: &mut App) -> WindowOptions {
        let bounds = Bounds::centered(None, size(px(self.width), px(self.height)), cx);
        WindowOptions {
            window_bounds: Some(WindowBounds::Windowed(bounds)),
            window_min_size: Some(size(px(self.min_width), px(self.min_height))),
            titlebar: Some(TitlebarOptions {
                title: Some(self.title.clone().into()),
                ..Default::default()
            }),
            window_background: if self.blurred {
                WindowBackgroundAppearance::Blurred
            } else {
                WindowBackgroundAppearance::Opaque
            },
            ..Default::default()
        }
    }

    /// Open the window with `build` as its root view, and activate the app.
    pub fn open<V: Render + 'static>(
        self,
        cx: &mut App,
        build: impl FnOnce(&mut gpui::Context<V>) -> V + 'static,
    ) {
        let options = self.options(cx);
        cx.open_window(options, |_, cx| cx.new(build)).expect("open the main window");
        cx.activate(true);
    }
}
