---
name: atlascontributing
description: Change the Atlas framework itself, in the Atlas repository. Use when editing packages/, templates, docs, or skills in Atlas, adding a UI component to @atlas/ui, updating the module catalog, or preparing a release.
---

# Changing Atlas

## Layout

`packages/<module>/` holds source, its `AGENTS.md` reference, and `test/`. Inside the repo, packages use relative imports or `@atlas/*` aliases; consumers use `@wess/atlas/*`. `templates/` holds scaffolds, `example/` is Chirp, `distribution/` builds releases, and `validation/` tests packed installs.

## Checks

```sh
bun run check && bun run typecheck && bun test      # every change
bun run skills:verify                               # skills changed
bun run site:build && bun test site/test            # docs changed
bun run distribution:build && bun run distribution:verify && bun run fixtures:verify
```

Run the last line when dependencies, exports, templates, or the build change.

## When an export changes

Update, in the same change:

1. `packages/<module>/AGENTS.md`
2. `docs/api.md`
3. The matching skill in `skills/`
4. `bun run distribution:catalog`, if a public entry point or external dependency changed

## New UI component

Add it only when something uses it.

1. Write `packages/ui/components/<name>/index.tsx` with `component()` or `createField()`, and put behaviour in `packages/ui/headless/`.
2. Write `packages/ui/components/<name>/index.scss`, starting with `@use "../../styles/mixins" as *;`. That gives you `toned`, `toneVariants`, `focusring`, and the token maps. Style `[data-*]`, and use `var(--atlas-*)` for anything that changes with the scheme.
3. Add `@use "../components/<name>";` to `packages/ui/styles/index.scss`, and export it from `packages/ui/components/index.tsx`.
4. Add it to the component list in `skills/atlasui/SKILL.md`.

`packages/ui/test/styles.test.ts` fails if step 3 is missed. New color tokens go in `$schemes` in `styles/tokens.scss`, where the same test enforces WCAG AA in every scheme and mode.

Sass is dev-only. `bunfig.toml` wires the plugin for `Bun.serve` HTML imports; `Bun.build` needs `distribution/sass.ts` passed as a plugin. Components never import styles, and `.scss` never ships.

## Testing React

Tests with events use happy-dom. Register it before loading React, because React checks for a DOM once on import: call `GlobalRegistrator.register()`, then `await import("react-dom/client")`. See `packages/ui/test/interaction.test.tsx`.

## Releasing

A push to `main` that changes `web/package.json` runs the release workflow, which publishes if the version is new. Bumping the version is therefore the release decision.

1. Replace the old version everywhere: `git grep -l "<old>" -- . ../package.json` (both manifests, templates, docs, and skills).
2. Run `bun run distribution:catalog`.
3. Run every check above.

## Conventions

Lowercase filenames with no dashes or underscores, no classes, no input mutation, and no backward-compatibility shims. Comment the why, not the what. Don't mention AI tools in commit messages or generated code. Wess handles git unless asked.
