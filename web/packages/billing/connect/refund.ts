import { billingError } from "../errors.ts";
import { object } from "../stripe/index.ts";
import { reconcilePayment, type Scoped, savePayment } from "./payment.ts";
import type { ConnectStore, Payment } from "./types.ts";

type Pending = NonNullable<Payment["pendingRefund"]>;

// the refund's own key travels in its metadata, so a retry can see whether stripe already
// applied it without relying on the 24 hour idempotency cache.
const issue = async (scoped: Scoped, payment: Payment, pending: Pending): Promise<void> => {
  const stripe = scoped(payment.accountId);
  const existing = await stripe.list("/refunds", { payment_intent: payment.intentId! });
  if (existing.some((row) => object(row.metadata)?.refundKey === pending.key)) return;
  const params = new URLSearchParams({
    payment_intent: payment.intentId!,
    refund_application_fee: "true",
    "metadata[paymentId]": payment.id,
    "metadata[refundKey]": pending.key,
  });
  if (pending.amount !== null) params.set("amount", String(pending.amount));
  await stripe.post("/refunds", params, `refund:${pending.key}`);
};

// refunds the buyer from the seller's balance and returns the platform fee with it.
export const refund = async (store: ConnectStore, scoped: Scoped, id: string, amount?: number): Promise<Payment> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    let payment = await reconcilePayment(store, scoped, id);
    const pending = payment.pendingRefund;
    // an interrupted refund is finished before anything else; asking for it again is the retry.
    if (pending) {
      await issue(scoped, payment, pending);
      const cleared = await savePayment(store, payment, { pendingRefund: null });
      if (!cleared) continue;
      const settled = await reconcilePayment(store, scoped, id);
      if (pending.amount === (amount ?? null)) return settled;
      throw billingError(
        "conflict",
        "An earlier refund was just completed. Review the payment before refunding again.",
      );
    }
    if (!["paid", "partially_refunded"].includes(payment.status) || !payment.intentId || payment.total === null)
      throw billingError("conflict", `A ${payment.status} payment cannot be refunded.`);
    const remaining = payment.total - payment.amountRefunded;
    if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0 || amount > remaining))
      throw billingError("invalid_request", "Refund amount must be a whole number up to what remains.");
    const next = { key: crypto.randomUUID(), amount: amount ?? null };
    const saved = await savePayment(store, payment, { pendingRefund: next });
    if (!saved) continue;
    payment = saved;
    await issue(scoped, payment, next);
    if (await savePayment(store, payment, { pendingRefund: null })) return reconcilePayment(store, scoped, id);
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};
