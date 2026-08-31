#!/usr/bin/env bash
# Package dist/<Name>.app into dist/<Name>.dmg — a compressed disk image with
# the app and an /Applications symlink for drag-to-install. Run bundle.sh
# first.
#
# Usage: scripts/dmg.sh
set -euo pipefail
. "$(dirname "$0")/app.sh"

app="dist/$APP_NAME.app"
dmg="dist/$APP_NAME.dmg"
[ -d "$app" ] || { echo "error: $app not found — run scripts/bundle.sh first" >&2; exit 1; }

stage="$(mktemp -d)"
cp -R "$app" "$stage/"
ln -s /Applications "$stage/Applications"

rm -f "$dmg"
echo "[dmg] building $dmg"
hdiutil create -volname "$APP_NAME" -srcfolder "$stage" -fs HFS+ -format UDZO -ov "$dmg" >/dev/null
rm -rf "$stage"

# Sign the image too when a real identity is available — notarization staples
# onto the .dmg, and the updater verifies what it downloads.
if [ "${CODESIGN_IDENTITY:--}" != "-" ]; then
  codesign --force --timestamp -s "$CODESIGN_IDENTITY" "$dmg"
fi
echo "[dmg] -> $dmg"
