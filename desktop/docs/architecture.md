# Architecture

The shape every Atlas Desktop app has, and why the boundaries sit where they do.

## The layers

A Cargo workspace, bottom-up. Each crate depends only on those below it.

```
model      the domain types, pure serde                          no gpui
store      JSON under ~/.<app>/ + the OS keychain                no gpui
<domain>   whatever the app does — a client, a parser, an engine no gpui
host       the async service facade the UI calls                 no gpui
app        the gpui application                                  gpui
```

The line that matters is the last one. **Nothing below `app` imports gpui.**

That is not tidiness. It means the app's behavior — every rule about what a
valid project is, what a failed connection does, how a document is written — can
be tested without opening a window, on a headless CI runner, in milliseconds. It
also means the part of the codebase most likely to outlive the UI framework does
not depend on it.

The cost is real and small: values cross the boundary as plain data, and the
`app` crate translates. That translation is where `Load<T>` and the bridge live.

## The seam

Everything asynchronous crosses at one place:

```rust
bridge::run(cx, async move { host.items().await }, move |result, cx| {
    items.set(cx, result.into());
});
```

`run` puts the future on the process-wide tokio runtime and delivers the result
to the gpui main thread. There is exactly one runtime, and one place to look
when a result never arrives.

The handoff is a `futures` oneshot rather than a tokio one because the receiving
half is awaited on gpui's executor, which is not a tokio context.

`stream` is the same shape for a producer that yields many items — logs, tokens,
an event firehose. Cancellation is implicit: when the view goes away the
receiver drops, the producer's `send` starts failing, and it stops. There is no
abort registry to keep in sync.

## State

Two kinds, and the difference is lifetime.

**App state** is provided as context by the root and lives for the whole
process: the route, the settings, the toasts, whatever list the app is about.

**Scoped state** is provided by the view that owns a scope and dies with it. In
the `workspace` template that is `WorkspaceState` — the open project's entries,
selection, and active tab. The root drops the workspace entity when the route
returns home, so nothing from a closed project can leak into the next one, and
no in-flight load can land in a view that has moved on.

Both are built from `Signal<T>`. A view `watch`es the signals it reads, so a
change repaints the views that depend on it and only those.

### `Load<T>`

```rust
pub enum Load<T> { Loading, Ready(T), Failed(String) }
```

`Option<Vec<T>>` collapses two states that need different screens: a list that
failed and a list that has not arrived both read as `None`, so the view renders
a spinner over an error. And `Some(vec![])` looks like a still-loading fetch to
an `.is_empty()` check, so an empty table spins forever.

Three states, three screens. `Result` converts into it, so no view writes the
match itself.

## The store

Plain JSON documents under `~/.<slug>/`, one per thing, plus the OS keychain for
secrets. Not a database — these are files a user can open, diff, and fix by
hand, which is worth more than any query the app would have run.

Two behaviors are load-bearing:

- **Writes rename into place.** The temporary file is in the same directory, so
  the rename is atomic; a crash mid-write leaves the previous document intact
  rather than a truncated one. A settings file that lost the last change is a
  shrug. One that will not load is a support ticket.
- **A corrupt document is backed up, not deleted.** It may be the only copy of
  something the user typed. An unexplained extra file beats silent data loss.

`<SLUG>_DIR` relocates the root, which is how tests get a scratch directory
without stubbing the filesystem — and how you try a change against a clean
profile without losing yours.

Secrets go to the keychain, never into the JSON. The values are written as
single-line JSON because **the macOS keychain hex-encodes a value containing a
newline**, which silently corrupts it on read.

## The chrome

`atlas-shell` is everything that draws and is not the product:

- **`theme`** — a `Scheme` (neutral ramp, accent, radius, font) built into a
  guise `Theme`, plus the resolved `Palette` views read surfaces from. Reading
  every visual from here is what makes light/dark switching free.
- **`menu`** — `Chrome` builds the Application/Edit/View/Help menus, installs
  their keybindings, and handles the four actions that belong to the OS. What is
  left for the app is what is actually its own.
- **`window`** — `MainWindow`, with the defaults every app converged on.
- **`sheet`** — a modal that dropdowns can live inside. See
  [gotchas](gotchas.md).
- **`toasts`** — one severity vocabulary, so an error is not teal in one view
  and red in the next.
- **`nav`** — the collapsing rail.
- **`about`** — guise's card, filled from the build stamp.
- **`update`** — guise's self-update, told which repository and which Developer
  ID.
- **`focus`** — the window's fallback focus. See [gotchas](gotchas.md).

## The build stamp

`atlas-build::stamp("HOPPER")` emits two things a binary cannot work out at
runtime: the day it was built, and whether it is *the* build of its version or
just a checkout carrying that number. Only the release workflow sets
`HOPPER_RELEASE=1`.

Printing "Released 2026-08-21" on a developer's local build is a small lie that
costs a bug report.
