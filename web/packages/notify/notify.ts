import { createApnsProvider, createConsoleProvider, createFcmProvider } from "./providers";

export type NotifyDestination =
  | { readonly kind: "apns"; readonly token: string; readonly topic?: string }
  | {
      readonly kind: "fcm";
      readonly token?: string;
      readonly topic?: string;
      readonly condition?: string;
    };

export type NotifyMessage = {
  readonly to: NotifyDestination;
  readonly title?: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, string>>;
  readonly badge?: number;
  readonly sound?: string;
  readonly imageUrl?: string;
  readonly collapseKey?: string;
  readonly ttlSeconds?: number;
  readonly priority?: "normal" | "high";
  readonly mutableContent?: boolean;
  readonly contentAvailable?: boolean;
};

export type NotifyResult =
  | { readonly ok: true; readonly provider: string; readonly id?: string; readonly logged?: boolean }
  | {
      readonly ok: false;
      readonly provider: string;
      readonly error: string;
      readonly status?: number;
      readonly retryable?: boolean;
    };

export type NotifyProvider = {
  readonly name: string;
  readonly supports: (destination: NotifyDestination) => boolean;
  readonly send: (message: NotifyMessage) => Promise<NotifyResult>;
};

export type Notifier = {
  readonly send: (message: NotifyMessage) => Promise<NotifyResult>;
  readonly sendMany: (messages: readonly NotifyMessage[]) => Promise<readonly NotifyResult[]>;
};

export type ApnsConfig = {
  readonly teamId: string;
  readonly keyId: string;
  readonly privateKey: string;
  readonly topic: string;
  readonly production?: boolean;
};

export type FcmConfig = {
  readonly projectId: string;
  readonly clientEmail: string;
  readonly privateKey: string;
};

export type NotifyConfig = {
  readonly apns?: ApnsConfig;
  readonly fcm?: FcmConfig;
  readonly console?: boolean;
};

const missingProvider = (kind: NotifyDestination["kind"]): NotifyResult => ({
  ok: false,
  provider: kind,
  error: `No ${kind} notification provider is configured`,
});

export const createNotifier = (providers: readonly NotifyProvider[]): Notifier => {
  const send = async (message: NotifyMessage): Promise<NotifyResult> => {
    const provider = providers.find((candidate) => candidate.supports(message.to));
    return provider ? provider.send(message) : missingProvider(message.to.kind);
  };

  return {
    send,
    sendMany: (messages) => Promise.all(messages.map(send)),
  };
};

export const createConfiguredNotifier = (config: NotifyConfig): Notifier => {
  const providers: NotifyProvider[] = [];
  if (config.apns) providers.push(createApnsProvider(config.apns));
  if (config.fcm) providers.push(createFcmProvider(config.fcm));
  if (config.console) providers.push(createConsoleProvider());
  return createNotifier(providers);
};
