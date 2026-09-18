import { loadAccount, saveAccount } from "../account/index.ts";
import { billingError } from "../errors.ts";
import { identifier, object, type StripeClient, type StripeObject } from "../stripe/index.ts";
import type { BillingAccount, BillingStore, Subscription } from "../types.ts";

export const isCurrent = (subscription: Subscription | null): boolean =>
  subscription !== null && !["canceled", "incomplete_expired"].includes(subscription.status);

const normalize = (value: StripeObject, prices: Record<string, string>): Subscription => {
  const id = identifier(value);
  const customerId = identifier(value.customer);
  const items = object(value.items)?.data;
  if (!id || !customerId || typeof value.status !== "string" || !Array.isArray(items))
    throw billingError("unavailable", "Invalid billing subscription.");
  const priceIds = items.map((item) => identifier(object(item)?.price));
  if (priceIds.some((price) => !price)) throw billingError("unavailable", "Invalid subscription price.");
  const plans = Object.entries(prices).filter(([, price]) => priceIds.includes(price));
  return {
    id,
    customerId,
    status: value.status,
    priceIds: priceIds as string[],
    plan: plans.length === 1 ? plans[0]![0] : null,
    cancelAtPeriodEnd: value.cancel_at_period_end === true,
  };
};

export const reconcile = async (
  store: BillingStore,
  stripe: StripeClient,
  prices: Record<string, string>,
  id: string,
  customerId?: string,
): Promise<BillingAccount> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const account = await loadAccount(store, id);
    if (customerId && account.customerId && account.customerId !== customerId)
      throw billingError("conflict", "Billing customer does not match this account.");
    const customer = account.customerId ?? customerId;
    if (!customer) return account;
    // reconcile the whole customer so deletion of an old subscription cannot replace a new one.
    const values = await stripe.list("/subscriptions", { customer, status: "all" });
    const subscriptions = values.map((value) => normalize(value, prices));
    if (subscriptions.some((value) => value.customerId !== customer))
      throw billingError("unavailable", "Subscription customer mismatch.");
    const current = subscriptions.filter(isCurrent);
    if (current.length > 1) throw billingError("conflict", "Multiple subscriptions require billing review.");
    const subscription =
      current[0] ?? subscriptions.find((value) => value.id === account.subscription?.id) ?? subscriptions[0] ?? null;
    const saved = await saveAccount(store, account, {
      customerId: customer,
      subscription,
      ...(isCurrent(subscription) ? { checkout: null } : {}),
    });
    if (saved) return saved;
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};
