# @wess/atlas/ui

React components with no component library underneath: headless hooks for behavior, a small factory for structure, Sass for looks. It contains only what Atlas uses; add a component when something needs it.

## Architecture

```
headless/    behavior hooks, no markup or styles    useTabs, useListbox, useForm, useColorMode, ...
factory/     builds styled components               component(), compound(), createField()
components/  primitives, one directory each         <name>/index.tsx + <name>/index.scss
styles/      tokens, mixins, the sheet entry        index.scss @uses every component
<block>/     composed features                      forms, table, auth, storage, nav, cache, ai, provider
```

Public entry points: `@wess/atlas/ui/{components,headless,factory,<block>}` and `@wess/atlas/ui/styles.css`. `@wess/atlas/ui` re-exports the blocks.

## Setup

```tsx
import "@wess/atlas/ui/styles.css"
import { AtlasProvider } from "@wess/atlas/ui/provider"
import { Button, ColorModeControl, Stack } from "@wess/atlas/ui/components"

createRoot(root).render(
  <AtlasProvider>
    <Stack p="md">
      <ColorModeControl />
      <Button color="danger" variant="light">Delete</Button>
    </Stack>
  </AtlasProvider>,
)
```

Apps need no Sass: releases ship compiled CSS. Sass is a dev dependency of this repo only.

## Color

Schemes are `nord` (default) and `atlas` (the site palette), each with a light and dark palette in `styles/tokens.scss`. Mode is `light`, `dark`, or `system` (default).

- `useColorMode()` returns `{ mode, scheme, setMode, setScheme }` and remembers choices in localStorage.
- `<ColorModeControl />` is the ready-made switch.
- With no provider the sheet is still Nord following the OS preference.
- `colorModeScript` from `headless`, pasted into the HTML `<head>`, applies a saved choice before first paint. Without it, the OS palette shows until React mounts.

The `color` prop takes tones, not hues: `primary`, `danger`, `success`, `accent`, `neutral`. To add a scheme, add it to `$schemes` and `colorSchemes`; `test/styles.test.ts` enforces WCAG AA, so add it to `palettes` there too. One-off overrides: `<AtlasProvider theme={{ primary: "#123456", "radius-md": "2px" }}>`.

## Adding a component

1. Purely visual? `component()` is the whole TSX file. Array variants are enums, `true` is a flag; both become `data-*` attributes and `atlas-<name>` is the class.

   ```tsx
   // components/notice/index.tsx
   import { colors, component } from "../../factory/index.tsx"

   export const Notice = component({
     name: "notice",
     element: "aside",
     variants: { color: colors, dense: true },
     defaults: { color: "neutral" },
   })
   ```
2. Write `components/notice/index.scss`. `@use "../../styles/mixins" as *` brings the token maps plus `toned`, `toneVariants`, and `focusring`. Style `[data-*]`, and use `var(--atlas-*)` for anything that changes between schemes.
3. Add `@use "../components/notice";` to `styles/index.scss` and the export to `components/index.tsx`. `test/styles.test.ts` fails if either is missing.

Has behavior? Put it in a `headless/` hook that returns prop getters, then spread those onto `component()` parts; `useTabs` and `components/tabs` are the pattern. An input? `createField(kind, (control, props) => <input {...control} {...props} />)` supplies the label, description, error, sections, and aria wiring. Use `compound(Root, { Part })` for `Root.Part` APIs.

Every factory component also takes `as`, `className`, `style`, and the system props: `p pt mt mb mx my gap w h maw flex fw tt justify align`. Spacing props accept `xs`-`xl` tokens, numbers (px), or raw CSS.

## Routing

Navigation is always a real path through the History API, never a `#` route or view state. `useLocation()` returns `{ pathname, search }` and re-renders on `navigate()` and back/forward; `navigate(to, { replace })` changes the URL. Render real links and call `navigate` from their click handler only when `isPlainClick(event)`, so opening in a new tab still works. The server must serve the app shell for those paths.

