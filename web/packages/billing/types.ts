export type Subscription = {
  id: string;
  customerId: string;
  status: string;
  priceIds: string[];
  plan: string | null;
  cancelAtPeriodEnd: boolean;
};

export type CheckoutAttempt = {
  key: string;
  plan: string;
  priceId: string;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
  expiresAt: number;
  sessionId: string | null;
};

export type BillingAccount = {
  id: string;
  email: string | null;
  customerId: string | null;
  subscription: Subscription | null;
  checkout: CheckoutAttempt | null;
  revision: number;
};

export type BillingStore = {
  get: (id: string) => Promise<BillingAccount | null>;
  findByCustomer: (customerId: string) => Promise<BillingAccount | null>;
  // compare and swap atomically; persist next.revision along with the complete state.
  save: (next: BillingAccount, expectedRevision: number) => Promise<boolean>;
  hasEvent: (id: string) => Promise<boolean>;
  // idempotent; called only after subscription state is durably saved.
  recordEvent: (id: string) => Promise<void>;
};

export type BillingOptions = {
  secretKey: string;
  webhookSecret: string;
  prices: Record<string, string>;
  store: BillingStore;
  accountMetadataKey?: string;
  apiVersion?: string;
};

export type CheckoutOptions = {
  accountId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
};

export type WebhookResult = { received: true; duplicate?: true; ignored?: true };

export type Billing = {
  checkout: (options: CheckoutOptions) => Promise<{ url: string }>;
  portal: (accountId: string, returnUrl: string) => Promise<{ url: string }>;
  subscription: (accountId: string) => Promise<Subscription | null>;
  sync: (accountId: string) => Promise<Subscription | null>;
  webhook: (body: string, signature: string) => Promise<WebhookResult>;
};
