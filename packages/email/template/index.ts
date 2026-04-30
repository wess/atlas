export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type LayoutOptions = {
  readonly title: string;
  readonly body: string;
  /** Brand name shown at the top of the card. Default: empty (no header). */
  readonly brand?: string;
  /** Footer line below the card. Default: empty. */
  readonly footer?: string;
  /** Override the accent color used for buttons / links. Default: `#5e81ac`. */
  readonly accent?: string;
};

/**
 * Minimal single-column email shell — no tables, conservative inline-friendly
 * styles. Most modern clients render flexbox/grid fine; this stays simple in
 * case Outlook ever shows up. Pass your own brand and accent for theming, or
 * skip them for a plain framed card.
 */
export const layout = (opts: LayoutOptions): string => {
  const accent = opts.accent ?? "#5e81ac";
  const brandHtml = opts.brand ? `<p class="brand">${escapeHtml(opts.brand)}</p>` : "";
  const footerHtml = opts.footer ? `<div class="footer">${escapeHtml(opts.footer)}</div>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
    <style>
      body { background: #eceff4; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #2e3440; }
      .container { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
      .card { background: #ffffff; border: 1px solid #d8dee9; border-radius: 14px; padding: 32px; }
      .brand { font-size: 28px; font-weight: 700; letter-spacing: -0.04em; color: #2e3440; margin: 0 0 24px; }
      .btn { display: inline-block; background: ${accent}; color: #eceff4; text-decoration: none; padding: 12px 22px; border-radius: 9px; font-weight: 600; }
      .footer { text-align: center; font-size: 12px; color: #4c566a; margin-top: 24px; }
      a { color: ${accent}; }
      p { line-height: 1.55; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        ${brandHtml}
        ${opts.body}
      </div>
      ${footerHtml}
    </div>
  </body>
</html>`;
};

/** Result type returned by all template factories. */
export type RenderedEmail = {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
};

export type InviteEmailOptions = {
  readonly inviterName?: string | null;
  readonly product: string;
  readonly signupUrl: string;
  readonly note?: string | null;
  readonly tagline?: string;
  readonly brand?: string;
  readonly accent?: string;
};

/**
 * Generic "you've been invited" email. Pass `product` (the thing they're being
 * invited to), `signupUrl`, and optionally an inviter name and a free-form
 * note. The shell is unbranded by default; set `brand` / `accent` to skin it.
 */
export const inviteEmail = (opts: InviteEmailOptions): RenderedEmail => {
  const inviter = opts.inviterName?.trim() || "Someone";
  const subject = `${inviter} invited you to ${opts.product}`;
  const tagline = opts.tagline ?? `You've been invited to join ${opts.product}.`;

  const text = [
    `${inviter} invited you to join ${opts.product}.`,
    "",
    opts.note ? `Their note:\n"${opts.note}"\n` : null,
    "Accept the invite here:",
    opts.signupUrl,
    "",
    "If you weren't expecting this, you can ignore the email.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const noteBlock = opts.note
    ? `<blockquote style="border-left: 3px solid ${opts.accent ?? "#5e81ac"}; padding: 4px 14px; color: #3b4252; margin: 16px 0; font-style: italic;">${escapeHtml(opts.note)}</blockquote>`
    : "";

  const body = `
    <p><strong>${escapeHtml(inviter)}</strong> invited you to join ${escapeHtml(opts.product)}. ${escapeHtml(tagline)}</p>
    ${noteBlock}
    <p style="margin: 24px 0;">
      <a href="${opts.signupUrl}" class="btn">Accept invite</a>
    </p>
    <p style="font-size: 13px; color: #4c566a;">Or paste this URL into your browser:<br>
      <a href="${opts.signupUrl}" style="word-break: break-all;">${escapeHtml(opts.signupUrl)}</a>
    </p>
    <p style="font-size: 13px; color: #4c566a;">If you weren't expecting this, you can ignore the email.</p>
  `;

  return {
    subject,
    html: layout({ title: subject, body, brand: opts.brand, accent: opts.accent }),
    text,
  };
};

export type PasswordResetOptions = {
  readonly product: string;
  readonly resetUrl: string;
  readonly expiresInMinutes?: number;
  readonly brand?: string;
  readonly accent?: string;
};

/** Generic password-reset email. */
export const passwordResetEmail = (opts: PasswordResetOptions): RenderedEmail => {
  const subject = `Reset your ${opts.product} password`;
  const expiry = opts.expiresInMinutes ?? 60;

  const text = [
    `Someone requested a password reset for your ${opts.product} account.`,
    "",
    "Reset your password here:",
    opts.resetUrl,
    "",
    `This link expires in ${expiry} minutes. If you didn't request a reset, you can ignore this email.`,
  ].join("\n");

  const body = `
    <p>Someone requested a password reset for your ${escapeHtml(opts.product)} account.</p>
    <p style="margin: 24px 0;">
      <a href="${opts.resetUrl}" class="btn">Reset password</a>
    </p>
    <p style="font-size: 13px; color: #4c566a;">Or paste this URL into your browser:<br>
      <a href="${opts.resetUrl}" style="word-break: break-all;">${escapeHtml(opts.resetUrl)}</a>
    </p>
    <p style="font-size: 13px; color: #4c566a;">This link expires in ${expiry} minutes. If you didn't request a reset, you can ignore this email.</p>
  `;

  return {
    subject,
    html: layout({ title: subject, body, brand: opts.brand, accent: opts.accent }),
    text,
  };
};
