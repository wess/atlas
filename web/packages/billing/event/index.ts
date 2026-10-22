import { billingError } from "../errors.ts";
import { verifySignature } from "../signature/index.ts";
import { identifier, object, type StripeObject } from "../stripe/index.ts";

export type VerifiedEvent = { id: string; type: string; account: string | null; value: StripeObject | null };

// verify against the untouched body before parsing anything out of it.
export const verifiedEvent = async (body: string, signature: string, secret: string): Promise<VerifiedEvent> => {
  if (!secret) throw billingError("unavailable", "Billing webhooks are not configured.");
  if (!(await verifySignature(body, signature, secret)))
    throw billingError("invalid_signature", "Invalid billing webhook signature.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw billingError("invalid_event", "Invalid billing webhook payload.");
  }
  const event = object(parsed);
  const id = identifier(event);
  if (!event || !id || typeof event.type !== "string")
    throw billingError("invalid_event", "Invalid billing webhook event.");
  return {
    id,
    type: event.type,
    account: typeof event.account === "string" ? event.account : null,
    value: object(object(event.data)?.object),
  };
};
