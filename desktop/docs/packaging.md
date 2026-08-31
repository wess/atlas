# Packaging

Every artifact an app ships, and where it comes from.

`packaging/app.env` is the single source of naming truth. Every script below
sources or parses it, and so does the release workflow.

## macOS

```sh
scripts/bundle.sh     # dist/<Name>.app, signed
scripts/dmg.sh        # dist/<Name>.dmg, with an /Applications symlink
```

`bundle.sh` builds `-p app` in release, assembles the bundle, writes the
`Info.plist` from `app.env` and the workspace version, and codesigns
inside-out — the executable first, then the bundle.

Signing is controlled by `CODESIGN_IDENTITY`:

- **unset or `-`** — an ad-hoc signature. The app runs on the machine that built
  it and nowhere else. Fine for local work.
- **a Developer ID** — adds `--options runtime --timestamp`, which is what makes
  the build notarizable, and what the in-app updater verifies before it installs
  anything.

`assets/entitlements.plist` is not optional. gpui renders through Metal and JITs
its shaders, so a hardened-runtime build without `allow-jit` notarizes cleanly
and then **crashes on first paint**.

### The icon

`scripts/icon.sh` renders the 1024px master with `scripts/icon.swift`, builds
the `.iconset`, compiles `assets/icon.icns`, and writes the 512px downscale
Linux packaging needs. macOS only.

The generated icon is a placeholder — the app's first letter on a gradient
squircle in the accent from `app.env` — so a new app is recognisably its own
from the first build. Replace `icon.swift` with the real artwork; nothing else
cares where the master PNG came from.

## Linux

```sh
scripts/linux.sh [x86_64|aarch64]
```

Produces all three of `.tar.gz`, `.deb` (via `cargo deb`) and `.AppImage` (via
`linuxdeploy` + `appimagetool`) in `dist/linux`.

It **does not cross-compile**. The architecture argument only labels the
artifacts and picks the right helper downloads, so run it on the machine whose
architecture you want — which is what the release workflow's matrix does.

Two things that look arbitrary and are not:

- The AppImage gets the **512px** icon, not the 1024px master: `linuxdeploy`
  rejects anything but a standard icon size.
- `APPIMAGE_EXTRACT_AND_RUN=1` is set because CI runners usually lack FUSE, and
  the helpers are themselves AppImages.

System dependencies for a gpui build: `clang`, `libasound2-dev`,
`libfontconfig-dev`, `libssl-dev`, `libvulkan1`, `libwayland-dev`,
`libx11-xcb-dev`, `libxkbcommon-x11-dev`, plus `curl` and `file`.

## Windows

```sh
pwsh scripts/windows.ps1 [-Arch x86_64]
```

A portable `.zip` and a WiX v4 `.msi`. The MSI is best-effort: a WiX failure
warns and leaves the zip, because a release that ships nothing is worse than one
that ships only the portable build. The script exits 0 in that case on purpose —
a cargo failure would have thrown much earlier.

Windows builds are **unsigned** until an Authenticode certificate is wired in;
expect a SmartScreen "unknown publisher" prompt. To sign, add the certificate as
a CI secret and a `signtool sign` step after `wix build`. An EV certificate is
what actually clears SmartScreen reputation.

### Package managers

Both manifests point at the release `.zip` and carry placeholder versions and
checksums in git:

- **Scoop** (`packaging/scoop/app.json`) — the workflow rewrites the version,
  URL, `extract_dir` and SHA-256 and commits it back.
- **Chocolatey** (`packaging/chocolatey/`) — the workflow rewrites the version
  and checksum, runs `choco pack`, and uploads the `.nupkg` to the release.
  Pushing to the community feed passes moderation and is deliberately not
  automated.

## Homebrew

The release workflow writes a cask into `wess/homebrew-packages` pointing at the
published DMG. It needs `HOMEBREW_TAP_TOKEN` in the app's repository secrets.

It waits for the DMG to appear before hashing it: a GitHub release is published
*before* CI finishes uploading to it, so the asset can 404 for a few minutes.
