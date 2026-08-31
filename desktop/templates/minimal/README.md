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
cargo test
cargo clippy --all-targets
```

State lives in `~/.__APPSLUG__/`; `__APPENV___DIR` moves it.

## Package and release

```sh
scripts/bundle.sh && scripts/dmg.sh   # macOS
scripts/linux.sh                      # .tar.gz + .deb + .AppImage
pwsh scripts/windows.ps1              # .zip + .msi
```

Bump `version` in the workspace `Cargo.toml`, write the `CHANGELOG.md` section,
and push to `main`. That is the release.

## License

MIT.
