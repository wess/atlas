#!/usr/bin/env bash
# Scaffold a new Atlas Desktop app.
#
# Assembles a standalone repository from a template plus the shared packaging
# scripts, manifests, and workflows, then rewrites every name in it. What comes
# out builds, tests, packages, and releases with no further wiring.
#
# Usage:
#   scripts/new.sh <Name> <target-dir> [options]
#
#   --template minimal|sidebar|workspace   default: sidebar
#   --slug     <lowercase>                 default: the name, lowercased
#   --id       <bundle id>                 default: io.wess.<slug>
#   --repo     <owner/repo>                default: wess/<slug>
#   --desc     <one line>                  default: a placeholder
#   --vendor   <name>                      default: Wess Cope
#   --email    <address>                   default: opensource@wess.io
#   --accent   <#rrggbb>                   default: #4C6EF5
#   --atlas    git|path                    how the app depends on Atlas
#                                          (default: git)
#
# Example:
#   scripts/new.sh Hopper ~/Dev/hopper --template sidebar \
#     --desc "Run containers without Docker Desktop." --accent "#2F6FED"
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

name="${1:-}"
target="${2:-}"
if [ -z "$name" ] || [ -z "$target" ]; then
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi
shift 2

template="sidebar"
slug=""
bundle_id=""
repo=""
desc=""
vendor="Wess Cope"
email="opensource@wess.io"
accent="#4C6EF5"
atlas="git"

while [ $# -gt 0 ]; do
  case "$1" in
    --template) template="$2"; shift 2 ;;
    --slug)     slug="$2"; shift 2 ;;
    --id)       bundle_id="$2"; shift 2 ;;
    --repo)     repo="$2"; shift 2 ;;
    --desc)     desc="$2"; shift 2 ;;
    --vendor)   vendor="$2"; shift 2 ;;
    --email)    email="$2"; shift 2 ;;
    --accent)   accent="$2"; shift 2 ;;
    --atlas)    atlas="$2"; shift 2 ;;
    *) echo "error: unknown option '$1'" >&2; exit 1 ;;
  esac
done

[ -d "$root/templates/$template" ] || {
  echo "error: no template '$template' (have: $(ls -1 "$root/templates" | grep -v '^shared$' | tr '\n' ' '))" >&2
  exit 1
}

# The slug is the app's lowercase identity: the binary, ~/.<slug>, the .deb.
# Anything but lowercase letters and digits breaks a cargo bin name, a Debian
# package name, or a keychain service — so it is stripped rather than passed
# through to fail later.
[ -n "$slug" ] || slug="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
[ -n "$slug" ] || { echo "error: '$name' has no usable slug — pass --slug" >&2; exit 1; }

[ -n "$bundle_id" ] || bundle_id="io.wess.$slug"
[ -n "$repo" ] || repo="wess/$slug"
[ -n "$desc" ] || desc="A native desktop app."
env_prefix="$(printf '%s' "$slug" | tr '[:lower:]' '[:upper:]')"
year="$(date +%Y)"

# The MSI UpgradeCode is generated once, here, and must never change: it is
# what tells Windows that version 2 replaces version 1 rather than installing
# beside it.
upgrade_code="$(uuidgen | tr '[:lower:]' '[:upper:]')"

[ -e "$target" ] && { echo "error: $target already exists" >&2; exit 1; }

echo "[new] $name ($slug) from the $template template"
mkdir -p "$target"

# --- assemble --------------------------------------------------------------
cp -R "$root/templates/$template/." "$target/"
cp -R "$root/templates/shared/." "$target/"
# The templates are compiled in place to keep them honest, so a checkout can be
# carrying build output and a lockfile full of local paths. Neither belongs in
# a new app.
rm -rf "$target/target" "$target/Cargo.lock"
mkdir -p "$target/scripts" "$target/packaging" "$target/.github/workflows" "$target/assets"

for script in app.sh bundle.sh dmg.sh linux.sh windows.ps1 icon.sh icon.swift notes.sh; do
  cp "$root/scripts/$script" "$target/scripts/$script"
done

cp "$root/packaging/app.env" "$target/packaging/app.env"
cp "$root/packaging/README.md" "$target/packaging/README.md"
cp -R "$root/packaging/windows" "$target/packaging/windows"
cp -R "$root/packaging/scoop" "$target/packaging/scoop"
cp -R "$root/packaging/chocolatey" "$target/packaging/chocolatey"
# The two assets the packaging scripts read by fixed name.
cp "$root/packaging/macos/entitlements.plist" "$target/assets/entitlements.plist"
cp "$root/packaging/linux/app.desktop" "$target/assets/app.desktop"

