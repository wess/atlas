#!/usr/bin/env bash
# Sourced by every packaging script: the app's identity and its version.
#
# Naming lives in packaging/app.env so a rename is one edit rather than a grep
# across four scripts, a WiX manifest, and three workflows. The version lives
# in the workspace Cargo.toml, which is also what triggers a release.

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

[ -f packaging/app.env ] || {
  echo "error: packaging/app.env not found (run this from an Atlas Desktop app)" >&2
  exit 1
}
# shellcheck disable=SC1091
. packaging/app.env

version="$(sed -n 's/^version = "\([0-9][^"]*\)".*/\1/p' Cargo.toml | head -1)"
[ -n "$version" ] || { echo "error: could not read version from Cargo.toml" >&2; exit 1; }

# The cargo bin target is <slug>dev so a dev build never collides with an
# installed <slug>; packaging installs that same binary under the real name.
dev_bin="${APP_SLUG}dev"
