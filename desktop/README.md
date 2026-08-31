# Atlas Desktop

The boilerplate a native desktop app starts from: Rust,
[gpui](https://github.com/zed-industries/zed), and
[guise](https://github.com/wess/guise). No Electron, no web view.

It is the half of [Sinclair](https://github.com/wess/sinclair),
[Tables](https://github.com/wess/tables), [Hopper](https://github.com/wess/hopper)
and Nora that turned out to be the same in all of them — the workspace layering,
the tokio↔gpui seam, the atomic-JSON store, the theme, the menu bar, the
overlays, the About card, self-update, and the whole macOS/Linux/Windows
packaging and release pipeline.

Atlas Desktop is the desktop sibling of [Atlas](../web) for web apps.

## Start an app

```sh
scripts/new.sh Hopper ~/Dev/hopper \
  --template sidebar \
  --desc "Run containers without Docker Desktop." \
  --accent "#2F6FED"
```

That writes a standalone repository — a Cargo workspace, packaging scripts, CI
and release workflows, an icon, a README and an `AGENTS.md` — and commits it.
Then:

```sh
cd ~/Dev/hopper
cargo run -p app
```

It runs. It also bundles, signs, packages, and releases with nothing further to
wire up.

### Templates

| `--template` | Shape | Modelled on |
|---|---|---|
| `minimal` | One window. Settings, About, self-update. | — |
| `sidebar` | A nav rail and routed views over an async host. | Hopper |
| `workspace` | Home screen → open a project → sidebar + tabbed pane. | Tables |

Start at the smallest one that fits. `minimal`'s `AGENTS.md` says what to add
when it outgrows itself, and every step is a template you can read.

## The crates

Layered, so each stays honest about what it depends on. `atlas-desktop` is the
facade over all four.

| crate | `atlas::` | what it is | gpui? |
|---|---|---|---|
| `atlas-core` | `core` | `Load<T>`, ids, timestamps, byte/count/relative-time formatting | no |
| `atlas-store` | `store` | JSON under `~/.<app>/` — atomic writes, corrupt-file backup — plus the OS keychain | no |
| `atlas-bridge` | `bridge` | the one seam between the tokio runtime and the gpui main thread | yes |
| `atlas-shell` | `shell` | theme, menu bar, window, `Sheet`, toasts, nav rail, About, self-update, focus | yes |
| `atlas-build` | — | the build-script stamp that tells a release apart from a checkout | no |

```toml
[dependencies]
atlas-desktop = { git = "https://github.com/wess/atlas" }
```

```rust
use atlas::prelude::*;

Application::new().run(|cx| {
    Scheme::new().build(ColorScheme::Dark).init(cx);
    Chrome::new("Hopper").docs("https://github.com/wess/hopper").install(cx);
    MainWindow::versioned("Hopper", env!("CARGO_PKG_VERSION")).open(cx, Root::new);
});
```

## What you get for free

- **The layering.** `model` → `store` → domain → `host` → `app`, with gpui
  confined to the top. The app's behavior stays testable without a window.
- **One async seam.** Every call crosses at `bridge::run`, so there is one place
  to look when a result never arrives and one runtime to reason about.
- **State that cannot lie.** `Load<T>` keeps "loading", "empty" and "failed"
  three different screens instead of three ways to render a spinner.
- **A store that survives a crash.** Writes rename into place; an unreadable
  document is backed up, never discarded.
- **Chrome that works.** A menu bar that is not greyed out, an overlay that
  dropdowns can live inside, toasts with one severity vocabulary, an About card
  that does not claim a local build is a release.
- **Shipping.** `.app`/`.dmg` signed and notarized with a Homebrew cask,
  `.tar.gz`/`.deb`/`.AppImage` for x86_64 and aarch64, `.zip`/`.msi` with Scoop
  and Chocolatey manifests — all driven off one `packaging/app.env` and a
  version bump on `main`.
- **In-place self-update**, verified against your Developer ID.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — the layers, and why the
  boundaries sit where they do.
- [`docs/scaffolding.md`](docs/scaffolding.md) — `new.sh`, the templates, and
  renaming an app.
- [`docs/packaging.md`](docs/packaging.md) — every artifact and where it comes
  from.
- [`docs/release.md`](docs/release.md) — signing, notarization, cutting a
  release.
- [`docs/gotchas.md`](docs/gotchas.md) — the gpui and guise traps, each with the
  symptom that led to it.
- [`AGENTS.md`](AGENTS.md) — repository guidance for agent sessions.

## Develop Atlas Desktop itself

```sh
cargo test --workspace
cargo clippy --all-targets

cd templates/sidebar && cargo run -p app    # the templates build in place
```

Each template is a real workspace whose Atlas dependency is a relative path, so
a change to a crate here is visible in all three immediately. `new.sh` rewrites
that path to a git dependency on the way out.

## License

MIT.
