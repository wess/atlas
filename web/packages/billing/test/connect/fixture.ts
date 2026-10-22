import type { ConnectOptions, ConnectStore, Payment, Seller } from "../../index.ts";

export const seller = (changes: Partial<Seller> = {}): Seller => ({
  id: "seller/one",
  email: "maker@example.test",
  accountId: null,
  onboardingKey: null,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirementsDue: [],
  disabledReason: null,
  revision: 0,
  ...changes,
});

export const ready = () => seller({ accountId: "acct_1", chargesEnabled: true });

export const memoryStore = (initial: Seller = seller()) => {
  const sellers = new Map([[initial.id, structuredClone(initial)]]);
  const payments = new Map<string, Payment>();
  const events = new Set<string>();
  const store: ConnectStore = {
    seller: async (id) => structuredClone(sellers.get(id) ?? null),
    sellerByAccount: async (account) =>
      structuredClone([...sellers.values()].find((value) => value.accountId === account) ?? null),
    saveSeller: async (next, revision) => {
      if (sellers.get(next.id)?.revision !== revision) return false;
      sellers.set(next.id, structuredClone(next));
      return true;
    },
    payment: async (id) => structuredClone(payments.get(id) ?? null),
    paymentByIntent: async (intent) =>
      structuredClone([...payments.values()].find((value) => value.intentId === intent) ?? null),
    createPayment: async (next) => {
      if (payments.has(next.id)) return false;
      payments.set(next.id, structuredClone(next));
      return true;
    },
    savePayment: async (next, revision) => {
      if (payments.get(next.id)?.revision !== revision) return false;
      payments.set(next.id, structuredClone(next));
      return true;
    },
    hasEvent: async (id) => events.has(id),
    recordEvent: async (id) => {
      events.add(id);
    },
  };
  return {
    store,
    seller: (id = initial.id) => structuredClone(sellers.get(id)!),
    payment: (id: string) => structuredClone(payments.get(id)!),
    events,
  };
};

export const config = (store: ConnectStore, changes: Partial<ConnectOptions> = {}): ConnectOptions => ({
  secretKey: "sk_test",
  webhookSecret: "whsec_test",
  store,
  fee: ({ amount }) => Math.round(amount * 0.05) + 30,
  ...changes,
});

export const paymentInput = {
  paymentId: "order/one",
  sellerId: "seller/one",
  amount: 1500,
  currency: "usd",
  item: { name: "Brush pack" },
  successUrl: "https://shop.example.test/thanks",
  cancelUrl: "https://shop.example.test/item",
};

type Request = { path: string; method: string; params: URLSearchParams; key: string | null; account: string | null };
type Row = Record<string, any>;

// a small stateful stripe: accounts, sessions on connected accounts, charges, refunds, disputes.
export const stripeMock = () => {
  const original = globalThis.fetch;
  const requests: Request[] = [];
  const responses = new Map<string, Row>();
  const accounts = new Map<string, Row>();
  const sessions = new Map<string, Row>();
  const disputes = new Map<string, Row[]>();
  const refunds: Row[] = [];
  const state = { failNext: false, loseNextResponse: "" };

  const expanded = (session: Row): Row => ({ ...session, payment_intent: session.payment_intent ?? null });
  const compact = (session: Row): Row => ({ ...session, payment_intent: session.payment_intent?.id ?? null });

  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== "https://api.stripe.com") throw new Error(`Unexpected request: ${url}`);
    const path = url.pathname.replace("/v1", "");
    const params = new URLSearchParams(String(init?.body ?? ""));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const key = headers.get("Idempotency-Key");
    const account = headers.get("Stripe-Account");
    requests.push({ path, method, params, key, account });
    if (state.failNext) {
      state.failNext = false;
      return new Response("error", { status: 503 });
    }
    if (key && responses.has(key)) return Response.json(responses.get(key));
    let data: Row;
    if (path === "/accounts" && method === "POST") {
      const id = `acct_${accounts.size + 1}`;
      data = {
        id,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        requirements: { currently_due: ["external_account"], disabled_reason: "requirements.past_due" },
        metadata: Object.fromEntries(
          [...params].filter(([name]) => name.startsWith("metadata[")).map(([n, v]) => [n.slice(9, -1), v]),
        ),
      };
      accounts.set(id, data);
    } else if (path.startsWith("/accounts/")) {
      data = { ...accounts.get(path.split("/")[2]!)! };
    } else if (path === "/account_links") {
      data = { url: `https://connect.stripe.com/setup/${params.get("account")}` };
    } else if (path === "/checkout/sessions" && method === "POST") {
      const id = `cs_${sessions.size + 1}`;
      data = {
        id,
        status: "open",
        payment_status: "unpaid",
        url: `https://checkout.stripe.com/${id}`,
        amount_subtotal: Number(params.get("line_items[0][price_data][unit_amount]")),
        amount_total: Number(params.get("line_items[0][price_data][unit_amount]")),
        metadata: { paymentId: params.get("metadata[paymentId]") },
        customer_details: null,
        payment_intent: null,
        account,
      };
      sessions.set(id, data);
      data = compact(data);
    } else if (path.startsWith("/checkout/sessions/")) {
      const session = sessions.get(path.split("/")[3]!);
      if (!session || session.account !== account) return new Response("missing", { status: 404 });
      data = url.searchParams.has("expand[]") ? expanded(session) : compact(session);
    } else if (path === "/refunds" && method === "GET") {
      const intent = url.searchParams.get("payment_intent");
      data = { data: refunds.filter((row) => row.payment_intent === intent), has_more: false };
    } else if (path === "/refunds") {
      const intent = params.get("payment_intent");
      const session = [...sessions.values()].find((row) => row.payment_intent?.id === intent)!;
      const charge = session.payment_intent.latest_charge;
      const amount = Number(params.get("amount") ?? charge.amount - charge.amount_refunded);
      charge.amount_refunded += amount;
      data = {
        id: `re_${refunds.length + 1}`,
        payment_intent: intent,
        amount,
        status: "succeeded",
        metadata: { refundKey: params.get("metadata[refundKey]") },
      };
      refunds.push(data);
    } else if (path === "/disputes") {
      const rows = disputes.get(url.searchParams.get("payment_intent")!) ?? [];
      data = { data: rows.slice(0, 1), has_more: false };
    } else throw new Error(`Unexpected Stripe path: ${method} ${path}`);
    if (key) responses.set(key, structuredClone(data));
    if (method === "POST" && state.loseNextResponse === path) {
      state.loseNextResponse = "";
      throw new Error("Connection lost after provider accepted the request");
    }
    return Response.json(data);
  }) as typeof fetch;

  const pay = (id: string, email = "buyer@example.test") => {
    const session = sessions.get(id)!;
    Object.assign(session, {
      status: "complete",
      payment_status: "paid",
      customer_details: { email },
      payment_intent: {
        id: `pi_${id}`,
        status: "succeeded",
        latest_charge: { id: `ch_${id}`, amount: session.amount_total, amount_refunded: 0, disputed: false },
      },
    });
  };
  const dispute = (id: string, status: string) => {
    const session = sessions.get(id)!;
    session.payment_intent.latest_charge.disputed = true;
    disputes.set(session.payment_intent.id, [{ id: `dp_${id}`, status }]);
  };

  return {
    requests,
    refunds,
    accounts,
    sessions,
    state,
    pay,
    dispute,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

export const signed = async (payload: Row): Promise<[string, string]> => {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("whsec_test"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return [body, `t=${timestamp},v1=${Buffer.from(digest).toString("hex")}`];
};
