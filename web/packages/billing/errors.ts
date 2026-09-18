export type BillingErrorCode =
  | "invalid_request"
  | "invalid_signature"
  | "invalid_event"
  | "not_found"
  | "conflict"
  | "unavailable";

export type BillingError = Error & { code: BillingErrorCode };

export const billingError = (code: BillingErrorCode, message: string): BillingError =>
  Object.assign(new Error(message), { name: "BillingError", code });

export const isBillingError = (error: unknown): error is BillingError =>
  error instanceof Error && error.name === "BillingError" && "code" in error;
