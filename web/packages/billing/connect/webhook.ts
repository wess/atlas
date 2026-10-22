import { billingError } from "../errors.ts";
import { verifiedEvent } from "../event/index.ts";
import { identifier, object, type StripeClient, type StripeObject } from "../stripe/index.ts";
import type { WebhookResult } from "../types.ts";
import { reconcilePayment, type Scoped, savePayment } from "./payment.ts";
import { reconcileSeller, saveSeller } from "./seller.ts";
import type { ConnectOptions, ConnectStore } from "./types.ts";

const sessionEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

const chargeEvents = new Set([
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
]);

// true when the event was ours to handle.
const sellerEvent = async (
  store: ConnectStore,
  platform: StripeClient,
  account: string,
  value: StripeObject,
): Promise<boolean> => {
  if (identifier(value) !== account) throw billingError("invalid_event", "Account event does not match its account.");
  const hint = object(value.metadata)?.sellerId;
  const seller = (await store.sellerByAccount(account)) ?? (typeof hint === "string" ? await store.seller(hint) : null);
  // accounts created by this platform carry the seller id; never acknowledge one that is missing.
  if (!seller && typeof hint === "string") throw billingError("not_found", "Seller not found.");
  if (!seller) return false;
  if (seller.accountId && seller.accountId !== account)
    throw billingError("conflict", "Seller is linked to a different account.");
  // the account response was lost after stripe created it; the signed event links it instead.
  if (!seller.accountId && !(await saveSeller(store, seller, { accountId: account })))
    throw billingError("conflict", "Billing changed while processing. Please retry.");
  await reconcileSeller(store, platform, seller.id);
  return true;
};

// sellers run their own business on these accounts too, so unknown payments are not ours.
const paymentEvent = async (
  store: ConnectStore,
  scoped: Scoped,
  type: string,
  account: string,
  value: StripeObject,
): Promise<boolean> => {
  if (sessionEvents.has(type)) {
    const id = object(value.metadata)?.paymentId;
    const sessionId = identifier(value);
    const payment = typeof id === "string" ? await store.payment(id) : null;
    if (!payment || !sessionId || payment.accountId !== account) return false;
    if (payment.sessionId && payment.sessionId !== sessionId) return false;
    if (!payment.sessionId && !(await savePayment(store, payment, { sessionId })))
      throw billingError("conflict", "Billing changed while processing. Please retry.");
    await reconcilePayment(store, scoped, payment.id);
    return true;
  }
  const intentId = identifier(value.payment_intent);
  const payment = intentId ? await store.paymentByIntent(intentId) : null;
  if (!payment || payment.accountId !== account) return false;
  await reconcilePayment(store, scoped, payment.id);
  return true;
};

// takes the "connected accounts" endpoint; platform-only events have no account and are ignored.
export const webhook = async (
  options: ConnectOptions,
  platform: StripeClient,
  scoped: Scoped,
  body: string,
  signature: string,
): Promise<WebhookResult> => {
  const event = await verifiedEvent(body, signature, options.webhookSecret);
  const supported = event.type === "account.updated" || sessionEvents.has(event.type) || chargeEvents.has(event.type);
  if (!supported || !event.account) return { received: true, ignored: true };
  if (await options.store.hasEvent(event.id)) return { received: true, duplicate: true };
  if (!event.value) throw billingError("invalid_event", "Billing event is missing its object.");
  const handled =
    event.type === "account.updated"
      ? await sellerEvent(options.store, platform, event.account, event.value)
      : await paymentEvent(options.store, scoped, event.type, event.account, event.value);
  if (!handled) return { received: true, ignored: true };
  await options.store.recordEvent(event.id);
  return { received: true };
};
