import { loadAccount, validateUrl } from "./account/index.ts";
import { checkout } from "./checkout/index.ts";
import { billingError } from "./errors.ts";
import { createStripeClient } from "./stripe/index.ts";
import { reconcile } from "./subscription/index.ts";
import type { Billing, BillingOptions } from "./types.ts";
import { webhook } from "./webhook/index.ts";

export type { BillingError, BillingErrorCode } from "./errors.ts";
export { isBillingError } from "./errors.ts";
export { verifySignature } from "./signature/index.ts";
export type {
  Billing,
  BillingAccount,
  BillingOptions,
  BillingStore,
  CheckoutAttempt,
  CheckoutOptions,
  Subscription,
  WebhookResult,
} from "./types.ts";

export const createBilling = (options: BillingOptions): Billing => {
  const prices = { ...options.prices };
  if (
    Object.values(prices).some((value) => !value) ||
    new Set(Object.values(prices)).size !== Object.keys(prices).length
  )
    throw billingError("invalid_request", "Billing prices must be nonempty and unique.");
  const config = { ...options, prices };
  const stripe = createStripeClient(config.secretKey, config.apiVersion);
  return {
    checkout: (input) => checkout(config, stripe, input),
    portal: async (id, returnUrl) => {
      validateUrl(returnUrl);
      const account = await loadAccount(config.store, id);
      if (!account.customerId) throw billingError("invalid_request", "Choose a paid plan first.");
      const session = await stripe.post(
        "/billing_portal/sessions",
        new URLSearchParams({
          customer: account.customerId,
          return_url: returnUrl,
        }),
      );
      if (typeof session.url !== "string") throw billingError("unavailable", "Billing portal is not available.");
      return { url: session.url };
    },
    subscription: async (id) => (await loadAccount(config.store, id)).subscription,
    sync: async (id) => (await reconcile(config.store, stripe, prices, id)).subscription,
    webhook: (body, signature) => webhook(config, stripe, body, signature),
  };
};
