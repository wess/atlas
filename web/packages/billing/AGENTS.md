# @atlas/billing

Stripe subscriptions, hosted checkout, customer portal sessions, and verified
webhooks. Import from `@wess/atlas/billing` (or map `@atlas/billing` locally).
Functional factories, no Stripe SDK or UI dependency.

## Setup

```ts
import { createBilling, type BillingStore } from "@wess/atlas/billing"

const billing = createBilling({
  secretKey: process.env.STRIPE_SECRET_KEY ?? "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  prices: { starter: "price_starter", team: "price_team" },
  store, // implements BillingStore below
  // accountMetadataKey: "accountId", // default; use "userId" for an existing integration
  // apiVersion: "...",              // otherwise uses the Stripe account's API version
})

// authorize the caller against this account before invoking these methods.
const { url } = await billing.checkout({
  accountId: organization.id,
  plan: "starter",
  successUrl: "https://app.example.com/billing?success",
  cancelUrl: "https://app.example.com/billing?cancelled",
})

await billing.portal(organization.id, "https://app.example.com/billing")
await billing.subscription(organization.id) // persisted state; no provider request
await billing.sync(organization.id)         // reconcile with Stripe, then persist

// use the untouched request body; no session authentication on this endpoint.
await billing.webhook(await request.text(), request.headers.get("stripe-signature") ?? "")
```

Keys and prices are explicit configuration. The factory does not read environment
variables. Empty secrets fail when an operation needs them, allowing apps without
billing configured to start normally. Supply return URLs from trusted app config,
never directly from client input.

## Storage contract

```ts
type BillingAccount = {
  id: string
  email: string | null
  customerId: string | null
  subscription: Subscription | null
  checkout: CheckoutAttempt | null
  revision: number
}

type BillingStore = {
  get(id: string): Promise<BillingAccount | null>
  findByCustomer(customerId: string): Promise<BillingAccount | null>
  save(next: BillingAccount, expectedRevision: number): Promise<boolean>
  hasEvent(id: string): Promise<boolean>
  recordEvent(id: string): Promise<void>
}
```

The app creates billing accounts. IDs are opaque strings. Each account owns one
dedicated Stripe customer and at most one nonterminal subscription.

`save` must atomically compare the persisted revision with `expectedRevision` and
write the complete new state, including `next.revision`, only when they match.
Return false on a conflict. Enforce unique customer IDs across accounts. Update
any application entitlement projection in the same atomic write. Do not implement
this as a separate read followed by an unconditional write.

Persist checkout attempts and event receipts across processes and restarts.
`recordEvent` must be idempotent and is called only after state is saved. If storing
the receipt fails, throw: retrying the event safely reconciles current state again.
No database schema or migration is imposed by the package.

## Lifecycle

- Checkout creates and stores the customer before opening a session. It persists
  a request key and fixed parameters before making provider writes, reuses open
  sessions, and expires the previous session before changing plans.
- Checkout sessions expire after one hour. An uncertain request retries with the
  same idempotency key and expiry; it cannot become a new session after that expiry.
- Any nonterminal subscription (including incomplete, paused, unpaid, or past due)
  blocks a second checkout. Direct existing subscribers to `portal` for changes.
- Webhooks verify HMAC using Web Crypto, accept every `v1` rotation signature, and
  enforce a five-minute timestamp tolerance. Never parse/re-serialize before verifying.
- Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  and `customer.subscription.created`, `.updated`, `.deleted`.
- Supported events reconcile the customer's current subscriptions; event timestamps
  and stale event snapshots never determine entitlement. Conditional writes refetch
  after a concurrent update. Duplicate event IDs are skipped after successful processing.
- Unknown event types and unrelated customers without account metadata are ignored.
  Missing accounts with metadata, conflicting customer mappings, or multiple current
  subscriptions fail for retry/review instead of silently granting access.

## State and policy

`Subscription` contains `id`, `customerId`, `status`, `priceIds`, `plan`, and
`cancelAtPeriodEnd`. `plan` is null unless exactly one configured plan matches the
subscription's prices. It describes the product, not permission to use it. The app
decides which statuses grant access, grace periods, quotas, seats, and admin overrides.
Cancellation scheduling remains visible through `cancelAtPeriodEnd`.

`CheckoutAttempt` contains `key`, `plan`, `priceId`, `email`, `successUrl`, `cancelUrl`,
`expiresAt` (Unix seconds), and nullable `sessionId`.

## Errors and HTTP integration

`isBillingError(error)` narrows errors with codes `invalid_request`,
`invalid_signature`, `invalid_event`, `not_found`, `conflict`, or `unavailable`.
Use 400 for invalid input/signatures, 409 for checkout conflicts, and 503 for provider
failures. For webhooks, return a non-2xx retryable response on storage/provider/account
resolution failures; acknowledge only after `webhook` resolves. Transport and storage
errors may also throw normally. Provider error bodies are never exposed to callers.

`verifySignature(body, header, secret, { now?, tolerance? })` is also exported.
`now` and `tolerance` use seconds; the tolerance must be positive.

## Dependencies and tests

Uses `@atlas/request` internally through a relative import and platform fetch/Web
Crypto APIs. No external runtime dependencies.

```sh
bun test packages/billing/
bunx tsc --noEmit -p packages/billing/tsconfig.json
```
