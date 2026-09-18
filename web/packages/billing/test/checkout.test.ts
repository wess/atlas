import { afterEach, beforeEach, expect, test } from "bun:test";
import { createBilling } from "../index.ts";
import { account, checkoutInput, config, memoryStore, stripeMock, subscription } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

test("persists a customer and reuses checkout across factory restarts", async () => {
  const memory = memoryStore();
  const first = await createBilling(config(memory.store)).checkout(checkoutInput);
  const second = await createBilling(config(memory.store)).checkout(checkoutInput);
  expect(first).toEqual(second);
  expect(stripe.sessions.size).toBe(1);
  expect(memory.read().customerId).toBe("cus_one");
  const request = stripe.requests.find((entry) => entry.path === "/checkout/sessions")!;
  expect(request.key).toBeTruthy();
  expect(request.params.get("subscription_data[metadata][accountId]")).toBe("workspace/one");
  expect(request.params.get("customer_email")).toBeNull();
  expect(request.params.get("line_items[0][price]")).toBe("price_solo");
});

test("concurrent checkouts share a durable attempt and session", async () => {
  const memory = memoryStore();
  const options = config(memory.store);
  const results = await Promise.all([
    createBilling(options).checkout(checkoutInput),
    createBilling(options).checkout(checkoutInput),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(stripe.sessions.size).toBe(1);
});

test("retries a lost checkout response with the original idempotency key", async () => {
  const memory = memoryStore();
  stripe.state.loseCheckoutResponse = true;
  await expect(createBilling(config(memory.store)).checkout(checkoutInput)).rejects.toThrow("Connection lost");
  const result = await createBilling(config(memory.store)).checkout(checkoutInput);
  expect(result.url).toContain("cs_1");
  expect(stripe.sessions.size).toBe(1);
  const requests = stripe.requests.filter((entry) => entry.path === "/checkout/sessions");
  expect(requests[0]?.key).toBe(requests[1]?.key);
  expect(String(requests[0]?.params)).toBe(String(requests[1]?.params));
});

test("blocks another checkout even when the paid webhook has not arrived", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  stripe.state.subscriptions = [subscription()];
  await expect(createBilling(config(memory.store)).checkout(checkoutInput)).rejects.toMatchObject({ code: "conflict" });
  expect(memory.read().subscription?.plan).toBe("solo");
  expect(stripe.sessions.size).toBe(0);
});

test("blocks incomplete, paused, unpaid and past due subscriptions too", async () => {
  for (const status of ["incomplete", "paused", "unpaid", "past_due", "trialing"]) {
    stripe.state.subscriptions = [subscription("sub_one", status)];
    const memory = memoryStore(account({ customerId: "cus_one" }));
    await expect(createBilling(config(memory.store)).checkout(checkoutInput)).rejects.toMatchObject({
      code: "conflict",
    });
  }
});

test("expires the old open session before changing the selected plan", async () => {
  const memory = memoryStore();
  const billing = createBilling(config(memory.store));
  await billing.checkout(checkoutInput);
  const next = await billing.checkout({ ...checkoutInput, plan: "studio" });
  expect(stripe.sessions.get("cs_1")?.status).toBe("expired");
  expect(next.url).toContain("cs_2");
  expect(memory.read().checkout?.plan).toBe("studio");
});

test("replaces an expired session but never repeats a completed checkout", async () => {
  const memory = memoryStore();
  const billing = createBilling(config(memory.store));
  await billing.checkout(checkoutInput);
  stripe.sessions.get("cs_1")!.status = "expired";
  expect((await billing.checkout(checkoutInput)).url).toContain("cs_2");
  stripe.sessions.get("cs_2")!.status = "complete";
  await expect(billing.checkout(checkoutInput)).rejects.toMatchObject({ code: "conflict" });
  expect(stripe.sessions.size).toBe(2);
});

test("validates plan and return URLs before sending requests", async () => {
  const billing = createBilling(config(memoryStore().store));
  for (const plan of ["toString", "__proto__", "free", "unknown"])
    await expect(billing.checkout({ ...checkoutInput, plan })).rejects.toMatchObject({ code: "invalid_request" });
  await expect(billing.checkout({ ...checkoutInput, successUrl: "javascript:alert(1)" })).rejects.toMatchObject({
    code: "invalid_request",
  });
  expect(stripe.requests.length).toBe(0);
});

test("allows resubscribing after cancellation, including a missed completion webhook", async () => {
  const memory = memoryStore();
  const billing = createBilling(config(memory.store));
  await billing.checkout(checkoutInput);
  Object.assign(stripe.sessions.get("cs_1")!, { status: "complete", subscription: "sub_old" });
  stripe.state.subscriptions = [subscription("sub_old", "canceled")];
  expect((await billing.checkout(checkoutInput)).url).toContain("cs_2");
});

test("synchronizing a paid subscription retires its checkout attempt", async () => {
  const memory = memoryStore();
  const billing = createBilling(config(memory.store));
  await billing.checkout(checkoutInput);
  stripe.state.subscriptions = [subscription()];
  await billing.sync("workspace/one");
  expect(memory.read().checkout).toBeNull();
  stripe.state.subscriptions = [subscription("sub_new", "canceled")];
  expect((await billing.checkout(checkoutInput)).url).toContain("cs_2");
});

test("portal uses the persisted customer and refuses accounts without one", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  expect(await createBilling(config(memory.store)).portal("workspace/one", checkoutInput.successUrl)).toEqual({
    url: "https://billing.stripe.com/portal",
  });
  expect(stripe.requests[0]?.params.get("customer")).toBe("cus_one");
  await expect(
    createBilling(config(memoryStore().store)).portal("workspace/one", checkoutInput.successUrl),
  ).rejects.toMatchObject({ code: "invalid_request" });
});
