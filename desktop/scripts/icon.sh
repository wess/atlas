#!/usr/bin/env bash
# Regenerate the app icon: render the 1024px master (scripts/icon.swift), build
# the macOS .iconset and compile it to assets/icon.icns, then write the 512px
# downscale Linux packaging needs.
#
# macOS only (swift, sips, iconutil). Outputs land in assets/.
#
# Usage: scripts/icon.sh
set -euo pipefail
. "$(dirname "$0")/app.sh"

assets="$root/assets"
png="$assets/icon.png"
icns="$assets/icon.icns"
png512="$assets/icon512.png"
mkdir -p "$assets"

# The glyph is the app's first letter and the accent comes from app.env, so a
# freshly scaffolded app has an icon of its own rather than a shared placeholder.
letter="$(printf '%s' "$APP_NAME" | cut -c1 | tr '[:lower:]' '[:upper:]')"
accent="${APP_ACCENT:-#4C6EF5}"

echo "[icon] rendering master png ($letter on $accent)"
swift "$root/scripts/icon.swift" "$png" "$letter" "$accent"

echo "[icon] building iconset"
set_dir="$(mktemp -d)/icon.iconset"
mkdir -p "$set_dir"
for spec in 16:16x16 32:16x16@2x 32:32x32 64:32x32@2x \
            128:128x128 256:128x128@2x 256:256x256 512:256x256@2x \
            512:512x512 1024:512x512@2x; do
  size="${spec%%:*}"
  name="${spec#*:}"
  sips -z "$size" "$size" "$png" --out "$set_dir/icon_${name}.png" >/dev/null
done

echo "[icon] compiling icns"
iconutil -c icns "$set_dir" -o "$icns"
rm -rf "$(dirname "$set_dir")"

echo "[icon] writing 512px png for linux packaging"
sips -z 512 512 "$png" --out "$png512" >/dev/null

echo "[icon] wrote $png, $icns, and $png512"
