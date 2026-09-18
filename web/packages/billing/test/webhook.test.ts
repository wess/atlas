import { afterEach, beforeEach, expect, test } from "bun:test";
import { createBilling } from "../index.ts";
import { account, config, memoryStore, signature, stripeMock, subscription } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

const event = (id: string, value = subscription(), type = "customer.subscription.updated") =>
  JSON.stringify({ id, type, data: { object: value } });

test("reconciles current state, ignores old deletion snapshots, and deduplicates events", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  const billing = createBilling(config(memory.store));
  stripe.state.subscriptions = [subscription("sub_new", "active", "price_studio"), subscription("sub_old", "canceled")];
  const body = event("evt_old", subscription("sub_old", "canceled"), "customer.subscription.deleted");
  expect(await billing.webhook(body, await signature(body))).toEqual({ received: true });
  expect(memory.read().subscription).toMatchObject({ id: "sub_new", plan: "studio" });
  const calls = stripe.requests.length;
  expect(await billing.webhook(body, await signature(body))).toEqual({ received: true, duplicate: true });
  expect(stripe.requests.length).toBe(calls);
});

test("retries provider failures without marking an event processed", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  const billing = createBilling(config(memory.store));
  const body = event("evt_retry");
  stripe.state.failNext = true;
  await expect(billing.webhook(body, await signature(body))).rejects.toMatchObject({ code: "unavailable" });
  expect(memory.events.has("evt_retry")).toBe(false);
  stripe.state.subscriptions = [subscription()];
  await billing.webhook(body, await signature(body));
  expect(memory.events.has("evt_retry")).toBe(true);
});

test("a stale concurrent response must refetch after losing compare and swap", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  const billing = createBilling(config(memory.store));
  stripe.state.subscriptions = [subscription("sub_old", "active")];
  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  stripe.state.beforeList = async () => {
    stripe.state.beforeList = null;
    started();
    await pending;
  };
  const old = billing.sync("workspace/one");
  await ready;
  stripe.state.subscriptions = [subscription("sub_new", "active", "price_studio")];
  await billing.sync("workspace/one");
  release();
  await old;
  expect(memory.read().subscription).toMatchObject({ id: "sub_new", plan: "studio" });
  expect(stripe.requests.length).toBe(3);
});

test("resolves existing checkout metadata and binds a customer once", async () => {
  const memory = memoryStore();
  stripe.state.subscriptions = [subscription()];
  const billing = createBilling({ ...config(memory.store), accountMetadataKey: "userId" });
  const body = JSON.stringify({
    id: "evt_checkout",
    type: "checkout.session.completed",
    data: {
      object: { id: "cs_legacy", customer: "cus_one", metadata: { userId: "workspace/one" } },
    },
  });
  await billing.webhook(body, await signature(body));
  expect(memory.read().customerId).toBe("cus_one");
  expect(memory.read().subscription?.plan).toBe("solo");
});

test("rejects mismatched customer bindings and missing known accounts", async () => {
  const memory = memoryStore(account({ customerId: "cus_other" }));
  const billing = createBilling(config(memory.store));
  const body = event("evt_wrong");
  await expect(billing.webhook(body, await signature(body))).rejects.toMatchObject({ code: "conflict" });
  expect(stripe.requests.length).toBe(0);
  const missing = event("evt_missing", { ...subscription(), metadata: { accountId: "missing" } });
  await expect(billing.webhook(missing, await signature(missing))).rejects.toMatchObject({ code: "not_found" });
});

test("ignores unrelated events and customers without modifying accounts", async () => {
  const memory = memoryStore();
  const billing = createBilling(config(memory.store));
  for (const body of [
    JSON.stringify({ id: "evt_ignore", type: "invoice.paid" }),
    event("evt_unknown", { ...subscription(), metadata: { accountId: undefined } } as unknown as ReturnType<
      typeof subscription
    >),
  ]) {
    expect(await billing.webhook(body, await signature(body))).toEqual({ received: true, ignored: true });
  }
  expect(memory.read().revision).toBe(0);
});

test("validates signatures and event shapes before any state access", async () => {
  const billing = createBilling(config(memoryStore().store));
  await expect(billing.webhook(event("evt_bad"), "bad")).rejects.toMatchObject({ code: "invalid_signature" });
  for (const body of ["{", "null", "{}", JSON.stringify({ id: "evt_bad", type: "customer.subscription.updated" })]) {
    await expect(billing.webhook(body, await signature(body))).rejects.toMatchObject({ code: "invalid_event" });
  }
  expect(stripe.requests.length).toBe(0);
});

test("unknown prices do not grant a plan and multiple subscriptions require review", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  const billing = createBilling(config(memory.store));
  stripe.state.subscriptions = [subscription("sub_one", "active", "price_unknown")];
  expect((await billing.sync("workspace/one"))?.plan).toBeNull();
  stripe.state.subscriptions.push(subscription("sub_two"));
  await expect(billing.sync("workspace/one")).rejects.toMatchObject({ code: "conflict" });
});
