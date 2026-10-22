import type { WebhookResult } from "../types.ts";

export type Seller = {
  id: string;
  email: string | null;
  accountId: string | null;
  // persisted before the provider write so a lost response cannot create a second account.
  onboardingKey: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
  revision: number;
};

export type PaymentStatus =
  | "open"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type PaymentItem = { name: string; description?: string; image?: string };

export type Payment = {
  id: string;
  sellerId: string;
  accountId: string;
  amount: number;
  currency: string;
  fee: number;
  item: PaymentItem;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
  key: string;
  expiresAt: number;
  sessionId: string | null;
  intentId: string | null;
  status: PaymentStatus;
  // charged total including any tax; null until paid.
  total: number | null;
  amountRefunded: number;
  dispute: string | null;
  // persisted before the provider write; cleared once the refund is confirmed.
  pendingRefund: { key: string; amount: number | null } | null;
  revision: number;
};

export type ConnectStore = {
  seller: (id: string) => Promise<Seller | null>;
  sellerByAccount: (accountId: string) => Promise<Seller | null>;
  // compare and swap atomically; persist next.revision along with the complete state.
  saveSeller: (next: Seller, expectedRevision: number) => Promise<boolean>;
  payment: (id: string) => Promise<Payment | null>;
  paymentByIntent: (intentId: string) => Promise<Payment | null>;
  // insert only when the id is unused; return false otherwise.
  createPayment: (next: Payment) => Promise<boolean>;
  savePayment: (next: Payment, expectedRevision: number) => Promise<boolean>;
  hasEvent: (id: string) => Promise<boolean>;
  // idempotent; called only after state is durably saved.
  recordEvent: (id: string) => Promise<void>;
};

export type FeeInput = { sellerId: string; amount: number; currency: string };

export type ConnectOptions = {
  secretKey: string;
  webhookSecret: string;
  store: ConnectStore;
  // the platform's cut in minor units; a whole number from zero up to, not including, the amount.
  fee: (input: FeeInput) => number;
  // stripe tax on the seller's own registrations; the seller must have it set up.
  tax?: boolean;
  apiVersion?: string;
};

export type OnboardOptions = {
  sellerId: string;
  country?: string;
  returnUrl: string;
  refreshUrl: string;
};

export type PaymentOptions = {
  paymentId: string;
  sellerId: string;
  amount: number;
  currency: string;
  item: PaymentItem;
  email?: string;
  successUrl: string;
  cancelUrl: string;
};

export type Connect = {
  onboard: (options: OnboardOptions) => Promise<{ url: string }>;
  seller: (sellerId: string) => Promise<Seller>;
  sync: (sellerId: string) => Promise<Seller>;
  checkout: (options: PaymentOptions) => Promise<{ url: string }>;
  payment: (paymentId: string) => Promise<Payment>;
  reconcile: (paymentId: string) => Promise<Payment>;
  refund: (paymentId: string, amount?: number) => Promise<Payment>;
  webhook: (body: string, signature: string) => Promise<WebhookResult>;
};
