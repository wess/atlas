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
`wry` dependency; turn it back on only if the app grows an embedded browser.

The library is published as `guise-ui` and imported as `guise` (`use guise::…`),
so cargo commands say `-p guise-ui` while the code says `guise`.

If you bump either, keep them compatible: guise 1.5 compiles against crates.io
gpui 0.2.2.

## Architecture

A workspace layered bottom-up. Each crate depends only on those below it, and
**the crates below `app` never import gpui** — that boundary is what makes the
app's behavior testable without opening a window.

- **`model`** — the domain types, pure serde. Field names mirror the on-disk
  JSON so files under `~/.__APPSLUG__/` round-trip.
- **`store`** — local persistence, typed. A thin layer over `atlas::store`
  (atomic writes, corrupt-file backup, the OS keychain) that declares the
  document names and shapes once instead of scattering string literals.
  `__APPENV___DIR` overrides the root; tests use it.
- **`host`** — the async service facade (`Host`) the UI calls. Every operation
  the app can perform is a method here. Disk and network work runs on
  `spawn_blocking` or a real async client, never inline on a runtime worker.
- **`app`** — the gpui application. `state.rs` is the cross-view signal
  contract, `root.rs` owns routing and the window's fallback focus, `views/` is
  one module per surface.

Async calls cross into the UI through `atlas::bridge::run` — one seam, so there
is one place to look when a result never arrives.

## Things that look like bugs and are not

- **A greyed-out menu bar.** gpui dispatches actions along the focus path, so an
  action handled on an element is unreachable while nothing is focused. `Root`
  calls `atlas::shell::focus::claim` every frame to hold focus when nothing else
  wants it.
- **"cannot call defer_draw during deferred drawing".** guise's `Modal` and every
  dropdown both defer. Use `atlas::shell::Sheet` for overlays that contain a
  `Select` — it paints inline so the dropdown defers at the top level.
- **A theme read that will not compile.** `theme(cx)` borrows `cx` immutably and
  `cx.listener(…)` needs it mutably. Resolve every colour into a local *before*
  the first listener.

## Conventions

- Functional style; a free function over plain data beats a type with methods
  where there is no state to hold.
- File names lowercase, no spaces, dashes, or underscores. Split by directory
  rather than compound names (`views/items.rs`, not `views/item-list.rs`).
  Small, focused files.
- Read every visual from the theme (`atlas::shell::palette`, `guise::theme`).
  A hardcoded colour is what breaks light mode.
- The pure crates carry the unit coverage. Integration seams are where the real
  bugs are; verify those against the real thing, not a mock.
- The workspace version in the root `Cargo.toml` drives releases: pushing a
  version bump to `main` tags it and publishes every artifact.
