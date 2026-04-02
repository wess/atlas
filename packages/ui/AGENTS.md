# @atlas/ui

React + Mantine + TanStack frontend package with modular blocks.

## Architecture

Each block lives at `@atlas/ui/<block>` and can be imported independently.
All exports are also available from `@atlas/ui` for convenience.

## Blocks

### provider (`@atlas/ui/provider`)
- `AtlasProvider` — Root Mantine provider wrapper. Accepts optional `theme`.
- `AppShell` — Layout shell with optional `nav` and `header` slots.

### forms (`@atlas/ui/forms`)
- `createForm<T>(config)` — Returns a hook that provides `form` and `handleSubmit`. Supports optional Zod schema validation.
- `TextField` — Text input bound to a form field.
- `SelectField` — Select input bound to a form field with `options`.
- `SubmitButton` — Submit button with optional `loading` state.

### table (`@atlas/ui/table`)
- `TextColumn<T>(config)` — Column definition for text values.
- `DateColumn<T>(config)` — Column definition that formats dates.
- `ActionColumn<T>(config)` — Column with edit/delete action buttons.
- `createTable<T>(config)` — Returns a component rendering a data table with optional `pagination` and `search`.

### auth (`@atlas/ui/auth`)
- `LoginPage` — Email + password login form.
- `SignupPage` — Name + email + password signup form.
- `ResetPasswordPage` — Email-only password reset form.
All accept `onSubmit` returning `{ error?: string }` and optional `title`.

### storage (`@atlas/ui/storage`)
- `FileUpload` — Hidden file input with button trigger and filename display.
- `ImagePreview` — Image display inside a bordered paper.

### nav (`@atlas/ui/nav`)
- `NavLink` — Single navigation link with optional icon and active state.
- `Sidebar` — Vertical stack container for nav links.
- `Breadcrumb` — Breadcrumb trail from an array of `{ label, href? }` items.

### cache (`@atlas/ui/cache`)
- `CacheInspector` — Table view of cache entries with invalidate/flush actions.
- `CacheStatus` — Badge showing connection status, entry count, and hit rate.

## Usage

```tsx
// Import specific block
import { AtlasProvider, AppShell } from "@atlas/ui/provider"
import { createTable, TextColumn } from "@atlas/ui/table"

// Or import everything
import { AtlasProvider, createTable, LoginPage } from "@atlas/ui"
```

## Testing

```sh
bun test packages/ui/
```

## Icons

`lucide-react` is available and used throughout blocks for consistent iconography:
- **auth** — `Mail`, `Lock`, `User` icons on form fields
- **storage** — `Upload` on file button, `ImageIcon` as placeholder
- **nav** — Re-exports `Home`, `Users`, `Settings`, `FileText`, `LayoutDashboard` for convenience
- **cache** — `Database` in title, `Trash2` on invalidate, `RefreshCw` on flush
- **table** — `ChevronUp` / `ChevronDown` for sort indicators

When adding new blocks, prefer Lucide icons over unicode symbols or custom SVGs.

## Dependencies

- `@mantine/core`, `@mantine/hooks`, `@mantine/form` (v7)
- `@tanstack/react-table` (v8)
- `lucide-react`
- `react`, `react-dom` (v19)
