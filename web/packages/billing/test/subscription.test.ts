import { afterEach, beforeEach, expect, test } from "bun:test";
import { createBilling } from "../index.ts";
import { account, config, memoryStore, signature, stripeMock, subscription } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

const cases: Array<[string, Record<string, unknown>, boolean]> = [
  ["explicit period-end flag", { cancel_at_period_end: true }, true],
  ["subscription period end", { cancel_at: 200, current_period_end: 200 }, true],
  [
    "any item period end",
    {
      cancel_at: 200,
      current_period_end: 300,
      items: {
        data: [
          { price: { id: "price_solo" }, current_period_end: 300 },
          { price: { id: "price_extra" }, current_period_end: 200 },
        ],
      },
    },
    true,
  ],
  [
    "item period end without a subscription period end",
    {
      cancel_at: 200,
      items: { data: [{ price: { id: "price_solo" }, current_period_end: 200 }] },
    },
    true,
  ],
  ["no cancellation", {}, false],
  ["arbitrary cancellation date", { cancel_at: 150, current_period_end: 200 }, false],
  ["missing period end", { cancel_at: 200 }, false],
  ["null cancellation", { cancel_at: null, current_period_end: null }, false],
  ["zero cancellation", { cancel_at: 0, current_period_end: 0 }, false],
  ["negative cancellation", { cancel_at: -1, current_period_end: -1 }, false],
  ["string cancellation", { cancel_at: "200", current_period_end: "200" }, false],
  ["string period end", { cancel_at: 200, current_period_end: "200" }, false],
  ["truthy non-boolean flag", { cancel_at_period_end: "true" }, false],
  [
    "explicit flag with an arbitrary cancellation date",
    {
      cancel_at_period_end: true,
      cancel_at: 150,
      current_period_end: 200,
    },
    true,
  ],
];

test.each(cases)("sync normalizes %s", async (_name, schedule, expected) => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  stripe.state.subscriptions = [{ ...subscription(), ...schedule }];
  const result = await createBilling(config(memory.store)).sync("workspace/one");
  expect(result?.cancelAtPeriodEnd).toBe(expected);
  expect(memory.read().subscription?.cancelAtPeriodEnd).toBe(expected);
});

test("webhooks persist cancellation scheduling and its removal from current provider state", async () => {
  const memory = memoryStore(account({ customerId: "cus_one" }));
  const billing = createBilling(config(memory.store));
  const scheduled = { ...subscription(), cancel_at: 200, current_period_end: 200 };
  stripe.state.subscriptions = [scheduled];
  const body = (id: string) =>
    JSON.stringify({
      id,
      type: "customer.subscription.updated",
      data: { object: scheduled },
    });
  const first = body("evt_cancel");
  await billing.webhook(first, await signature(first));
  expect((await billing.subscription("workspace/one"))?.cancelAtPeriodEnd).toBe(true);

  stripe.state.subscriptions = [subscription()];
  const resumed = body("evt_resume");
  await billing.webhook(resumed, await signature(resumed));
  expect((await billing.subscription("workspace/one"))?.cancelAtPeriodEnd).toBe(false);
  expect(memory.events.has("evt_resume")).toBe(true);
});
