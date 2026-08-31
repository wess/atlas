# Scaffolding

## Starting an app

```sh
scripts/new.sh <Name> <target-dir> [options]
```

| option | default | what it sets |
|---|---|---|
| `--template` | `sidebar` | `minimal`, `sidebar`, or `workspace` |
| `--slug` | the name, lowercased | the binary, `~/.<slug>`, the `.deb`, the icon file |
| `--id` | `io.wess.<slug>` | the macOS bundle identifier |
| `--repo` | `wess/<slug>` | where releases are published and the updater looks |
| `--desc` | a placeholder | one line, used in six manifests |
| `--vendor` | `Wess Cope` | the copyright holder and package author |
| `--email` | `opensource@wess.io` | the Cargo author and Debian maintainer |
| `--accent` | `#4C6EF5` | the placeholder icon's colour |
| `--atlas` | `git` | `git` for a normal app, `path` to work on Atlas alongside it |

It assembles the template, `templates/shared`, the packaging scripts, the
manifests and the workflows into one directory, rewrites every placeholder,
generates an icon, and makes the first commit.

The slug is stripped to lowercase letters and digits, because anything else
breaks a cargo bin name, a Debian package name, or a keychain service — better
here than three minutes into a release.

The MSI `UpgradeCode` is generated once, at scaffold time, and **must never
change**: it is what tells Windows that version 2 replaces version 1 rather than
installing beside it.

## The templates

### `minimal`

`model` + `store` + `app`. One window, settings, About, self-update. No async
layer at all.

Start here unless you already know you need more. Its `AGENTS.md` says what to
add when it outgrows itself, and each of those additions is one of the other two
templates.

### `sidebar`

`model` + `store` + `host` + `app`. A collapsing nav rail, routed views, an
async host reached through the bridge, `Load<T>` in the views. The Hopper shape.

This is the one to read to understand how the pieces fit.

### `workspace`

`model` + `store` + `host` + `app`, with two state scopes: a home screen listing
projects, and a workspace — sidebar plus tabbed pane — for whichever one is
open. The Tables shape.

Take it when the app *opens* something: a database, a repository, a document.
The per-project state contract is the part worth having.

## Renaming an app

`packaging/app.env` holds every name the app is known by. bash sources it,
PowerShell parses it, and the release workflow loads it into `$GITHUB_ENV` — so
a rename is one edit there plus:

- the `[[bin]]` name and `[package.metadata.deb]` block in `crates/app/Cargo.toml`
- the strings in `crates/app/src/main.rs`, `update.rs`, and `store`'s
  `Store::new`
- `atlasbuild::stamp` in `crates/app/build.rs`

Nothing else hardcodes a name. Anything that does is a bug — that is what
`app.env` is for.

## Developing Atlas and an app together

```sh
scripts/new.sh Acme ~/Dev/acme --atlas path
```

The app's `Cargo.toml` then points at this checkout, so a change here is visible
in the app on the next build. Switch it to the git dependency before publishing.

The three templates work the same way against `crates/` and are compiled in
place, which is the regression test for this library: **a change to a crate here
is verified by building all three templates.**
