# @atlas/share

Tiny composable helpers for sharing a URL via the channels users actually use:
the major socials (Twitter/X, Facebook, LinkedIn, Reddit), messengers
(WhatsApp, Telegram, SMS), and email (both `mailto:` links *and* server-side
send through `@atlas/email`).

The URL builders are pure functions — no DOM, no fetch, no SDKs. Render them in
React, Mantine, server-side templates, anywhere.

## Quick start

```ts
import { share, shareUrl, shareEmail, listChannels } from "@atlas/share"
import { createEmailer } from "@atlas/email"

const content = {
  url: "https://example.com/post/123",
  title: "Look at this",
  text: "A short blurb",
  hashtags: ["atlas", "bun"],   // twitter
  via: "atlas",                  // twitter
}

shareUrl("twitter", content)
// → https://twitter.com/intent/tweet?url=…&text=…&hashtags=atlas%2Cbun&via=atlas

share(content)
// → { twitter, facebook, linkedin, reddit, whatsapp, telegram, sms, email }

listChannels()
// → [{ channel: "twitter", label: "X (Twitter)" }, ...]

// Server-side share-by-email through any @atlas/email transport
const emailer = createEmailer({ apiKey: process.env.RESEND_API_KEY, from: "no-reply@example.com" })
await shareEmail({
  emailer,
  to: "friend@example.com",
  sharerName: "Wess",
  product: "Atlas",
  message: "thought you'd like this",
  content,
})
```

## ShareContent

```ts
type ShareContent = {
  url: string                          // required
  title?: string                       // headline / tweet text
  text?: string                        // longer copy / body
  hashtags?: readonly string[]         // twitter — no leading '#'
  via?: string                         // twitter handle, no leading '@'
  phone?: string                       // sms — e.g. "+15551234567"
  to?:  string | readonly string[]     // mailto
  cc?:  string | readonly string[]     // mailto
  bcc?: string | readonly string[]     // mailto
}
```

Each channel uses whichever fields make sense for it; unknown fields are
ignored. Required: `url`.

## Channels

| Channel | URL form |
|---------|----------|
| `twitter`  | `https://twitter.com/intent/tweet?url=&text=&hashtags=&via=` |
| `facebook` | `https://www.facebook.com/sharer/sharer.php?u=&quote=` |
| `linkedin` | `https://www.linkedin.com/sharing/share-offsite/?url=` |
| `reddit`   | `https://www.reddit.com/submit?url=&title=` |
| `whatsapp` | `https://wa.me/?text=` (title + text + url joined by blank lines) |
| `telegram` | `https://t.me/share/url?url=&text=` |
| `sms`      | `sms:[phone]?body=` |
| `email`    | `mailto:[to]?cc=&bcc=&subject=&body=` |

## Server-side email

`shareEmail(opts)` renders a single-column branded HTML email (uses
`@atlas/email`'s `layout` helper) and dispatches it through whatever
`Emailer` you hand it. Falls back to the console transport in dev exactly
like `inviteEmail` / `passwordResetEmail`.

```ts
type ShareEmailOptions = {
  emailer: Emailer
  to: string | readonly string[]
  from?: string
  replyTo?: string
  sharerName?: string
  product?: string
  message?: string
  content: ShareContent
  brand?: string
  accent?: string
}
```

Set `replyTo` to the sharer's email so the recipient can reply to them rather
than the sending domain.

`renderShareEmailMessage(opts)` returns the same `{ subject, html, text }`
without sending — useful for previews and tests.

## Adding a channel

Add a folder under `providers/<name>/index.ts` that exports a `ShareProvider`:

```ts
export const bluesky: ShareProvider = {
  channel: "bluesky",
  label: "Bluesky",
  build: (content) => `https://bsky.app/intent/compose?text=${encodeURIComponent(content.text ?? content.url)}`,
}
```

Then register it in `providers/index.ts` and `index.ts` (registry + channel
union).

## Dependencies

- `@atlas/email` — used by `shareEmail` for transport + HTML layout. URL
  builders themselves have zero deps and can be tree-shaken if you import
  channels directly.

## Testing

```sh
bun test packages/share/
```
