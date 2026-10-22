import { afterEach, beforeEach, expect, test } from "bun:test";
import { createConnect } from "../../index.ts";
import { config, memoryStore, paymentInput, ready, stripeMock } from "./fixture.ts";

let stripe: ReturnType<typeof stripeMock>;
beforeEach(() => {
  stripe = stripeMock();
});
afterEach(() => stripe.restore());

const paid = async () => {
  const memory = memoryStore(ready());
  const connect = createConnect(config(memory.store));
  await connect.checkout(paymentInput);
  stripe.pay("cs_1");
  return { memory, connect };
};

test("partial then full refunds on the seller's account return the platform fee", async () => {
  const { connect } = await paid();
  expect(await connect.refund("order/one", 500)).toMatchObject({ status: "partially_refunded", amountRefunded: 500 });
  expect(await connect.refund("order/one")).toMatchObject({ status: "refunded", amountRefunded: 1500 });
  const refunds = stripe.requests.filter((entry) => entry.path === "/refunds" && entry.method === "POST");
  expect(refunds.map((entry) => entry.account)).toEqual(["acct_1", "acct_1"]);
  expect(refunds[0]?.params.get("refund_application_fee")).toBe("true");
  expect(refunds[0]?.params.get("amount")).toBe("500");
  expect(refunds[1]?.params.has("amount")).toBe(false);
  expect(refunds[0]?.key).not.toBe(refunds[1]?.key);
});

test("a refund whose response was lost is never applied twice", async () => {
  const { memory, connect } = await paid();
  stripe.state.loseNextResponse = "/refunds";
  await expect(connect.refund("order/one", 500)).rejects.toThrow("Connection lost");
  expect(memory.payment("order/one").pendingRefund?.amount).toBe(500);
  expect(stripe.refunds).toHaveLength(1);
  expect(await connect.refund("order/one", 500)).toMatchObject({
    status: "partially_refunded",
    amountRefunded: 500,
    pendingRefund: null,
  });
  expect(stripe.refunds).toHaveLength(1);
  expect(stripe.requests.filter((entry) => entry.path === "/refunds" && entry.method === "POST")).toHaveLength(1);
});

test("a different refund after an interrupted one finishes the first and asks for review", async () => {
  const { memory, connect } = await paid();
  stripe.state.loseNextResponse = "/refunds";
  await expect(connect.refund("order/one", 500)).rejects.toThrow("Connection lost");
  await expect(connect.refund("order/one")).rejects.toMatchObject({ code: "conflict" });
  expect(stripe.refunds).toHaveLength(1);
  expect(memory.payment("order/one")).toMatchObject({ amountRefunded: 500, pendingRefund: null });
});

test("refuses unpaid payments and amounts over what remains", async () => {
  const memory = memoryStore(ready());
  const connect = createConnect(config(memory.store));
  await connect.checkout(paymentInput);
  await expect(connect.refund("order/one")).rejects.toMatchObject({ code: "conflict" });
  stripe.pay("cs_1");
  await expect(connect.refund("order/one", 1501)).rejects.toMatchObject({ code: "invalid_request" });
  await expect(connect.refund("order/one", 0)).rejects.toMatchObject({ code: "invalid_request" });
  expect(stripe.refunds).toHaveLength(0);
});
