# Releasing

## Cutting one

Bump `version` in the workspace `Cargo.toml`, write the matching section in
`CHANGELOG.md`, and push to `main`.

That is the release. The workflow tags it, publishes the notes from the
changelog, and builds every artifact.

Run the gate first — `cargo test`, `cargo clippy --all-targets`, and a release
build — because the version bump *is* the trigger and there is no draft step to
catch a failure behind.

### Why the changelog and not generated notes

Release notes generated from commit subjects say what was touched. The changelog
says what changed for the person installing it. `scripts/notes.sh` extracts the
section for a version and exits non-zero when there is none, so the workflow can
fall back to generated notes with a warning rather than publishing an empty
release body.

## What the workflow does

| job | output |
|---|---|
| `check-version` | reads `app.env` and the version; skips if the tag exists |
| `create-release` | tags, publishes the release with the changelog section |
| `macos` | `.app` → notarize → `.dmg` → notarize → checksum → upload |
| `linux` | x86_64 and aarch64 matrix: `.tar.gz`, `.deb`, `.AppImage`, checksums |
| `windows` | `.zip`, `.msi`, `.nupkg` |
| `homebrew` | rewrites the cask in `wess/homebrew-packages` |
| `scoop` | rewrites `packaging/scoop/app.json` and commits it back |

`check-version` decides by asking whether the tag already exists, not by
diffing `HEAD~1`. A diff would miss a manual dispatch and a re-released version;
this is idempotent for both.

The Scoop job retries its push with a rebase up to five times. It runs after the
Windows build, by which point `main` has often moved — the release commit is
rarely the last one pushed — and a plain push is rejected non-fast-forward,
silently missing the release. The manifest is the only file it touches, so a
rebase has nothing to conflict with.

## Signing and notarization

Signing credentials are **optional**. Without them every job still runs and
produces ad-hoc-signed artifacts, with a warning in the log. That keeps a fork
building.

With them, the macOS job imports the Developer ID into a temporary keychain
(wiped when the job ends), signs with a hardened runtime and a timestamp, and
notarizes and staples both the `.app` and the `.dmg`.

Repository secrets:

| secret | what it is |
|---|---|
| `APPLE_SIGNING_IDENTITY` | the identity string, e.g. `Developer ID Application: … (TEAMID)` |
| `APPLE_CERT_P12` | the exported certificate, base64 |
| `APPLE_CERT_PASSWORD` | its export password |
| `KEYCHAIN_PASSWORD` | any value; it protects the temporary keychain |
| `APPLE_ID` / `APPLE_APP_PASSWORD` / `APPLE_TEAM_ID` | notarytool credentials |
| `HOMEBREW_TAP_TOKEN` | write access to the tap repository |

### Verifying it actually notarized

A signed-but-not-notarized build looks identical until someone else downloads
it. Check the staple, not just the signature:

```sh
xcrun stapler validate dist/<Name>.dmg
spctl -a -vvv -t install dist/<Name>.dmg
codesign --verify --strict --verbose=2 dist/<Name>.app
```

`spctl` should say `accepted` and `source=Notarized Developer ID`.

## Self-update

Set the Developer ID team in `crates/app/src/update.rs`:

```rust
Update::github("Acme", env!("CARGO_PKG_VERSION"), "wess/acme").team_id("XXXXXXXXXX")
```

Without it guise refuses to execute a downloaded bundle and opens the release
page instead — so an app that ships notarized builds and leaves this off has
quietly lost its own update path.

The install is **in place**: on macOS the DMG is mounted and rsynced onto the
installed `.app`, so the bundle's path and inode never change and
LaunchServices' registration stays valid. On Linux the new AppImage is renamed
over the running one. Everything else (a distro package, a dev build, Windows)
opens the release page.

A release is only offered once it has published the asset *this* machine would
install. Release hosts publish before CI uploads, so a newer tag can be visible
for the length of a notarization run with nothing usable on it; prompting in
that window yields an Update button that can only fail.
