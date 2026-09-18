import { loadAccount, saveAccount, validateUrl } from "../account/index.ts";
import { billingError } from "../errors.ts";
import { identifier, type StripeClient } from "../stripe/index.ts";
import { isCurrent, reconcile } from "../subscription/index.ts";
import type { BillingOptions, CheckoutOptions } from "../types.ts";

export const checkout = async (
  options: BillingOptions,
  stripe: StripeClient,
  input: CheckoutOptions,
): Promise<{ url: string }> => {
  if (!Object.hasOwn(options.prices, input.plan)) throw billingError("invalid_request", "Choose an available plan.");
  validateUrl(input.successUrl);
  validateUrl(input.cancelUrl);
  const metadataKey = options.accountMetadataKey ?? "accountId";
  for (let retry = 0; retry < 16; retry++) {
    let account = await loadAccount(options.store, input.accountId);
    if (account.customerId) {
      account = await reconcile(options.store, stripe, options.prices, account.id);
      if (isCurrent(account.subscription))
        throw billingError("conflict", "A subscription already exists. Use the billing portal to change it.");
    }
    if (!account.checkout) {
      const saved = await saveAccount(options.store, account, {
        checkout: {
          key: crypto.randomUUID(),
          plan: input.plan,
          priceId: options.prices[input.plan]!,
          email: account.email,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          sessionId: null,
        },
      });
      if (!saved) continue;
      account = saved;
    }
    const pending = account.checkout!;
    if (!account.customerId) {
      const params = new URLSearchParams({ [`metadata[${metadataKey}]`]: account.id });
      if (pending.email) params.set("email", pending.email);
      const customer = await stripe.post("/customers", params, `customer:${pending.key}`);
      const customerId = identifier(customer);
      if (!customerId) throw billingError("unavailable", "Invalid billing customer.");
      const saved = await saveAccount(options.store, account, { customerId });
      if (!saved) continue;
      account = saved;
    }
    // an unknown result can be retried with the same key; an old request cannot create a
    // fresh session after its fixed expiry, even after Stripe's idempotency cache expires.
    if (!pending.sessionId && pending.expiresAt <= Date.now() / 1000) {
      await saveAccount(options.store, account, { checkout: null });
      continue;
    }
    const params = new URLSearchParams({
      mode: "subscription",
      customer: account.customerId!,
      "line_items[0][price]": pending.priceId,
      "line_items[0][quantity]": "1",
      success_url: pending.successUrl,
      cancel_url: pending.cancelUrl,
      client_reference_id: account.id,
      [`metadata[${metadataKey}]`]: account.id,
      [`subscription_data[metadata][${metadataKey}]`]: account.id,
      expires_at: String(pending.expiresAt),
    });
    const session = pending.sessionId
      ? await stripe.get(`/checkout/sessions/${encodeURIComponent(pending.sessionId)}`)
      : await stripe.post("/checkout/sessions", params, `checkout:${pending.key}`);
    const sessionId = identifier(session);
    if (!sessionId || identifier(session.customer) !== account.customerId)
      throw billingError("unavailable", "Invalid billing checkout session.");
    if (!pending.sessionId) {
      const saved = await saveAccount(options.store, account, {
        checkout: { ...pending, sessionId },
      });
      if (!saved) continue;
      account = saved;
    }
    if (session.status === "complete") {
      const synced = await reconcile(options.store, stripe, options.prices, account.id);
      if (!isCurrent(synced.subscription) && synced.subscription?.id === identifier(session.subscription)) {
        await saveAccount(options.store, synced, { checkout: null });
        continue;
      }
      throw billingError("conflict", "Checkout is complete. Your subscription is being synchronized.");
    }
    if (session.status === "expired") {
      await saveAccount(options.store, account, { checkout: null });
      continue;
    }
    if (session.status !== "open" || typeof session.url !== "string")
      throw billingError("unavailable", "Checkout is not available.");
    if (pending.plan !== input.plan || pending.priceId !== options.prices[input.plan]) {
      await stripe.post(
        `/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
        new URLSearchParams(),
        `expire:${sessionId}`,
      );
      await saveAccount(options.store, account, { checkout: null });
      continue;
    }
    return { url: session.url };
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};
