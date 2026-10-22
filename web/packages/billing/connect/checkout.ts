import { validateUrl } from "../account/index.ts";
import { billingError } from "../errors.ts";
import { identifier } from "../stripe/index.ts";
import { reconcilePayment, type Scoped, savePayment } from "./payment.ts";
import { loadSeller } from "./seller.ts";
import type { ConnectOptions, Payment, PaymentOptions } from "./types.ts";

const validate = (input: PaymentOptions): void => {
  if (!input.paymentId) throw billingError("invalid_request", "Payments need an id.");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw billingError("invalid_request", "Amount must be a positive whole number of minor units.");
  if (!/^[a-z]{3}$/.test(input.currency))
    throw billingError("invalid_request", "Currency must be a lowercase three-letter ISO code.");
  if (!input.item.name.trim()) throw billingError("invalid_request", "Items need a name.");
  if (input.item.image) validateUrl(input.item.image);
  validateUrl(input.successUrl);
  validateUrl(input.cancelUrl);
};

const fresh = (): Pick<Payment, "key" | "expiresAt" | "sessionId" | "status"> => ({
  key: crypto.randomUUID(),
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  sessionId: null,
  status: "open",
});

const sameRequest = (payment: Payment, input: PaymentOptions): boolean =>
  payment.sellerId === input.sellerId &&
  payment.amount === input.amount &&
  payment.currency === input.currency &&
  JSON.stringify(payment.item) === JSON.stringify(input.item);

const sessionParams = (payment: Payment, tax: boolean): URLSearchParams => {
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": payment.currency,
    "line_items[0][price_data][unit_amount]": String(payment.amount),
    "line_items[0][price_data][product_data][name]": payment.item.name,
    success_url: payment.successUrl,
    cancel_url: payment.cancelUrl,
    client_reference_id: payment.id,
    "metadata[paymentId]": payment.id,
    "payment_intent_data[metadata][paymentId]": payment.id,
    expires_at: String(payment.expiresAt),
  });
  if (payment.item.description)
    params.set("line_items[0][price_data][product_data][description]", payment.item.description);
  if (payment.item.image) params.set("line_items[0][price_data][product_data][images][0]", payment.item.image);
  if (payment.fee > 0) params.set("payment_intent_data[application_fee_amount]", String(payment.fee));
  if (payment.email) params.set("customer_email", payment.email);
  if (tax) params.set("automatic_tax[enabled]", "true");
  return params;
};

export const checkout = async (
  options: ConnectOptions,
  scoped: Scoped,
  input: PaymentOptions,
): Promise<{ url: string }> => {
  validate(input);
  const seller = await loadSeller(options.store, input.sellerId);
  if (!seller.accountId || !seller.chargesEnabled)
    throw billingError("invalid_request", "This seller cannot accept payments yet.");
  const fee = options.fee({ sellerId: seller.id, amount: input.amount, currency: input.currency });
  if (!Number.isSafeInteger(fee) || fee < 0 || fee >= input.amount)
    throw billingError("invalid_request", "The platform fee must be a whole number below the amount.");
  const stripe = scoped(seller.accountId);
  for (let retry = 0; retry < 16; retry++) {
    let payment = await options.store.payment(input.paymentId);
    if (!payment) {
      const created: Payment = {
        id: input.paymentId,
        sellerId: seller.id,
        accountId: seller.accountId,
        amount: input.amount,
        currency: input.currency,
        fee,
        item: { ...input.item },
        email: input.email ?? null,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        intentId: null,
        total: null,
        amountRefunded: 0,
        dispute: null,
        pendingRefund: null,
        revision: 0,
        ...fresh(),
      };
      if (!(await options.store.createPayment(created))) continue;
      payment = created;
    }
    if (!sameRequest(payment, input))
      throw billingError("conflict", "This payment already exists with different details.");
    // an expired attempt may be retried under the same id; every other state is final for checkout.
    if (payment.status === "expired" || (!payment.sessionId && payment.expiresAt <= Date.now() / 1000)) {
      await savePayment(options.store, payment, fresh());
      continue;
    }
    if (payment.status !== "open") throw billingError("conflict", `This payment is already ${payment.status}.`);
    const session = payment.sessionId
      ? await stripe.get(`/checkout/sessions/${encodeURIComponent(payment.sessionId)}`)
      : await stripe.post(
          "/checkout/sessions",
          sessionParams(payment, options.tax === true),
          `checkout:${payment.key}`,
        );
    const sessionId = identifier(session);
    if (!sessionId) throw billingError("unavailable", "Invalid billing checkout session.");
    if (!payment.sessionId) {
      const saved = await savePayment(options.store, payment, { sessionId });
      if (!saved) continue;
      payment = saved;
    }
    if (session.status === "open" && typeof session.url === "string") return { url: session.url };
    const synced = await reconcilePayment(options.store, scoped, payment.id);
    if (synced.status !== "open" && synced.status !== "expired")
      throw billingError("conflict", `This payment is already ${synced.status}.`);
  }
  throw billingError("conflict", "Billing changed while processing. Please retry.");
};
