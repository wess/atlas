import { billingError } from "../errors.ts";
import type { BillingAccount, BillingStore } from "../types.ts";

export const loadAccount = async (store: BillingStore, id: string): Promise<BillingAccount> => {
  const account = await store.get(id);
  if (!account) throw billingError("not_found", "Billing account not found.");
  return account;
};

export const saveAccount = async (
  store: BillingStore,
  account: BillingAccount,
  changes: Partial<Pick<BillingAccount, "customerId" | "subscription" | "checkout">>,
): Promise<BillingAccount | null> => {
  const next = { ...account, ...changes, revision: account.revision + 1 };
  return (await store.save(next, account.revision)) ? next : null;
};

export const validateUrl = (value: string): void => {
  if (!URL.canParse(value) || !["http:", "https:"].includes(new URL(value).protocol))
    throw billingError("invalid_request", "Billing return URLs must be absolute HTTP URLs.");
};
