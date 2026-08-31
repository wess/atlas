//! The app's theme, mapped onto guise.
//!
//! guise resolves every visual from the theme when a component paints, so an
//! app that reads colors from here gets light/dark switching for free and a
//! rebrand for the price of one ramp. The rule that makes that true: **never
//! hardcode a color in a view.**
//!
//! [`Scheme`] is the app's identity — its neutral ramp, accent, corner radius
//! and font. [`Palette`] is the handful of resolved surface tokens views
//! actually reach for, so a sidebar and a list header agree on what "one step
//! back from the body" means without each picking a shade index.

use gpui::Hsla;
use guise::prelude::*;
use guise::theme::{Color, Shades};

/// Mantine's dark scale (`dark-0` … `dark-9`), light to dark. guise's own
/// `Dark` ramp differs slightly; re-pinning it is what makes every semantic
/// color (`body`, `surface`, `text`, `dimmed`, `border`) land where the design
/// expects.
pub const MANTINE_DARK: [&str; 10] = [
    "#C1C2C5", "#A6A7AB", "#909296", "#5C5F66", "#373A40", "#2C2E33", "#25262B", "#1A1B1E",
    "#141517", "#101113",
];

/// GitHub's dark scale, for an app that wants to sit next to developer tools.
pub const GITHUB_DARK: [&str; 10] = [
    "#C9D1D9", "#B1BAC4", "#8B949E", "#6E7681", "#484F58", "#30363D", "#21262D", "#161B22",
    "#0D1117", "#010409",
];

/// The app's visual identity: what its neutrals, accent, corners and type are.
#[derive(Clone, Debug)]
pub struct Scheme {
    pub ramp: [&'static str; 10],
    pub accent: ColorName,
    pub radius: Size,
    pub font: String,
}

impl Default for Scheme {
    fn default() -> Self {
        Scheme {
            ramp: MANTINE_DARK,
            accent: ColorName::Blue,
            radius: Size::Md,
            // The system UI font, so the app looks native rather than shipped
            // from somewhere else.
            font: ".SystemUIFont".into(),
        }
    }
}

impl Scheme {
    pub fn new() -> Self {
        Scheme::default()
    }

    pub fn ramp(mut self, ramp: [&'static str; 10]) -> Self {
        self.ramp = ramp;
        self
    }

    pub fn accent(mut self, accent: ColorName) -> Self {
        self.accent = accent;
        self
    }

    pub fn radius(mut self, radius: Size) -> Self {
        self.radius = radius;
        self
    }

    pub fn font(mut self, font: impl Into<String>) -> Self {
        self.font = font.into();
        self
    }

    /// Build the guise theme for a color scheme. `theme.init(cx)` installs it.
    pub fn build(&self, scheme: ColorScheme) -> Theme {
        let mut theme = match scheme {
            ColorScheme::Dark => Theme::dark(),
            ColorScheme::Light => Theme::light(),
        };
        theme.palette.set_shades(ColorName::Dark, Shades(self.ramp.map(Color::hex)));
        theme.primary_color = self.accent;
        theme.default_radius = self.radius;
        theme.font_family = self.font.clone().into();
        theme
    }
}

/// The monospace family for code, logs, and data cells.
pub fn mono() -> &'static str {
    if cfg!(target_os = "macos") {
        "Menlo"
    } else if cfg!(target_os = "windows") {
        "Consolas"
    } else {
        "monospace"
    }
}

/// The resolved surface/border/text tokens for the active theme.
///
/// These are the values a view would otherwise pick by shade index — and pick
/// differently in the next file. Naming them is what keeps a sidebar, a list
/// header and a status bar the same color.
#[derive(Clone, Copy, Debug)]
pub struct Palette {
    /// A raised surface: cards, dialogs, popovers.
    pub bg_surface: Hsla,
    /// One step back from the body: sidebars, headers.
    pub bg_subtle: Hsla,
    /// Two steps back: hover fills, inset wells.
    pub bg_muted: Hsla,
    pub border: Hsla,
    pub border_subtle: Hsla,
    pub text_muted: Hsla,
    /// A list header, distinct from the rows under it.
    pub row_header: Hsla,
    /// The zebra tint on alternating rows. Deliberately an alpha over whatever
    /// is behind it, so it survives a scheme change.
    pub row_stripe: Hsla,
    pub scrollbar: Hsla,
    pub scrollbar_hover: Hsla,
}

fn hex(code: &str) -> Hsla {
    Color::hex(code).hsla()
}

pub fn colors(theme: &Theme) -> Palette {
    let shade = |i: usize| theme.color(ColorName::Dark, i).hsla();
    let gray = |i: usize| theme.color(ColorName::Gray, i).hsla();
    match theme.scheme {
        ColorScheme::Dark => Palette {
            bg_surface: shade(8),
            bg_subtle: shade(7),
            bg_muted: shade(6),
            border: shade(5),
            border_subtle: shade(6),
            text_muted: shade(2),
            row_header: shade(7),
            row_stripe: gpui::hsla(0.0, 0.0, 1.0, 0.03),
            scrollbar: shade(4),
            scrollbar_hover: shade(3),
        },
        ColorScheme::Light => Palette {
            bg_surface: hex("#ffffff"),
            bg_subtle: hex("#f8f9fa"),
            bg_muted: hex("#f1f3f5"),
            border: gray(3),
            border_subtle: gray(2),
            text_muted: gray(6),
            row_header: gray(0),
            row_stripe: gpui::hsla(0.0, 0.0, 0.0, 0.02),
            scrollbar: gray(4),
            scrollbar_hover: gray(5),
        },
    }
}

/// The resolved palette for the active global theme.
pub fn palette(cx: &gpui::App) -> Palette {
    colors(guise::theme::theme(cx))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_scheme_pins_its_ramp_onto_the_theme() {
        let theme = Scheme::new().ramp(GITHUB_DARK).build(ColorScheme::Dark);
        assert_eq!(theme.color(ColorName::Dark, 8).hsla(), hex("#0D1117"));
    }

    #[test]
    fn the_accent_and_radius_carry_through() {
        let theme = Scheme::new().accent(ColorName::Teal).radius(Size::Lg).build(ColorScheme::Dark);
        assert_eq!(theme.primary_color, ColorName::Teal);
        assert_eq!(theme.default_radius, Size::Lg);
    }

    #[test]
    fn light_and_dark_do_not_share_a_surface() {
        // The bug this catches: a palette that reads the same shade index in
        // both schemes, so light mode renders dark cards on a white page.
        let scheme = Scheme::new();
        let dark = colors(&scheme.build(ColorScheme::Dark));
        let light = colors(&scheme.build(ColorScheme::Light));
        assert_ne!(dark.bg_surface, light.bg_surface);
        assert!(light.bg_surface.l > dark.bg_surface.l);
    }
}
