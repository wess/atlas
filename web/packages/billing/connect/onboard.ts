import { validateUrl } from "../account/index.ts";
import { billingError } from "../errors.ts";
import { identifier, type StripeClient } from "../stripe/index.ts";
import { loadSeller, saveSeller } from "./seller.ts";
import type { ConnectStore, OnboardOptions, Seller } from "./types.ts";

// the seller is the merchant: full stripe dashboard, pays its own fees, and stripe (not the
// platform) carries negative balances. onboarding requirements are collected by stripe.
const accountParams = (seller: Seller, country?: string): URLSearchParams => {
  const params = new URLSearchParams({
    "controller[stripe_dashboard][type]": "full",
    "controller[fees][payer]": "account",
    "controller[losses][payments]": "stripe",
    "controller[requirement_collection]": "stripe",
    "capabilities[card_payments][requested]": "true",
    "metadata[sellerId]": seller.id,
  });
  if (seller.email) params.set("email", seller.email);
  if (country) params.set("country", country);
  return params;
};

const ensureAccount = async (
  store: ConnectStore,
  stripe: StripeClient,
  id: string,
  country?: string,
): Promise<Seller> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    let seller = await loadSeller(store, id);
    if (seller.accountId) return seller;
    if (!seller.onboardingKey) {
      const saved = await saveSeller(store, seller, { onboardingKey: crypto.randomUUID() });
      if (!saved) continue;
      seller = saved;
    }
    const account = await stripe.post("/accounts", accountParams(seller, country), `account:${seller.onboardingKey}`);
    const accountId = identifier(account);
    if (!accountId) throw billingError("unavailable", "Invalid billing account.");
    const saved = await saveSeller(store, seller, { accountId });
    if (saved) return saved;
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};

export const onboard = async (
  store: ConnectStore,
  stripe: StripeClient,
  input: OnboardOptions,
): Promise<{ url: string }> => {
  validateUrl(input.returnUrl);
  validateUrl(input.refreshUrl);
  const country = input.country?.toUpperCase();
  if (country !== undefined && !/^[A-Z]{2}$/.test(country))
    throw billingError("invalid_request", "Country must be a two-letter ISO code.");
  const seller = await ensureAccount(store, stripe, input.sellerId, country);
  // account links are single use and short lived, so each visit asks for a fresh one.
  const link = await stripe.post(
    "/account_links",
    new URLSearchParams({
      account: seller.accountId!,
      type: "account_onboarding",
      return_url: input.returnUrl,
      refresh_url: input.refreshUrl,
    }),
  );
  if (typeof link.url !== "string") throw billingError("unavailable", "Onboarding is not available.");
  return { url: link.url };
};
