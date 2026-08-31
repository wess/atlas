# __APPNAME__

__APPDESC__

A native desktop app built on [Atlas Desktop](https://github.com/wess/atlas) —
Rust, [gpui](https://github.com/zed-industries/zed), and
[guise](https://github.com/wess/guise). No Electron, no web view.

## Install

```sh
brew install --cask wess/packages/__APPSLUG__       # macOS
```

Linux `.deb`, `.tar.gz` and `.AppImage`, and Windows `.zip`/`.msi`, are on the
[releases page](https://github.com/__APPREPO__/releases). The app updates
itself in place from there.

## Develop

```sh
cargo run -p app          # launch (dev binary: __APPSLUG__dev)
cargo test                # the whole suite
cargo clippy --all-targets
```

The dev binary is named `__APPSLUG__dev` so a `cargo run` never collides with
an installed `__APPSLUG__` — both can be open at once.

State lives in `~/.__APPSLUG__/`. `__APPENV___DIR` moves it, which is how to
try a change against a clean profile without losing yours.

## Package

```sh
scripts/bundle.sh                  # dist/__APPNAME__.app (signed)
scripts/dmg.sh                     # dist/__APPNAME__.dmg
scripts/linux.sh [x86_64|aarch64]  # .tar.gz + .deb + .AppImage
pwsh scripts/windows.ps1           # .zip + .msi
```

`packaging/app.env` holds every name the app is known by; the scripts and the
release workflow read it, so a rename is one edit.

## Release

Bump `version` in the workspace `Cargo.toml`, write the section in
`CHANGELOG.md`, and push to `main`. That is the release: the workflow tags it,
publishes the notes from the changelog, builds and notarizes every artifact,
and updates the Homebrew cask and the Scoop manifest.

## License

MIT.
