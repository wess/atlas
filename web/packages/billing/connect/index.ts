import { billingError } from "../errors.ts";
import { createStripeClient } from "../stripe/index.ts";
import { checkout } from "./checkout.ts";
import { onboard } from "./onboard.ts";
import { loadPayment, reconcilePayment, type Scoped } from "./payment.ts";
import { refund } from "./refund.ts";
import { loadSeller, reconcileSeller } from "./seller.ts";
import type { Connect, ConnectOptions } from "./types.ts";
import { webhook } from "./webhook.ts";

export type {
  Connect,
  ConnectOptions,
  ConnectStore,
  FeeInput,
  OnboardOptions,
  Payment,
  PaymentItem,
  PaymentOptions,
  PaymentStatus,
  Seller,
} from "./types.ts";

export const createConnect = (options: ConnectOptions): Connect => {
  if (typeof options.fee !== "function") throw billingError("invalid_request", "Connect needs a fee function.");
  const config = { ...options };
  const platform = createStripeClient(config.secretKey, config.apiVersion);
  const scoped: Scoped = (account) => createStripeClient(config.secretKey, config.apiVersion, account);
  return {
    onboard: (input) => onboard(config.store, platform, input),
    seller: (id) => loadSeller(config.store, id),
    sync: (id) => reconcileSeller(config.store, platform, id),
    checkout: (input) => checkout(config, scoped, input),
    payment: (id) => loadPayment(config.store, id),
    reconcile: (id) => reconcilePayment(config.store, scoped, id),
    refund: (id, amount) => refund(config.store, scoped, id, amount),
    webhook: (body, signature) => webhook(config, platform, scoped, body, signature),
  };
};
