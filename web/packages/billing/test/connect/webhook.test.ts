import { afterEach, beforeEach, expect, test } from "bun:test";
import { createConnect } from "../../index.ts";
import { config, memoryStore, paymentInput, ready, seller, signed, stripeMock } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

const event = (id: string, type: string, object: Record<string, unknown>, account: string | null = "acct_1") =>
  signed({ id, type, account, data: { object } });

const opened = async () => {
  const memory = memoryStore(ready());
  const connect = createConnect(config(memory.store));
  await connect.checkout(paymentInput);
  return { memory, connect };
};

test("a completed session marks the payment paid from current provider state", async () => {
  const { memory, connect } = await opened();
  stripe.pay("cs_1");
  // the payload claims unpaid; the library trusts only what it fetches.
  const [body, signature] = await event("evt_1", "checkout.session.completed", {
    id: "cs_1",
    payment_status: "unpaid",
    metadata: { paymentId: "order/one" },
  });
  expect(await connect.webhook(body, signature)).toEqual({ received: true });
  expect(memory.payment("order/one").status).toBe("paid");
  const calls = stripe.requests.length;
  expect(await connect.webhook(body, signature)).toEqual({ received: true, duplicate: true });
  expect(stripe.requests.length).toBe(calls);
});

test("async payments move through processing to failed", async () => {
  const { memory, connect } = await opened();
  const session = stripe.sessions.get("cs_1")!;
  Object.assign(session, {
    status: "complete",
    payment_status: "unpaid",
    payment_intent: { id: "pi_cs_1", status: "processing", latest_charge: null },
  });
  const ref = { id: "cs_1", metadata: { paymentId: "order/one" } };
  await connect.webhook(...(await event("evt_1", "checkout.session.completed", ref)));
  expect(memory.payment("order/one").status).toBe("processing");
  session.payment_intent.status = "requires_payment_method";
  await connect.webhook(...(await event("evt_2", "checkout.session.async_payment_failed", ref)));
  expect(memory.payment("order/one").status).toBe("failed");
});

test("refunds and disputes are found by payment intent", async () => {
  const { memory, connect } = await opened();
  stripe.pay("cs_1");
  await connect.reconcile("order/one");
  stripe.sessions.get("cs_1")!.payment_intent.latest_charge.amount_refunded = 500;
  await connect.webhook(...(await event("evt_1", "charge.refunded", { id: "ch_cs_1", payment_intent: "pi_cs_1" })));
  expect(memory.payment("order/one")).toMatchObject({ status: "partially_refunded", amountRefunded: 500 });
  stripe.dispute("cs_1", "needs_response");
  const dispute = { id: "dp_cs_1", payment_intent: "pi_cs_1" };
  await connect.webhook(...(await event("evt_2", "charge.dispute.created", dispute)));
  expect(memory.payment("order/one")).toMatchObject({ status: "disputed", dispute: "needs_response" });
  stripe.dispute("cs_1", "won");
  await connect.webhook(...(await event("evt_3", "charge.dispute.closed", dispute)));
  expect(memory.payment("order/one").status).toBe("partially_refunded");
});

test("the seller's own sales on the same account are ignored", async () => {
  const { memory, connect } = await opened();
  const [body, signature] = await event("evt_1", "charge.refunded", { id: "ch_x", payment_intent: "pi_theirs" });
  expect(await connect.webhook(body, signature)).toEqual({ received: true, ignored: true });
  const foreign = await event("evt_2", "checkout.session.completed", { id: "cs_x", metadata: {} });
  expect(await connect.webhook(...foreign)).toEqual({ received: true, ignored: true });
  expect(memory.events.size).toBe(0);
});

test("a session event from another account cannot touch the payment", async () => {
  const { memory, connect } = await opened();
  const [body, signature] = await event(
    "evt_1",
    "checkout.session.completed",
    { id: "cs_1", metadata: { paymentId: "order/one" } },
    "acct_other",
  );
  expect(await connect.webhook(body, signature)).toEqual({ received: true, ignored: true });
  expect(memory.payment("order/one").status).toBe("open");
});

test("account updates sync the seller and adopt an account whose response was lost", async () => {
  const memory = memoryStore(seller({ onboardingKey: "key" }));
  const connect = createConnect(config(memory.store));
  stripe.accounts.set("acct_1", {
    id: "acct_1",
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: { currently_due: [], disabled_reason: null },
    metadata: { sellerId: "seller/one" },
  });
  const value = { id: "acct_1", metadata: { sellerId: "seller/one" } };
  expect(await connect.webhook(...(await event("evt_1", "account.updated", value)))).toEqual({ received: true });
  expect(memory.seller()).toMatchObject({ accountId: "acct_1", chargesEnabled: true });
  const missing = { id: "acct_2", metadata: { sellerId: "seller/gone" } };
  await expect(connect.webhook(...(await event("evt_2", "account.updated", missing, "acct_2")))).rejects.toMatchObject({
    code: "not_found",
  });
  expect(memory.events.has("evt_2")).toBe(false);
});

test("provider failures leave the event unrecorded for retry", async () => {
  const { memory, connect } = await opened();
  stripe.pay("cs_1");
  const args = await event("evt_1", "checkout.session.completed", {
    id: "cs_1",
    metadata: { paymentId: "order/one" },
  });
  stripe.state.failNext = true;
  await expect(connect.webhook(...args)).rejects.toMatchObject({ code: "unavailable" });
  expect(memory.events.has("evt_1")).toBe(false);
  await connect.webhook(...args);
  expect(memory.payment("order/one").status).toBe("paid");
});

test("rejects bad signatures and ignores platform events", async () => {
  const { connect } = await opened();
  const [body] = await event("evt_1", "checkout.session.completed", { id: "cs_1" });
  await expect(connect.webhook(body, "t=1,v1=bad")).rejects.toMatchObject({ code: "invalid_signature" });
  const platform = await event("evt_2", "checkout.session.completed", { id: "cs_1" }, null);
  expect(await connect.webhook(...platform)).toEqual({ received: true, ignored: true });
});
