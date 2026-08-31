#!/usr/bin/env bash
# Build for Linux and produce a .tar.gz, a .deb, and an AppImage under
# dist/linux.
#
# Builds natively for the host architecture — no cross-compiling. The argument
# only labels the artifacts and picks the right helper downloads, so run this
# on the machine whose architecture you want.
#
# System deps (install beforehand): a Rust toolchain, the gpui set (clang,
# libasound2-dev, libfontconfig-dev, libssl-dev, libvulkan1, libwayland-dev,
# libx11-xcb-dev, libxkbcommon-x11-dev), curl, and file. cargo-deb is installed
# on demand.
#
# Usage: scripts/linux.sh [x86_64|aarch64]
set -euo pipefail

arch="${1:-$(uname -m)}"
case "$arch" in
  x86_64 | amd64) arch="x86_64"; triple="x86_64-unknown-linux-gnu"; debarch="amd64" ;;
  aarch64 | arm64) arch="aarch64"; triple="aarch64-unknown-linux-gnu"; debarch="arm64" ;;
  *) echo "error: unsupported arch '$arch' (want x86_64 or aarch64)" >&2; exit 1 ;;
esac

. "$(dirname "$0")/app.sh"
echo "[linux] $APP_NAME $version for $triple"

out="$root/dist/linux"
rm -rf "$out"
mkdir -p "$out"

# --- build ----------------------------------------------------------------
rustup target add "$triple" >/dev/null 2>&1 || true
cargo build --release -p app --target "$triple"
bin="target/$triple/release/$dev_bin"
strip "$bin" 2>/dev/null || true

# --- staging tree, shared by the tarball and the AppImage AppDir -----------
appdir="$out/AppDir"
mkdir -p "$appdir/usr/bin" "$appdir/usr/share/applications" "$appdir/usr/share/pixmaps"
cp "$bin" "$appdir/usr/bin/$APP_SLUG"
cp assets/app.desktop "$appdir/usr/share/applications/$APP_SLUG.desktop"
# 512px: linuxdeploy rejects anything but a standard icon size, so the 1024px
# master cannot be used directly.
cp assets/icon512.png "$appdir/usr/share/pixmaps/$APP_SLUG.png"

# --- .tar.gz ---------------------------------------------------------------
stem="$APP_SLUG-$version-linux-$arch"
stage="$out/$stem"
mkdir -p "$stage"
cp -r "$appdir/usr" "$stage/usr"
cp LICENSE README.md "$stage/" 2>/dev/null || true
tar -C "$out" -czf "$out/$stem.tar.gz" "$stem"
rm -rf "$stage"
echo "[linux] -> $stem.tar.gz"

# --- .deb ------------------------------------------------------------------
command -v cargo-deb >/dev/null 2>&1 || cargo install cargo-deb --locked
cargo deb -p app --no-build --target "$triple" \
  --output "$out/${APP_SLUG}_${version}_${debarch}.deb"
echo "[linux] -> ${APP_SLUG}_${version}_${debarch}.deb"

# --- AppImage --------------------------------------------------------------
# CI runners often lack FUSE, so the helper AppImages are extracted and run.
export APPIMAGE_EXTRACT_AND_RUN=1
tools="$out/tools"
mkdir -p "$tools"
ld="$tools/linuxdeploy-$arch.AppImage"
ait="$tools/appimagetool-$arch.AppImage"
curl -fsSL -o "$ld" "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-$arch.AppImage"
curl -fsSL -o "$ait" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-$arch.AppImage"
chmod +x "$ld" "$ait"
"$ld" --appdir "$appdir" \
  --executable "$appdir/usr/bin/$APP_SLUG" \
  --desktop-file "$appdir/usr/share/applications/$APP_SLUG.desktop" \
  --icon-file "$appdir/usr/share/pixmaps/$APP_SLUG.png"
ARCH="$arch" "$ait" "$appdir" "$out/$APP_NAME-$version-$arch.AppImage"
echo "[linux] -> $APP_NAME-$version-$arch.AppImage"

# --- leave only shippable artifacts ----------------------------------------
rm -rf "$appdir" "$tools"
echo "[linux] artifacts in dist/linux:"
ls -1 "$out"