cp "$root/ci/release.yml" "$target/.github/workflows/release.yml"
cp "$root/ci/ci.yml" "$target/.github/workflows/ci.yml"
cp "$root/ci/pages.yml" "$target/.github/workflows/pages.yml"

# --- rewrite ---------------------------------------------------------------
# Every placeholder, in every text file. Binary files are skipped by `file`,
# so an icon or a screenshot dropped into a template survives intact.
echo "[new] rewriting names"
find "$target" -type f -print0 | while IFS= read -r -d '' path; do
  case "$(file -b --mime-type "$path")" in
    text/*|application/json|application/xml|application/javascript) ;;
    *) continue ;;
  esac
  # `perl -0pi` handles every placeholder in one pass and needs no escaping
  # dance for the slashes in a URL or a path.
  APPNAME="$name" APPSLUG="$slug" APPID="$bundle_id" APPDESC="$desc" \
  APPREPO="$repo" APPENV="$env_prefix" APPVENDOR="$vendor" APPEMAIL="$email" \
  APPACCENT="$accent" APPYEAR="$year" APPUPGRADECODE="$upgrade_code" \
  perl -0pi -e '
    s/__APPAUTHOR__/$ENV{APPVENDOR} . " <" . $ENV{APPEMAIL} . ">"/ge;
    s/__APPNAME__/$ENV{APPNAME}/g;
    s/__APPSLUG__/$ENV{APPSLUG}/g;
    s/__APPID__/$ENV{APPID}/g;
    s/__APPDESC__/$ENV{APPDESC}/g;
    s/__APPREPO__/$ENV{APPREPO}/g;
    s/__APPENV__/$ENV{APPENV}/g;
    s/__APPVENDOR__/$ENV{APPVENDOR}/g;
    s/__APPACCENT__/$ENV{APPACCENT}/g;
    s/__APPYEAR__/$ENV{APPYEAR}/g;
    s/__APPUPGRADECODE__/$ENV{APPUPGRADECODE}/g;
  ' "$path"
done

# The accent is a value in app.env rather than a placeholder in it, so it is
# set after the rewrite pass.
perl -0pi -e 's/^APP_ACCENT=.*$/APP_ACCENT="'"$accent"'"/m' "$target/packaging/app.env"

# --- point the Atlas dependency somewhere real -----------------------------
# In the template it is a relative path, which only resolves inside this repo.
case "$atlas" in
  git)
    perl -0pi -e '
      s{atlas-desktop = \{ path = "[^"]*" \}}{atlas-desktop = { git = "https://github.com/wess/atlas" }};
      s{atlas-build = \{ path = "[^"]*" \}}{atlas-build = { git = "https://github.com/wess/atlas" }};
    ' "$target/Cargo.toml"
    ;;
  path)
    # An absolute path back to this checkout, for working on Atlas and an app
    # at the same time.
    perl -0pi -e '
      s{atlas-desktop = \{ path = "[^"]*" \}}{atlas-desktop = { path = "'"$root"'/crates/desktop" }};
      s{atlas-build = \{ path = "[^"]*" \}}{atlas-build = { path = "'"$root"'/crates/build" }};
    ' "$target/Cargo.toml"
    ;;
  *) echo "error: --atlas wants 'git' or 'path', got '$atlas'" >&2; exit 1 ;;
esac

# --- the icon --------------------------------------------------------------
if [ "$(uname -s)" = "Darwin" ]; then
  echo "[new] generating a placeholder icon"
  (cd "$target" && scripts/icon.sh >/dev/null) || echo "[new] icon generation failed — run scripts/icon.sh later"
else
  echo "[new] skipping the icon (needs macOS); run scripts/icon.sh on a Mac"
fi

# --- git -------------------------------------------------------------------
if command -v git >/dev/null 2>&1; then
  git -C "$target" init -q
  git -C "$target" add -A
  git -C "$target" commit -qm "Scaffold $name from the Atlas Desktop $template template"
fi

cat <<DONE

[new] $target

  cd $target
  cargo run -p app

  The binary is ${slug}dev; state lives in ~/.${slug}/ (${env_prefix}_DIR moves it).
  Names live in packaging/app.env — every script and workflow reads them there.

  Before the first release:
    - set the Developer ID team in crates/app/src/update.rs
    - add the signing secrets to the repository (see packaging/README.md)
    - replace scripts/icon.swift with the real artwork
DONE
