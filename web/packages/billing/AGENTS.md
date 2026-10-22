# @wess/atlas/billing

Stripe subscriptions, hosted checkout, customer portal sessions, Connect
marketplace payments, and verified webhooks. Import from `@wess/atlas/billing` (or map `@wess/atlas/billing` locally).
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
Cancellation scheduling remains visible through `cancelAtPeriodEnd`. It is true
when Stripe sets `cancel_at_period_end` or a positive numeric `cancel_at` matches
the subscription's `current_period_end` or any item's `current_period_end`.
An arbitrary cancellation date does not count as period-end cancellation.

`CheckoutAttempt` contains `key`, `plan`, `priceId`, `email`, `successUrl`, `cancelUrl`,
`expiresAt` (Unix seconds), and nullable `sessionId`.

## Connect marketplace payments

`createConnect` is a separate factory for platforms whose sellers take one-time
payments: a storefront, a marketplace, pay-what-you-want sales. It shares the HTTP
client, signature verification, and error codes with `createBilling`.

```ts
import { createConnect, type ConnectStore } from "@wess/atlas/billing"

const connect = createConnect({
  secretKey: process.env.STRIPE_SECRET_KEY ?? "",
  webhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "",
  store, // implements ConnectStore below
  fee: ({ amount }) => Math.round(amount * 0.05) + 30, // minor units, 0 <= fee < amount
  // tax: true, // Stripe Tax on the seller's own registrations
})

const { url } = await connect.onboard({ sellerId, country: "US", returnUrl, refreshUrl })
await connect.sync(sellerId) // chargesEnabled, payoutsEnabled, requirementsDue

const { url } = await connect.checkout({
  paymentId: order.id, // the app's order id
  sellerId,
  amount: 1500,        // the buyer's chosen amount for pay-what-you-want
  currency: "usd",
  item: { name: "Brush pack", description, image },
  successUrl,
  cancelUrl,
})
await connect.payment(order.id)        // persisted; no provider request
await connect.refund(order.id, 500)    // omit the amount to refund what remains
await connect.webhook(rawBody, signature)
```

**Merchant model.** Onboarding creates a connected account with the full Stripe
dashboard, Stripe-collected requirements, the seller paying Stripe's fees, and Stripe
liable for negative balances (the controller equivalent of a Standard account).
Sellers are the merchant of record and manage their own disputes, tax, and payouts in
Stripe. Payments are direct charges on the seller's account
(`Stripe-Account` header) with `application_fee_amount`; refunds return the fee.

**Policy stays in the app.** Price floors, suggested prices, caps, and free products
are the app's decisions; free orders never reach this package. Checkout only rejects
non-integer or non-positive amounts, non-lowercase currencies, and a fee outside
`0 <= fee < amount`. Each self-hosted platform supplies its own key and fee.

### Storage contract

```ts
type ConnectStore = {
  seller(id: string): Promise<Seller | null>
  sellerByAccount(accountId: string): Promise<Seller | null>
  saveSeller(next: Seller, expectedRevision: number): Promise<boolean>
  payment(id: string): Promise<Payment | null>
  paymentByIntent(intentId: string): Promise<Payment | null>
  createPayment(next: Payment): Promise<boolean> // insert only if the id is unused
  savePayment(next: Payment, expectedRevision: number): Promise<boolean>
  hasEvent(id: string): Promise<boolean>
  recordEvent(id: string): Promise<void>
}
```

The app creates sellers (`id`, `email`, every other field empty, `revision: 0`).
The package creates payments. Saves follow the same compare-and-swap rules as
`BillingStore.save`. Enforce unique `accountId` across sellers and unique `intentId`
across payments.

### Lifecycle

- Onboarding persists an idempotency key before creating the account, so a lost
  response can never make a second account. Account links are single use; call
  `onboard` again for every visit.
- `checkout` creates the payment record before any provider write, reuses an open
  session, and restarts an expired one under the same `paymentId`. A `paymentId`
  cannot change seller, amount, currency, or item; use a new id. Paid, processing,
  failed, refunded, or disputed payments never open another checkout.
- `status` is `open`, `processing` (async methods), `paid`, `failed`, `expired`,
  `partially_refunded`, `refunded`, or `disputed`. Any dispute other than `won` or
  `warning_closed` reads as `disputed`. `total` is the charged amount including tax.
  The app decides which statuses grant access to what was bought.
- `refund` persists a pending request and tags the Stripe refund with its key. A
  retry first looks for that refund on Stripe, so an interrupted refund is applied
  exactly once, even after the idempotency cache expires. A different refund
  requested while one is pending completes the first and then fails with `conflict`.

### Webhooks

Create a separate Stripe webhook endpoint that listens to **connected accounts** and
pass its secret as `webhookSecret`. Subscribe to `account.updated`,
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`charge.refunded`, and `charge.dispute.created`, `.updated`, `.closed`.

Events only name what changed; the package refetches the account or session and saves
current state. Sellers run their own business on their accounts, so sessions without
a known `paymentId`, charges for unknown payment intents, and events from another
account are acknowledged as ignored. An `account.updated` for an account carrying a
`sellerId` that the store cannot find fails for retry. Platform events with no
`account` are ignored.

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

Uses `@wess/atlas/request` internally through a relative import and platform fetch/Web
Crypto APIs. No external runtime dependencies.

```sh
bun test packages/billing/
bunx tsc --noEmit -p packages/billing/tsconfig.json
```
