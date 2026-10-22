import { afterEach, beforeEach, expect, test } from "bun:test";
import { createConnect } from "../../index.ts";
import { config, memoryStore, paymentInput, ready, seller, stripeMock } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

test("charges the seller's account directly and takes the platform fee", async () => {
  const memory = memoryStore(ready());
  const connect = createConnect(config(memory.store, { tax: true }));
  const result = await connect.checkout({ ...paymentInput, email: "buyer@example.test" });
  expect(result.url).toBe("https://checkout.stripe.com/cs_1");
  const request = stripe.requests.find((entry) => entry.path === "/checkout/sessions")!;
  expect(request.account).toBe("acct_1");
  expect(request.key).toBe(`checkout:${memory.payment("order/one").key}`);
  expect(request.params.get("mode")).toBe("payment");
  expect(request.params.get("line_items[0][price_data][unit_amount]")).toBe("1500");
  expect(request.params.get("payment_intent_data[application_fee_amount]")).toBe("105");
  expect(request.params.get("payment_intent_data[metadata][paymentId]")).toBe("order/one");
  expect(request.params.get("customer_email")).toBe("buyer@example.test");
  expect(request.params.get("automatic_tax[enabled]")).toBe("true");
  expect(memory.payment("order/one")).toMatchObject({ status: "open", sessionId: "cs_1", fee: 105 });
});

test("reuses the open session, concurrently and across restarts", async () => {
  const memory = memoryStore(ready());
  const results = await Promise.all([
    createConnect(config(memory.store)).checkout(paymentInput),
    createConnect(config(memory.store)).checkout(paymentInput),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(await createConnect(config(memory.store)).checkout(paymentInput)).toEqual(results[0]);
  expect(stripe.sessions.size).toBe(1);
});

test("a lost session response is retried with identical parameters", async () => {
  const memory = memoryStore(ready());
  stripe.state.loseNextResponse = "/checkout/sessions";
  await expect(createConnect(config(memory.store)).checkout(paymentInput)).rejects.toThrow("Connection lost");
  await createConnect(config(memory.store)).checkout(paymentInput);
  const creates = stripe.requests.filter((entry) => entry.path === "/checkout/sessions");
  expect(creates[0]?.key).toBe(creates[1]?.key);
  expect(String(creates[0]?.params)).toBe(String(creates[1]?.params));
  expect(stripe.sessions.size).toBe(1);
});

test("refuses a seller who cannot take payments yet", async () => {
  const connect = createConnect(config(memoryStore(seller({ accountId: "acct_1" })).store));
  await expect(connect.checkout(paymentInput)).rejects.toMatchObject({ code: "invalid_request" });
  expect(stripe.requests).toHaveLength(0);
});

test("validates amounts, currency and the fee", async () => {
  const connect = createConnect(config(memoryStore(ready()).store));
  for (const amount of [0, -5, 12.5]) {
    await expect(connect.checkout({ ...paymentInput, amount })).rejects.toMatchObject({ code: "invalid_request" });
  }
  await expect(connect.checkout({ ...paymentInput, currency: "USD" })).rejects.toMatchObject({
    code: "invalid_request",
  });
  const greedy = createConnect(config(memoryStore(ready()).store, { fee: ({ amount }) => amount }));
  await expect(greedy.checkout(paymentInput)).rejects.toMatchObject({ code: "invalid_request" });
  expect(stripe.requests).toHaveLength(0);
});

test("one payment id cannot be reused for a different price", async () => {
  const connect = createConnect(config(memoryStore(ready()).store));
  await connect.checkout(paymentInput);
  await expect(connect.checkout({ ...paymentInput, amount: 100 })).rejects.toMatchObject({ code: "conflict" });
});

test("an expired session restarts under the same payment id", async () => {
  const memory = memoryStore(ready());
  const connect = createConnect(config(memory.store));
  await connect.checkout(paymentInput);
  stripe.sessions.get("cs_1")!.status = "expired";
  const next = await connect.checkout(paymentInput);
  expect(next.url).toContain("cs_2");
  const keys = stripe.requests.filter((entry) => entry.path === "/checkout/sessions").map((entry) => entry.key);
  expect(new Set(keys).size).toBe(2);
});

test("a paid payment never opens another checkout", async () => {
  const memory = memoryStore(ready());
  const connect = createConnect(config(memory.store));
  await connect.checkout(paymentInput);
  stripe.pay("cs_1");
  await expect(connect.checkout(paymentInput)).rejects.toMatchObject({ code: "conflict" });
  expect(memory.payment("order/one")).toMatchObject({
    status: "paid",
    intentId: "pi_cs_1",
    total: 1500,
    email: "buyer@example.test",
  });
  expect(stripe.sessions.size).toBe(1);
});
