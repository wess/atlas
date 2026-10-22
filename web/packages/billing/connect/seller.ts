import { billingError } from "../errors.ts";
import { identifier, object, type StripeClient } from "../stripe/index.ts";
import type { ConnectStore, Seller } from "./types.ts";

export const loadSeller = async (store: ConnectStore, id: string): Promise<Seller> => {
  const seller = await store.seller(id);
  if (!seller) throw billingError("not_found", "Seller not found.");
  return seller;
};

export const saveSeller = async (
  store: ConnectStore,
  seller: Seller,
  changes: Partial<Omit<Seller, "id" | "revision">>,
): Promise<Seller | null> => {
  const next = { ...seller, ...changes, revision: seller.revision + 1 };
  return (await store.saveSeller(next, seller.revision)) ? next : null;
};

export const reconcileSeller = async (store: ConnectStore, stripe: StripeClient, id: string): Promise<Seller> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const seller = await loadSeller(store, id);
    if (!seller.accountId) return seller;
    const account = await stripe.get(`/accounts/${encodeURIComponent(seller.accountId)}`);
    if (identifier(account) !== seller.accountId) throw billingError("unavailable", "Invalid billing account.");
    const requirements = object(account.requirements);
    const due = Array.isArray(requirements?.currently_due) ? requirements.currently_due : [];
    const saved = await saveSeller(store, seller, {
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      detailsSubmitted: account.details_submitted === true,
      requirementsDue: due.filter((value): value is string => typeof value === "string"),
      disabledReason: typeof requirements?.disabled_reason === "string" ? requirements.disabled_reason : null,
    });
    if (saved) return saved;
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};
