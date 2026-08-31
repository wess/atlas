# Packaging

Everything the app is shipped as, and where each artifact comes from.

`packaging/app.env` is the single source of naming truth — every script below
sources it, and so does the release workflow. Renaming the app is one edit
here.

## macOS

| script | output |
|---|---|
| `scripts/bundle.sh` | `dist/<Name>.app`, signed |
| `scripts/dmg.sh` | `dist/<Name>.dmg`, with an `/Applications` symlink |

Signing is controlled by `CODESIGN_IDENTITY`. Unset (or `-`) gives an ad-hoc
signature: the app runs on the machine that built it and nowhere else. A real
Developer ID adds the hardened runtime and a timestamp, which is what makes the
build notarizable — and what the in-app updater verifies before it installs
anything.

`assets/entitlements.plist` is not optional. gpui JITs its Metal shaders, so a
hardened-runtime build without `allow-jit` notarizes cleanly and then crashes
on first paint.

## Linux

`scripts/linux.sh [x86_64|aarch64]` builds natively for the host and produces
all three of `.tar.gz`, `.deb` (via `cargo deb`), and `.AppImage` (via
`linuxdeploy` + `appimagetool`) in `dist/linux`. It does not cross-compile —
the architecture argument only labels the artifacts and picks the right helper
downloads, so run it on the machine whose architecture you want.

System dependencies for a gpui build: `clang`, `libasound2-dev`,
`libfontconfig-dev`, `libssl-dev`, `libvulkan1`, `libwayland-dev`,
`libx11-xcb-dev`, `libxkbcommon-x11-dev`, plus `curl` and `file`.

## Windows

`scripts/windows.ps1 [-Arch x86_64]` produces a portable `.zip` and a WiX v4
`.msi`. The MSI is best-effort: a WiX failure warns and leaves the zip, because
a release that ships nothing is worse than one that ships the portable build.

Both package manifests point at the release `.zip`, and both carry placeholder
versions and checksums in git that the release workflow rewrites:

- **Scoop** — `packaging/scoop/app.json`, rewritten and committed back.
- **Chocolatey** — `packaging/chocolatey/app.nuspec` + `tools/`, packed into a
  `.nupkg` and uploaded to the release. Pushing to the community feed passes
  moderation and is deliberately not automated.

Windows builds are unsigned until an Authenticode certificate is wired in;
expect a SmartScreen "unknown publisher" prompt. To sign, add the certificate
as a CI secret and a `signtool sign` step after `wix build`.
