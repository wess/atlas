export type EmailMessage = {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly replyTo?: string;
  readonly from?: string;
};

export type SendResult = { ok: true; id?: string; logged?: boolean } | { ok: false; error: string };

export type Emailer = {
  /** False when the transport is in fall-through (dev) mode. */
  readonly enabled: boolean;
  readonly send: (msg: EmailMessage) => Promise<SendResult>;
};

/**
 * Console-only transport. Useful in dev when no real provider is configured —
 * messages are logged instead of sent so flows still complete end-to-end.
 */
export const createConsoleEmailer = (): Emailer => ({
  enabled: false,
  send: async (msg) => {
    const recipients = Array.isArray(msg.to) ? msg.to : [msg.to];
    console.log("[email] (console transport — no provider configured)");
    console.log(`  to: ${recipients.join(", ")}`);
    console.log(`  subject: ${msg.subject}`);
    if (msg.text) console.log(msg.text);
    else console.log(msg.html);
    return { ok: true, logged: true };
  },
});

/**
 * Resend's own host. Overridable because the API surface is not Resend's alone
 * — Outbox and anything else that implements it takes the same paths, bodies
 * and error envelope, so pointing at one is a base URL and nothing more. A
 * self-hosted sender is also the difference between a password reset that works
 * and one that needs somebody's account with a third party.
 */
const RESEND_BASE = "https://api.resend.com";

export type ResendOptions = {
  readonly apiKey: string;
  /** Default `from` address. Each `send` call may override. */
  readonly from: string;
  /**
   * Where to send. Defaults to Resend. Point it at any host implementing the
   * same API — a self-hosted Outbox, a staging instance, a capture in a test.
   */
  readonly baseUrl?: string;
};

/**
 * Resend transport. Falls through to a console emailer when `apiKey` or `from`
 * are blank — keeps dev environments unblocked without configuring a sending
 * domain.
 */
export const createResendEmailer = (opts: ResendOptions): Emailer => {
  const apiKey = opts.apiKey.trim();
  const defaultFrom = opts.from.trim();
  if (!apiKey || !defaultFrom) return createConsoleEmailer();
  const base = (opts.baseUrl?.trim() || RESEND_BASE).replace(/\/+$/, "");
  const endpoint = `${base}/emails`;
  const host = URL.canParse(base) ? new URL(base).host : base;

  return {
    enabled: true,
    send: async (msg) => {
      const recipients = Array.isArray(msg.to) ? [...msg.to] : [msg.to];
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: msg.from ?? defaultFrom,
            to: recipients,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
            reply_to: msg.replyTo,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          // Named by host rather than "Resend": the whole point of baseUrl is
          // that this may not be Resend, and "Resend 500" while pointed at a
          // self-hosted sender sends somebody to read the wrong status page.
          return { ok: false, error: `${host} ${res.status}: ${body.slice(0, 240)}` };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: data.id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
};

/**
 * Convenience: build a Resend transport when the key/from are present, fall
 * back to the console transport otherwise. Most apps just want `createEmailer`.
 */
export const createEmailer = (opts: {
  apiKey?: string | null;
  from?: string | null;
  /** A Resend-compatible host to send through instead of Resend itself. */
  baseUrl?: string | null;
}): Emailer => {
  if (opts.apiKey && opts.from) {
    return createResendEmailer({
      apiKey: opts.apiKey,
      from: opts.from,
      baseUrl: opts.baseUrl ?? undefined,
    });
  }
  return createConsoleEmailer();
};
