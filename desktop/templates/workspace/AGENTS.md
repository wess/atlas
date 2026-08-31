# __APPNAME__

Repository guidance for agent sessions.

## What this is

__APPDESC__

A native desktop app: a Cargo workspace built on
[Atlas Desktop](https://github.com/wess/atlas), with
[gpui](https://github.com/zed-industries/zed) +
[guise](https://github.com/wess/guise) for the UI and tokio underneath.

The GUI binary is `__APPSLUG__dev`: a dev build (`cargo run -p app`) is named
that so it never collides with an installed `__APPSLUG__`. Release packaging
installs the same binary under the real name.

## Commands

```sh
cargo run -p app                 # build and launch the app
cargo build --workspace          # build everything
cargo test                       # the whole suite
cargo test -p host               # one crate
cargo clippy --all-targets       # lint

scripts/bundle.sh                # assemble + sign dist/__APPNAME__.app
scripts/dmg.sh                   # package dist/__APPNAME__.dmg
scripts/linux.sh [arch]          # .tar.gz + .deb + .AppImage
pwsh scripts/windows.ps1         # .zip + .msi
```

## The dependency recipe

Plain crates.io `gpui = "0.2.2"` plus a **released** `guise-ui` — a version a
release can be rebuilt from — with **no `[patch.crates-io]` and no vendored
crates**. `default-features = false` drops guise's `webview` feature and its
`wry` dependency.

The library is published as `guise-ui` and imported as `guise` (`use guise::…`),
so cargo commands say `-p guise-ui` while the code says `guise`.

## Architecture

A workspace layered bottom-up. Each crate depends only on those below it, and
**the crates below `app` never import gpui**.

- **`model`** — the domain types, pure serde. `Project` is the thing the app
  opens; `Entry` is what an open project contains. Field names mirror the
  on-disk JSON so files under `~/.__APPSLUG__/` round-trip.
- **`store`** — local persistence, typed. A thin layer over `atlas::store`.
  Project *secrets* go to the OS keychain, never into `projects.json` — a
  synced or backed-up settings file must not carry a credential.
  `__APPENV___DIR` overrides the root; tests use it.
- **`host`** — the async service facade. It owns the **active-project cursor**,
  because "which project is open" decides what half these methods do, and a
  copy of that in a view is a copy that can disagree.
- **`app`** — the gpui application.

### The two state scopes

This is the shape worth understanding before changing anything:

- **`AppState`** — provided by `Root`, lives for the whole app: the route, the
  settings, the project list, the toasts.
- **`WorkspaceState`** — provided by the *workspace view*, lives only while a
  project is open: its entries, the selection, the active tab.

`Root` drops the workspace entity when the route returns Home, so everything
scoped to one project goes with it. Nothing from a closed project can leak into
the next one, and no in-flight load can land in a view that has moved on.

Settings live at the root rather than in the workspace because they are
app-wide — ⌘, has to work on the home screen too.

## Things that look like bugs and are not

- **A greyed-out menu bar.** gpui dispatches actions along the focus path, so an
  action handled on an element is unreachable while nothing is focused. `Root`
  calls `atlas::shell::focus::claim` every frame.
- **"cannot call defer_draw during deferred drawing".** guise's `Modal` and every
  dropdown both defer. Use `atlas::shell::Sheet` for overlays containing a
  `Select` — it paints inline so the dropdown defers at the top level.
- **A theme read that will not compile.** `theme(cx)` borrows `cx` immutably and
  `cx.listener(…)` needs it mutably. Resolve every colour into a local *before*
  the first listener.
- **A delete button that also opens the thing.** A click inside a clickable card
  reaches the card too; `cx.stop_propagation()` is what stops it.

## Conventions

- Functional style; a free function over plain data beats a type with methods
  where there is no state to hold. The workspace sidebar and content pane are
  free functions for exactly that reason.
- File names lowercase, no spaces, dashes, or underscores. Split by directory
  rather than compound names. Small, focused files.
- Read every visual from the theme (`atlas::shell::palette`, `guise::theme`).
- Async calls cross into the UI through `atlas::bridge::run` — one seam.
- The workspace version in the root `Cargo.toml` drives releases.
