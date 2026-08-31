# Atlas Desktop

Repository guidance for agent sessions.

## What this is

The boilerplate a native gpui + guise desktop app starts from: five layered
crates plus three templates and the whole packaging and release pipeline. It is
the shared half of Sinclair, Tables, Hopper and Nora, extracted after the fourth
copy had already drifted from the first.

The desktop sibling of `../web`, which is the same idea for Bun/TypeScript web
apps.

## Layout

```
crates/       the library — core, store, bridge, shell, build, and the desktop facade
templates/    minimal, sidebar, workspace — real workspaces, built in place
  shared/     the files every scaffolded app gets regardless of template
scripts/      new.sh (scaffold) + the packaging scripts an app receives
packaging/    app.env and the manifests an app receives
ci/           the workflows an app receives
docs/         architecture, scaffolding, packaging, release, gotchas
```

`scripts/new.sh` is the seam: it assembles `templates/<name>` + `templates/shared`
+ `scripts/` + `packaging/` + `ci/` into a standalone repository and rewrites
every placeholder. Anything an app should receive has to be reachable from
there, or it will not ship.

## Commands

```sh
cargo test --workspace           # the library
cargo clippy --all-targets       # lint
cargo check --workspace

cd templates/sidebar && cargo test --workspace   # a template, built in place
cd templates/sidebar && cargo run -p app         # run it

scripts/new.sh Acme /tmp/acme --template sidebar --atlas path
```

The templates are separate Cargo workspaces (`exclude`d from this one) whose
Atlas dependency is a relative path. That is deliberate: they compile against
the working tree, so a breaking change to a crate here fails a template build
immediately rather than the next time someone scaffolds. **Verify a change to
`crates/` by building all three templates.**

`new.sh` rewrites that path to a git dependency on the way out (`--atlas path`
keeps it a path, for working on Atlas and an app together).

## Crate layering

Each depends only on those below it.

- **`atlas-core`** (`atlascore`) — gpui-free primitives: `Load<T>`, ids,
  timestamps, formatting. Nothing goes in here that has not already been copied
  between two apps.
- **`atlas-store`** (`atlasstore`) — `Paths` (`~/.<slug>`, `<SLUG>_DIR`
  override), `json` (atomic write, corrupt-file backup), `Keychain`
  (single-line JSON — the macOS keychain hex-encodes a value containing a
  newline and silently corrupts it). gpui-free.
- **`atlas-bridge`** (`atlasbridge`) — `runtime`, `run`, `stream`. One tokio
  runtime per process; the handoff is a `futures` oneshot because the receiving
  half is awaited on gpui's executor, which is not a tokio context.
- **`atlas-shell`** (`atlasshell`) — everything that draws: `theme`, `menu`,
  `window`, `sheet`, `toasts`, `nav`, `about`, `update`, `focus`, and the
  standard `actions`.
- **`atlas-build`** (`atlasbuild`) — the build-script stamp.
- **`atlas-desktop`** (`atlas`) — the facade: `atlas::core`, `atlas::store`,
  `atlas::bridge`, `atlas::shell`, plus `atlas::prelude`.

The package names are prefixed and the lib names are not `store`/`shell`/`core`
on purpose: a consuming app has its own `store` and `host` crates, and a bare
lib name here would collide with them.

## Non-obvious things

- **The standard actions live in `shell`, not in each app.** The menu bar has to
  name them, and a `Quit` the shell defines and a `Quit` the app defines are
  different types — the menu would dispatch one while the app handled the other.
  Apps declare their own with the `actions!` macro.
- **`Sheet` exists because `Modal` cannot hold a `Select`.** Both defer, and gpui
  forbids `defer_draw` inside a deferred draw. `Sheet` paints inline so a
  dropdown inside it defers at the top level.
- **`focus::claim` exists because gpui dispatches along the focus path.** With
  nothing focused, every menu item bound to a root-handled action greys out and
  its shortcut does nothing. It reads as a broken menu bar and is not one.
- **Resolve theme values into locals before the first `cx.listener`.**
  `theme(cx)` borrows `cx` immutably; a listener needs it mutably. A late read
  will not compile, and the error does not say why.
- **A test that guesses the store's env-var name writes to the real home
  directory and passes.** Ask `Paths::env_var()` for it. This actually happened
  while writing the templates.
- **`packaging/app.env` is the only place a name is written.** bash sources it,
  PowerShell parses it, and the release workflow loads it into `$GITHUB_ENV`.
  Adding a name that a script hardcodes instead is how a rename half-works.

## Conventions

- Functional style; a free function over plain data beats a type with methods
  where there is no state to hold.
- File names lowercase, no spaces, dashes, or underscores. Split by directory
  rather than compound names (`views/items.rs`, not `views/item-list.rs`).
- Every doc comment says *why*, not what. A comment that restates the signature
  is noise; a comment naming the bug the code prevents is the reason the code
  looks like that.
- Tests are named for the behavior they pin, and each one should fail for
  exactly one reason.
- Read every visual from the theme. A hardcoded colour is what breaks light
  mode.
