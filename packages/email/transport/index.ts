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

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type ResendOptions = {
  readonly apiKey: string;
  /** Default `from` address. Each `send` call may override. */
  readonly from: string;
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

  return {
    enabled: true,
    send: async (msg) => {
      const recipients = Array.isArray(msg.to) ? [...msg.to] : [msg.to];
      try {
        const res = await fetch(RESEND_ENDPOINT, {
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
          return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 240)}` };
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
export const createEmailer = (opts: { apiKey?: string | null; from?: string | null }): Emailer => {
  if (opts.apiKey && opts.from) return createResendEmailer({ apiKey: opts.apiKey, from: opts.from });
  return createConsoleEmailer();
};
