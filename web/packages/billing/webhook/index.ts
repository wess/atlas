import { billingError } from "../errors.ts";
import { verifySignature } from "../signature/index.ts";
import { identifier, object, type StripeClient } from "../stripe/index.ts";
import { reconcile } from "../subscription/index.ts";
import type { BillingOptions, WebhookResult } from "../types.ts";

const supported = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export const webhook = async (
  options: BillingOptions,
  stripe: StripeClient,
  body: string,
  signature: string,
): Promise<WebhookResult> => {
  if (!options.webhookSecret) throw billingError("unavailable", "Billing webhooks are not configured.");
  if (!(await verifySignature(body, signature, options.webhookSecret)))
    throw billingError("invalid_signature", "Invalid billing webhook signature.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw billingError("invalid_event", "Invalid billing webhook payload.");
  }
  const event = object(parsed);
  if (!event || !identifier(event) || typeof event.type !== "string")
    throw billingError("invalid_event", "Invalid billing webhook event.");
  if (!supported.has(event.type)) return { received: true, ignored: true };
  const eventId = identifier(event)!;
  if (await options.store.hasEvent(eventId)) return { received: true, duplicate: true };
  const value = object(object(event.data)?.object);
  const customerId = identifier(value?.customer);
  if (!value || !identifier(value) || !customerId)
    throw billingError("invalid_event", "Billing event is missing its customer or object.");
  const metadata = object(value.metadata);
  const hint = metadata?.[options.accountMetadataKey ?? "accountId"];
  const account =
    (await options.store.findByCustomer(customerId)) ??
    (typeof hint === "string" ? await options.store.get(hint) : null);
  // unrelated customers can share a Stripe endpoint; never acknowledge a known but missing account.
  if (!account && typeof hint === "string") throw billingError("not_found", "Billing account not found.");
  if (!account) return { received: true, ignored: true };
  if (typeof hint === "string" && hint !== account.id)
    throw billingError("conflict", "Billing metadata does not match its customer.");
  await reconcile(options.store, stripe, options.prices, account.id, customerId);
  await options.store.recordEvent(eventId);
  return { received: true };
};
