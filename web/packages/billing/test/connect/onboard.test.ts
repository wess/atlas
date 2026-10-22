import { afterEach, beforeEach, expect, test } from "bun:test";
import { createConnect } from "../../index.ts";
import { config, memoryStore, seller, stripeMock } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

const input = {
  sellerId: "seller/one",
  country: "us",
  returnUrl: "https://shop.example.test/payouts",
  refreshUrl: "https://shop.example.test/payouts/retry",
};

test("creates one seller-owned account and a fresh link on every visit", async () => {
  const memory = memoryStore();
  const connect = createConnect(config(memory.store));
  const first = await connect.onboard(input);
  await connect.onboard(input);
  expect(first.url).toBe("https://connect.stripe.com/setup/acct_1");
  expect(stripe.accounts.size).toBe(1);
  expect(memory.seller().accountId).toBe("acct_1");
  const created = stripe.requests.find((entry) => entry.path === "/accounts")!;
  expect(created.params.get("controller[stripe_dashboard][type]")).toBe("full");
  expect(created.params.get("controller[losses][payments]")).toBe("stripe");
  expect(created.params.get("country")).toBe("US");
  expect(created.params.get("metadata[sellerId]")).toBe("seller/one");
  expect(created.account).toBeNull();
  expect(stripe.requests.filter((entry) => entry.path === "/account_links")).toHaveLength(2);
});

test("a lost account response is retried with the same idempotency key", async () => {
  const memory = memoryStore();
  stripe.state.loseNextResponse = "/accounts";
  await expect(createConnect(config(memory.store)).onboard(input)).rejects.toThrow("Connection lost");
  await createConnect(config(memory.store)).onboard(input);
  const creates = stripe.requests.filter((entry) => entry.path === "/accounts");
  expect(creates[0]?.key).toBe(creates[1]?.key);
  expect(stripe.accounts.size).toBe(1);
});

test("sync records what the account can do and what stripe still needs", async () => {
  const memory = memoryStore();
  const connect = createConnect(config(memory.store));
  await connect.onboard(input);
  expect(await connect.sync("seller/one")).toMatchObject({
    chargesEnabled: false,
    requirementsDue: ["external_account"],
    disabledReason: "requirements.past_due",
  });
  Object.assign(stripe.accounts.get("acct_1")!, {
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: { currently_due: [], disabled_reason: null },
  });
  expect(await connect.sync("seller/one")).toMatchObject({ chargesEnabled: true, payoutsEnabled: true });
});

test("rejects bad input before touching stripe", async () => {
  const connect = createConnect(config(memoryStore(seller()).store));
  await expect(connect.onboard({ ...input, country: "usa" })).rejects.toMatchObject({ code: "invalid_request" });
  await expect(connect.onboard({ ...input, returnUrl: "javascript:alert(1)" })).rejects.toMatchObject({
    code: "invalid_request",
  });
  await expect(connect.onboard({ ...input, sellerId: "nobody" })).rejects.toMatchObject({ code: "not_found" });
  expect(stripe.requests).toHaveLength(0);
});
