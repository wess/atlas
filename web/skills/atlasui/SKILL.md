---
name: atlasui
description: Build React frontends with @wess/atlas/ui. Use for components, forms, tables, auth pages, color schemes and dark mode, client-side routing, or adding a new component with the factory and Sass in an Atlas app.
---

# Atlas UI

React with no component library underneath. Apps import compiled CSS once and need no Sass.

| Import | Holds |
|---|---|
| `@wess/atlas/ui/styles.css` | The stylesheet |
| `@wess/atlas/ui/components` | Primitives |
| `@wess/atlas/ui/headless` | Behaviour hooks, no markup |
| `@wess/atlas/ui/factory` | `component`, `compound`, `createField` |
| `@wess/atlas/ui/provider` | `AtlasProvider`, `AppShell` |
| `/forms` `/table` `/auth` `/nav` `/storage` `/cache` `/ai` | Ready-made blocks |

**Components:** ActionIcon, Alert, Anchor, AppShell, Badge, Breadcrumbs, Button, Checkbox, Code, Collapse, ColorModeControl, Divider, Group, Loader, MultiSelect, NavLink, NumberInput, Pagination, Paper, PasswordInput, ScrollArea, Select, SimpleGrid, Stack, Table, Tabs, Text, Textarea, TextInput, Title. If it isn't listed, it doesn't exist yet: build it with the factory below.

## Mount

```tsx
import "@wess/atlas/ui/styles.css"
import { Button, ColorModeControl, Paper, Stack, Title } from "@wess/atlas/ui/components"
import { AtlasProvider } from "@wess/atlas/ui/provider"
import { createRoot } from "react-dom/client"

createRoot(document.getElementById("root")!).render(
  <AtlasProvider>
    <Stack p="md" gap="sm">
      <Title order={1} tt="capitalize">Users</Title>
      <ColorModeControl />
      <Paper withBorder p="md">
        <Button color="danger" variant="light" onClick={() => {}}>Delete</Button>
      </Paper>
    </Stack>
  </AtlasProvider>,
)
```

- **`color` takes tones, not hues:** `primary danger success accent neutral`.
- **Spacing props:** `p pt mt mb mx my gap w h maw flex fw tt justify align`. Spacing accepts `xs`-`xl`, a number in px, or raw CSS.
- **Inputs** take `label description error required leftSection rightSection size`, and layout props land on the wrapper.
- **Native children:** `Table` takes plain `thead tr th td`. `Select` is a native `<select>`, with `data` as strings or `{ value, label }`.
- **Icon buttons:** `ActionIcon` requires `aria-label`.

## Color

Schemes are `nord` (default) and `atlas`; modes are `light`, `dark`, and `system` (default). Choices persist in localStorage. Use `<ColorModeControl />`, or `useColorMode()` for `{ mode, scheme, setMode, setScheme }`. Set defaults with `<AtlasProvider defaultScheme="atlas" defaultMode="dark">`, and override single tokens with `theme={{ primary: "#123456", "radius-md": "2px" }}`. Add `colorModeScript` from `/headless` to your HTML `<head>` so a saved choice applies before first paint. In your own CSS use `var(--atlas-*)`, such as `--atlas-ink`, `--atlas-surface`, `--atlas-border`, `--atlas-dimmed`, so it follows the mode.

## Routing

Every screen gets a real path. Never use `#` routes or view state for navigation. The server must serve the shell for those paths.

```tsx
import { isPlainClick, navigate, useLocation } from "@wess/atlas/ui/headless"

const Link = ({ to, children }: { to: string; children: string }) => (
  <a
    href={to}
    onClick={(event) => {
      if (!isPlainClick(event)) return
      event.preventDefault()
      navigate(to)
    }}
  >
    {children}
  </a>
)

export const App = () => {
  const { pathname, search } = useLocation()
  const page = new URLSearchParams(search).get("page") ?? "1"
  return pathname === "/settings" ? <Link to="/">Home</Link> : <Link to="/settings">{`Settings ${page}`}</Link>
}
```

Keep anything worth returning to, like a page, filter, or tab, in the query string. Use `navigate(to, { replace: true })` for keystrokes.

## Forms

```tsx
import { createForm, SelectField, SubmitButton, TextField } from "@wess/atlas/ui/forms"
import { z } from "zod"

const schema = z.object({ email: z.email("Enter an email"), role: z.string() })

const useSignup = createForm({
  schema,
  initial: { email: "", role: "user" },
  onSubmit: async (values) => {
    await fetch("/users", { method: "POST", body: JSON.stringify(values) })
  },
})

export const Signup = () => {
  const { form, handleSubmit } = useSignup()
  return (
    <form onSubmit={handleSubmit}>
      <TextField form={form} name="email" label="Email" />
      <SelectField form={form} name="role" options={[{ value: "user", label: "User" }]} />
      <SubmitButton>Save</SubmitButton>
    </form>
  )
}
```

Field names are flat; dotted paths aren't supported.

## Tables

```tsx
import { ActionColumn, createTable, DateColumn, TextColumn } from "@wess/atlas/ui/table"

type Row = { name: string; created: string }

export const People = createTable<Row>({
  data: [{ name: "Ada", created: "2026-01-01" }],
  columns: [
    TextColumn<Row>({ key: "name", label: "Name", sortable: true }),
    DateColumn<Row>({ key: "created", label: "Created" }),
    ActionColumn<Row>({ onDelete: () => {} }),
  ],
  search: true,
  pagination: true,
})
```

## Other blocks

`LoginPage SignupPage ResetPasswordPage` (`onSubmit` returns `{ error }` or nothing), `FileUpload ImagePreview`, `Sidebar NavLink Breadcrumb`, `CacheInspector CacheStatus`, `ChatWindow MessageBubble PromptInput AiSearch GenerateButton`.

## New component

```tsx
import { colors, component } from "@wess/atlas/ui/factory"

export const Notice = component({
  name: "notice",
  element: "aside",
  variants: { color: colors, dense: true },
  defaults: { color: "neutral" },
})
```

This renders `<aside class="atlas-notice" data-color="neutral">`, so style `.atlas-notice[data-dense]` in CSS with `var(--atlas-*)`. Behaviour goes in a hook that returns prop getters; the headless `useTabs`, `useListbox`, `useDisclosure`, `useControllable`, `useDebounced`, and `useForm` are there to use. Build inputs with `createField(kind, (control, props) => <input {...control} {...props} />)`, which handles label, error, and aria wiring. To add one inside Atlas, see `atlascontributing`.
