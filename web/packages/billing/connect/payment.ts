import { billingError } from "../errors.ts";
import { identifier, object, type StripeClient, type StripeObject } from "../stripe/index.ts";
import type { ConnectStore, Payment, PaymentStatus } from "./types.ts";

export type Scoped = (accountId: string) => StripeClient;

export const loadPayment = async (store: ConnectStore, id: string): Promise<Payment> => {
  const payment = await store.payment(id);
  if (!payment) throw billingError("not_found", "Payment not found.");
  return payment;
};

export const savePayment = async (
  store: ConnectStore,
  payment: Payment,
  changes: Partial<Omit<Payment, "id" | "revision">>,
): Promise<Payment | null> => {
  const next = { ...payment, ...changes, revision: payment.revision + 1 };
  return (await store.savePayment(next, payment.revision)) ? next : null;
};

const latestDispute = async (stripe: StripeClient, intentId: string): Promise<string | null> => {
  const page = await stripe.get(`/disputes?${new URLSearchParams({ payment_intent: intentId, limit: "1" })}`);
  if (!Array.isArray(page.data)) throw billingError("unavailable", "Invalid billing provider list.");
  const status = object(page.data[0])?.status;
  return typeof status === "string" ? status : null;
};

const number = (value: unknown): number | null => (typeof value === "number" ? value : null);

const status = (
  session: StripeObject,
  intent: StripeObject | null,
  charge: StripeObject | null,
  dispute: string | null,
): PaymentStatus => {
  if (session.status === "open") return "open";
  if (session.status === "expired") return "expired";
  if (session.status !== "complete") throw billingError("unavailable", "Invalid billing checkout session.");
  if (session.payment_status !== "paid")
    return ["requires_payment_method", "canceled"].includes(String(intent?.status)) ? "failed" : "processing";
  // a won dispute or a closed inquiry gives the money back; anything else withholds access.
  if (dispute && !["won", "warning_closed"].includes(dispute)) return "disputed";
  const refunded = number(charge?.amount_refunded) ?? 0;
  if (refunded > 0 && refunded >= (number(charge?.amount) ?? Number.POSITIVE_INFINITY)) return "refunded";
  return refunded > 0 ? "partially_refunded" : "paid";
};

// always read current provider state; event payloads only say which payment to look at.
export const reconcilePayment = async (store: ConnectStore, scoped: Scoped, id: string): Promise<Payment> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const payment = await loadPayment(store, id);
    if (!payment.sessionId) return payment;
    const stripe = scoped(payment.accountId);
    const session = await stripe.get(
      `/checkout/sessions/${encodeURIComponent(payment.sessionId)}?expand[]=payment_intent.latest_charge`,
    );
    if (identifier(session) !== payment.sessionId || object(session.metadata)?.paymentId !== payment.id)
      throw billingError("unavailable", "Invalid billing checkout session.");
    const subtotal = number(session.amount_subtotal);
    if (subtotal !== null && subtotal !== payment.amount)
      throw billingError("conflict", "Checkout amount does not match its payment.");
    const intent = object(session.payment_intent);
    const charge = object(intent?.latest_charge);
    const intentId = identifier(session.payment_intent) ?? payment.intentId;
    const dispute = charge?.disputed === true && intentId ? await latestDispute(stripe, intentId) : null;
    const email = object(session.customer_details)?.email;
    const saved = await savePayment(store, payment, {
      status: status(session, intent, charge, dispute),
      intentId,
      total: session.payment_status === "paid" ? number(session.amount_total) : payment.total,
      amountRefunded: number(charge?.amount_refunded) ?? 0,
      dispute,
      email: typeof email === "string" ? email : payment.email,
    });
    if (saved) return saved;
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};
