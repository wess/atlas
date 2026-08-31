# Gotchas

Things that look like bugs and are not, each with the symptom that led to it.
Every one of these cost someone an afternoon at least once.

## The menu bar is greyed out and its shortcuts do nothing

**gpui dispatches an action along the focus path.** An action handled on an
element is unreachable while nothing in the window is focused — so the menu item
bound to it renders disabled, and its shortcut is swallowed.

It reads as a broken menu bar. It is a focus problem.

```rust
// Root::new
let focus = cx.focus_handle();

// Root::render
atlasshell::focus::claim(window, cx, &self.focus);
div().track_focus(&self.focus).on_action(cx.listener(…))
```

`claim` is safe to call every frame — it does nothing once something else has
focus, so a text field the user clicked keeps the caret.

## "cannot call defer_draw during deferred drawing"

guise's `Modal` is a gpui `deferred` element, and so is a `Select`'s dropdown.
gpui forbids calling `defer_draw` while already inside a deferred draw, so a
`Select` opened inside a `Modal` aborts the frame.

Use `atlasshell::Sheet` for any overlay that might contain a dropdown. It paints
inline — an absolutely-positioned scrim sized to the viewport, drawn last — so
anything inside it defers at the top level and never nests.

## A theme read that will not compile

`theme(cx)` borrows `cx` immutably; `cx.listener(…)` needs it mutably. Reading a
colour *after* building a listener overlaps the borrows, and the error does not
say that.

Resolve every theme value into a local at the top of `render`, before the first
listener. Closures stored on elements must be `'static`, so they need the
resolved `Hsla`/`f32`, not a `&Theme` borrow, anyway.

## A window that never repaints

**A gpui window that has never been focused keeps painting its first frame.**
Background work completes and signals update, but nothing repaints — so a
screenshot taken from a script shows a stale UI and the app looks broken.

Focus the window before you trust what it is showing.

## The store test that passes and writes to your home directory

A test that spells out the override variable by hand:

```rust
std::env::set_var("HOPPR_DIR", &dir);   // typo
```

…does not fail. `Store::new` falls back to `~/.hopper`, the round-trip passes,
and the test has quietly written into the user's real state. Ask for the name:

```rust
std::env::set_var(Paths::new("hopper").env_var(), &dir);
```

Environment variables are also process-global, so two tests sharing one race —
the loser reads the winner's scratch directory after it has been deleted. Give
each test its own slug.

## A keychain value that comes back mangled on macOS

**The macOS keychain returns a value containing a newline hex-encoded**, which
silently corrupts it on read. `atlasstore::Keychain::put_json` writes single-line
JSON and asserts it in debug builds for exactly this reason.

## A delete button that also opens the thing

A click on a control inside a clickable card reaches the card too. Call
`cx.stop_propagation()` in the inner handler, or the row's own click fires on the
item that was just deleted.

## An app that notarizes cleanly and crashes on first paint

gpui renders through Metal and JITs its shaders. Under a hardened runtime that
needs `com.apple.security.cs.allow-jit`,
`allow-unsigned-executable-memory`, and `disable-library-validation` — the three
entries in `assets/entitlements.plist`.

Nothing warns you. The build signs, notarizes, staples, and dies on launch.

## An update prompt whose button can only fail

A release host publishes the release *before* CI uploads assets to it, so a
newer tag can be visible for the length of a notarization run with nothing on it
this machine can install. guise's `Release::ready_for` gates on the asset for
this OS *and* architecture actually being present, which is what stops the
prompt appearing in that window.

## A settings file that loses every preference after an upgrade

A settings struct without `#[serde(default)]` **on the container** fails to
parse a document written before a field was added — and the whole document is
lost, not just the missing key.

```rust
#[serde(rename_all = "camelCase", default)]
pub struct Settings { … }
```

## An empty list that spins forever

`Option<Vec<T>>` cannot tell "not loaded" from "loaded and empty" from "failed".
A view checking `.is_empty()` renders a spinner over an error, and an empty
table never stops loading. Use `atlascore::Load<T>`.
