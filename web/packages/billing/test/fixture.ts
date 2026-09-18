import type { BillingAccount, BillingStore } from "../index.ts";

export const account = (changes: Partial<BillingAccount> = {}): BillingAccount => ({
  id: "workspace/one",
  email: "owner@example.test",
  customerId: null,
  subscription: null,
  checkout: null,
  revision: 0,
  ...changes,
});

export const memoryStore = (initial = account()) => {
  let value = structuredClone(initial);
  const events = new Set<string>();
  const store: BillingStore = {
    get: async (id) => (id === value.id ? structuredClone(value) : null),
    findByCustomer: async (id) => (id === value.customerId ? structuredClone(value) : null),
    save: async (next, revision) => {
      if (value.revision !== revision) return false;
      value = structuredClone(next);
      return true;
    },
    hasEvent: async (id) => events.has(id),
    recordEvent: async (id) => {
      events.add(id);
    },
  };
  return { store, read: () => structuredClone(value), events };
};

export const subscription = (id = "sub_new", status = "active", price = "price_solo") => ({
  id,
  customer: "cus_one",
  status,
  cancel_at_period_end: false,
  items: { data: [{ price: { id: price } }] },
  metadata: { accountId: "workspace/one" },
});

export const signature = async (body: string, timestamp = String(Math.floor(Date.now() / 1000))): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("whsec_test"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return `t=${timestamp},v1=${Buffer.from(digest).toString("hex")}`;
};

export const stripeMock = () => {
  const original = globalThis.fetch;
  const requests: Array<{ path: string; method: string; params: URLSearchParams; key: string | null }> = [];
  const sessions = new Map<string, Record<string, unknown>>();
  const responses = new Map<string, Record<string, unknown>>();
  const state = {
    subscriptions: [] as Array<ReturnType<typeof subscription>>,
    failNext: false,
    loseCheckoutResponse: false,
    beforeList: null as null | (() => Promise<void>),
  };
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://api.stripe.com") throw new Error(`Unexpected request: ${url}`);
    const path = url.pathname.replace("/v1", "");
    const params = new URLSearchParams(String(init?.body ?? ""));
    const method = init?.method ?? "GET";
    const key = new Headers(init?.headers).get("Idempotency-Key");
    requests.push({ path, method, params, key });
    if (state.failNext) {
      state.failNext = false;
      return new Response("error", { status: 503 });
    }
    if (key && responses.has(key)) return Response.json(responses.get(key));
    let data: Record<string, unknown>;
    if (path === "/subscriptions") {
      const subscriptions = structuredClone(state.subscriptions);
      if (state.beforeList) await state.beforeList();
      return Response.json({ data: subscriptions, has_more: false });
    }
    if (path === "/customers") data = { id: "cus_one" };
    else if (path === "/checkout/sessions") {
      const id = `cs_${sessions.size + 1}`;
      data = { id, customer: params.get("customer"), status: "open", url: `https://checkout.stripe.com/${id}` };
      sessions.set(id, data);
    } else if (path.startsWith("/checkout/sessions/")) {
      const id = path.split("/")[3]!;
      const session = sessions.get(id);
      if (!session) throw new Error(`Unknown session: ${path}`);
      if (path.endsWith("/expire")) session.status = "expired";
      data = { ...session };
    } else if (path === "/billing_portal/sessions") data = { url: "https://billing.stripe.com/portal" };
    else throw new Error(`Unexpected Stripe path: ${path}`);
    if (key) responses.set(key, structuredClone(data));
    if (path === "/checkout/sessions" && state.loseCheckoutResponse) {
      state.loseCheckoutResponse = false;
      throw new Error("Connection lost after provider accepted checkout");
    }
    return Response.json(data);
  }) as typeof fetch;
  return {
    requests,
    sessions,
    state,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

export const config = (store: BillingStore) => ({
  secretKey: "sk_test",
  webhookSecret: "whsec_test",
  prices: { solo: "price_solo", studio: "price_studio" },
  store,
});

export const checkoutInput = {
  accountId: "workspace/one",
  plan: "solo",
  successUrl: "https://app.example.test/success",
  cancelUrl: "https://app.example.test/cancel",
};