## Native on purpose

`Select` is a native `<select>` and `Checkbox` a native input with `accent-color`; `Table` takes plain `thead`/`tr`/`td` children. `Textarea` autosize uses CSS `field-sizing`, so browsers without it keep a fixed `minRows` box that scrolls. `useForm` binds flat field names only.

## Blocks

### provider (`@wess/atlas/ui/provider`)
- `AtlasProvider` — Applies the color scheme and mode to the document. Props: `defaultScheme?` (`"nord"`), `defaultMode?` (`"system"`), `theme?` (token overrides).
- `AppShell` — Layout shell with optional `nav` and `header` slots.

### forms (`@wess/atlas/ui/forms`)
- `createForm<T>(config)` — Returns a hook that provides `form` and `handleSubmit`. Supports optional Zod schema validation.
- `TextField` — Text input bound to a form field.
- `SelectField` — Select input bound to a form field with `options`.
- `SubmitButton` — Submit button with optional `loading` state.

### table (`@wess/atlas/ui/table`)
- `TextColumn<T>(config)` — Column definition for text values.
- `DateColumn<T>(config)` — Column definition that formats dates.
- `ActionColumn<T>(config)` — Column with edit/delete action buttons.
- `createTable<T>(config)` — Returns a component rendering a data table with optional `pagination` and `search`.

### auth (`@wess/atlas/ui/auth`)
- `LoginPage` — Email + password login form.
- `SignupPage` — Name + email + password signup form.
- `ResetPasswordPage` — Email-only password reset form.
All accept `onSubmit` returning `{ error?: string }` and optional `title`.

### storage (`@wess/atlas/ui/storage`)
- `FileUpload` — Hidden file input with button trigger and filename display.
- `ImagePreview` — Image display inside a bordered paper.

### nav (`@wess/atlas/ui/nav`)
- `NavLink` — Single navigation link with optional icon and active state.
- `Sidebar` — Vertical stack container for nav links.
- `Breadcrumb` — Breadcrumb trail from an array of `{ label, href? }` items.

### cache (`@wess/atlas/ui/cache`)
- `CacheInspector` — Table view of cache entries with invalidate/flush actions.
- `CacheStatus` — Badge showing connection status, entry count, and hit rate.

### ai (`@wess/atlas/ui/ai`)
- `ChatWindow` — Full chat interface with scrollable message list, auto-scroll, loading indicator, and `PromptInput` at the bottom. Props: `messages`, `onSend`, `loading?`, `title?`, `placeholder?`, `height?`.
- `MessageBubble` — Single message display with user (right-aligned) or assistant (left-aligned) styling and basic markdown rendering. Props: `role`, `content`, `timestamp?`.
- `PromptInput` — Textarea with send button. Enter to send, Shift+Enter for newline, loading/disabled states. Props: `onSend`, `loading?`, `placeholder?`, `disabled?`.
- `AiSearch` — Debounced semantic search input with results dropdown showing relevance scores. Props: `onSearch`, `placeholder?`, `debounceMs?`.
- `GenerateButton` — One-click AI content generation with loading state and Sparkles icon. Props: `onGenerate`, `label?`, `onResult`, `variant?` (`"button"` | `"icon"`).

## Testing

```sh
bun test packages/ui/
```

`test/interaction.test.tsx` drives real events through happy-dom. `react-dom/client` must load after the DOM registers, because React checks for a DOM once on import.

## Icons

Use `lucide-react`; prefer it over unicode symbols or custom SVGs. An `ActionIcon` requires an `aria-label`.

## Dependencies

- `react`, `react-dom` (v19)
- `lucide-react`
- `@tanstack/react-table` (v9), only for `@wess/atlas/ui/table` and admin lists
- Dev only: `sass` through `distribution/sass.ts` (`bunfig.toml` wires it into `Bun.serve` HTML imports; pass it as a plugin to `Bun.build`)
