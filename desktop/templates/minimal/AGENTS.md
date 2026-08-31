# __APPNAME__

Repository guidance for agent sessions.

## What this is

__APPDESC__

A single-window native desktop app: a Cargo workspace built on
[Atlas Desktop](https://github.com/wess/atlas), with
[gpui](https://github.com/zed-industries/zed) +
[guise](https://github.com/wess/guise) for the UI.

The GUI binary is `__APPSLUG__dev`: a dev build (`cargo run -p app`) is named
that so it never collides with an installed `__APPSLUG__`.

## Commands

```sh
cargo run -p app                 # build and launch
cargo test                       # the whole suite
cargo clippy --all-targets       # lint

scripts/bundle.sh                # dist/__APPNAME__.app
scripts/dmg.sh                   # dist/__APPNAME__.dmg
scripts/linux.sh [arch]          # .tar.gz + .deb + .AppImage
pwsh scripts/windows.ps1         # .zip + .msi
```

## The dependency recipe

Plain crates.io `gpui = "0.2.2"` plus a **released** `guise-ui`, with **no
`[patch.crates-io]` and no vendored crates**, so a release can be rebuilt from
its lockfile. `default-features = false` drops guise's `webview` feature and
its `wry` dependency. The library is published as `guise-ui` and imported as
`guise`.

## Architecture

Three crates, layered bottom-up. **Nothing below `app` imports gpui.**

- **`model`** — the domain types, pure serde. Field names mirror the on-disk
  JSON so files under `~/.__APPSLUG__/` round-trip.
- **`store`** — local persistence, typed. A thin layer over `atlas::store`
  (atomic writes, corrupt-file backup, the OS keychain). `__APPENV___DIR`
  overrides the root; tests use it.
- **`app`** — the gpui application. `state.rs` is the shared signal contract,
  `root.rs` is the UI.

### When it grows

- **A second surface** — add a `Route` enum and a nav rail
  (`atlas::shell::Nav`). The `sidebar` template is that shape already.
- **Anything async** — add a `host` crate holding the service facade, keep it
  gpui-free, and dispatch through `atlas::bridge::run`. One seam, so there is
  one place to look when a result never arrives.
- **More than a handful of settings** — move from `SettingsSection` inline in
  `root` to guise's `SettingsView` with a page list.

## Things that look like bugs and are not

- **A greyed-out menu bar.** gpui dispatches actions along the focus path, so an
  action handled on an element is unreachable while nothing is focused. `Root`
  calls `atlas::shell::focus::claim` every frame.
- **"cannot call defer_draw during deferred drawing".** guise's `Modal` and every
  dropdown both defer. Use `atlas::shell::Sheet` for overlays containing a
  `Select`.
- **A theme read that will not compile.** `theme(cx)` borrows `cx` immutably and
  `cx.listener(…)` needs it mutably. Resolve colours into locals first.

## Conventions

- Functional style; a free function over plain data beats a type with methods
  where there is no state to hold.
- File names lowercase, no spaces, dashes, or underscores. Split by directory
  rather than compound names. Small, focused files.
- Read every visual from the theme (`atlas::shell::palette`, `guise::theme`).
- The workspace version in the root `Cargo.toml` drives releases.
