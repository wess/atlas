#!/usr/bin/env bash
# Build the app (release) and assemble dist/<Name>.app.
#
# Codesigns with CODESIGN_IDENTITY when set — a real Developer ID for a
# notarizable build — and ad-hoc ("-") otherwise, which still seals the bundle
# so it launches on the machine that built it.
#
# Usage: scripts/bundle.sh
set -euo pipefail
. "$(dirname "$0")/app.sh"

identity="${CODESIGN_IDENTITY:--}"
echo "[bundle] $APP_NAME $version"

# The icon should be committed; regenerate it if it is missing (macOS only).
if [ ! -f assets/icon.icns ]; then
  echo "[bundle] assets/icon.icns missing — generating"
  scripts/icon.sh
fi

echo "[bundle] cargo build --release -p app"
cargo build --release -p app

app="dist/$APP_NAME.app"
contents="$app/Contents"
rm -rf "$app"
mkdir -p "$contents/MacOS" "$contents/Resources"

cp "target/release/$dev_bin" "$contents/MacOS/$APP_SLUG"
cp assets/icon.icns "$contents/Resources/icon.icns"

cat > "$contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>$APP_NAME</string>
	<key>CFBundleDisplayName</key>
	<string>$APP_NAME</string>
	<key>CFBundleIdentifier</key>
	<string>$APP_ID</string>
	<key>CFBundleExecutable</key>
	<string>$APP_SLUG</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleVersion</key>
	<string>$version</string>
	<key>CFBundleShortVersionString</key>
	<string>$version</string>
	<key>CFBundleIconFile</key>
	<string>icon</string>
	<key>LSApplicationCategoryType</key>
	<string>$APP_CATEGORY</string>
	<key>LSMinimumSystemVersion</key>
	<string>$APP_MIN_MACOS</string>
	<key>NSHighResolutionCapable</key>
	<true/>
</dict>
</plist>
PLIST

# Sign inside-out: the executable first, then the bundle. The hardened runtime
# and a timestamp are what notarization requires, and an ad-hoc identity cannot
# carry either.
echo "[bundle] codesign ($identity)"
runtime_opts=()
[ "$identity" != "-" ] && runtime_opts=(--options runtime --timestamp)
codesign --force ${runtime_opts[@]+"${runtime_opts[@]}"} \
  --entitlements assets/entitlements.plist \
  -s "$identity" "$contents/MacOS/$APP_SLUG"
codesign --force ${runtime_opts[@]+"${runtime_opts[@]}"} \
  --entitlements assets/entitlements.plist \
  -s "$identity" "$app"

codesign --verify --strict --verbose=2 "$app" || true
echo "[bundle] -> $app"
