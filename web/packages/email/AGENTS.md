# @atlas/email

Provider-agnostic email transport plus a minimal HTML email shell and two
ready-to-use templates (invite, password reset).

## Transports

```ts
import { createEmailer, createResendEmailer, createConsoleEmailer } from "@atlas/email"

// auto-detect: real Resend transport when both env vars are set, otherwise console
const emailer = createEmailer({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.RESEND_FROM,
})

// or pick directly
const real = createResendEmailer({ apiKey: KEY, from: "no-reply@example.com" })
const dev  = createConsoleEmailer()  // logs subject/body, returns ok: true, logged: true
```

The console transport is the default fall-through when `apiKey` or `from` are
blank — keeps dev environments unblocked without configuring a sending domain.

```ts
type Emailer = {
  readonly enabled: boolean
  readonly send: (msg: EmailMessage) => Promise<SendResult>
}

type EmailMessage = {
  readonly to: string | readonly string[]
  readonly subject: string
  readonly html: string
  readonly text?: string
  readonly replyTo?: string
  readonly from?: string  // overrides the transport default
}

type SendResult = { ok: true; id?: string; logged?: boolean } | { ok: false; error: string }
```

`send` never throws — failures come back as `{ ok: false, error }`. Surface
those to the caller (or audit-log them) rather than ignoring.

## Templates

```ts
import { inviteEmail, passwordResetEmail } from "@atlas/email"

const invite = inviteEmail({
  inviterName: "Wess",
  product: "Atlas",
  signupUrl: "https://app.example.com/signup?invite=…",
  note: "Excited to have you!",
  brand: "Atlas",       // optional, shown at the top of the card
  accent: "#5e81ac",    // optional, color of buttons / links
})

await emailer.send({ to: "user@example.com", ...invite })
```

Templates return `{ subject, html, text }` so they drop straight into
`Emailer.send`. Both `inviteEmail` and `passwordResetEmail` accept `brand` and
`accent` for theming; omit them for an unbranded card.

### Layout helper

```ts
import { layout, escapeHtml } from "@atlas/email"

const html = layout({
  title: "Welcome",
  body: `<p>Hi ${escapeHtml(user.name)} — glad you're here.</p>`,
  brand: "Atlas",
  footer: "Atlas · self-hostable apps",
  accent: "#5e81ac",
})
```

`layout` is a single-column 560px card with a gentle Nord-flavored palette,
inline-friendly styles (works in Outlook), and a button class (`<a class="btn">…`).
Always pass user-supplied strings through `escapeHtml` before interpolating.

## Dependencies

Zero — uses `fetch` (Bun / Node 18+). No SDK dependencies.

## Adding a provider

The `Emailer` interface is the only contract. To add Postmark, SES, etc., write
a `createXxxEmailer(opts)` that returns `{ enabled, send }` and falls back to
`createConsoleEmailer()` when not configured.

## Testing

```sh
bun test packages/email/
```
