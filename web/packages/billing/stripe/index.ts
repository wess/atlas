import { createClient } from "../../request/index.ts";
import { billingError } from "../errors.ts";

export type StripeObject = Record<string, unknown>;
export type StripeClient = {
  get: (path: string) => Promise<StripeObject>;
  post: (path: string, params: URLSearchParams, key?: string) => Promise<StripeObject>;
  list: (path: string, params: Record<string, string>) => Promise<StripeObject[]>;
};

export const object = (value: unknown): StripeObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as StripeObject) : null;

export const identifier = (value: unknown): string | null => {
  const id = typeof value === "string" ? value : object(value)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
};

export const createStripeClient = (key: string, version?: string): StripeClient => {
  const client = createClient({
    baseUrl: "https://api.stripe.com/v1",
    headers: {
      authorization: `Bearer ${key}`,
      ...(version ? { "Stripe-Version": version } : {}),
    },
    timeout: 15_000,
  });
  const send = async (path: string, params?: URLSearchParams, idempotencyKey?: string): Promise<StripeObject> => {
    if (!key) throw billingError("unavailable", "Billing is not configured.");
    const response = await client.request(path, {
      method: params ? "POST" : "GET",
      body: params,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    });
    // provider errors may contain customer data; keep them out of public responses.
    if (!response.ok) {
      await response.body?.cancel();
      throw billingError("unavailable", `Billing provider request failed (${response.status}).`);
    }
    const data = object(await response.json());
    if (!data) throw billingError("unavailable", "Invalid billing provider response.");
    return data;
  };
  return {
    get: (path) => send(path),
    post: (path, params, idempotencyKey) => send(path, params, idempotencyKey),
    list: async (path, params) => {
      const rows: StripeObject[] = [];
      let cursor = "";
      for (;;) {
        const query = new URLSearchParams({ ...params, limit: "100" });
        if (cursor) query.set("starting_after", cursor);
        const page = await send(`${path}?${query}`);
        if (!Array.isArray(page.data) || typeof page.has_more !== "boolean")
          throw billingError("unavailable", "Invalid billing provider list.");
        for (const item of page.data) {
          const row = object(item);
          if (!row) throw billingError("unavailable", "Invalid billing provider item.");
          rows.push(row);
        }
        if (!page.has_more) return rows;
        const next = identifier(page.data.at(-1));
        if (!next || next === cursor) throw billingError("unavailable", "Invalid billing provider cursor.");
        cursor = next;
      }
    },
  };
};
