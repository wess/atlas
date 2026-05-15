import { type Emailer, escapeHtml, layout, type SendResult, safeHref } from "@atlas/email";
import type { ShareContent } from "../providers/index.ts";

export type ShareEmailOptions = {
  readonly emailer: Emailer;
  readonly to: string | readonly string[];
  /** From-address override. Falls back to whatever the emailer was constructed with. */
  readonly from?: string;
  /** Reply-To header. Set to the sharer's email so replies go to them, not no-reply. */
  readonly replyTo?: string;
  /** Display name of the person sharing — used in subject + greeting. */
  readonly sharerName?: string;
  /** Short product/site name for the subject line. Default: omitted. */
  readonly product?: string;
  /** Free-form note from the sharer. Rendered as a blockquote. */
  readonly message?: string;
  readonly content: ShareContent;
  readonly brand?: string;
  readonly accent?: string;
};

const renderShareEmail = (opts: ShareEmailOptions): { subject: string; html: string; text: string } => {
  const sharer = opts.sharerName?.trim() || "Someone";
  const productSuffix = opts.product ? ` on ${opts.product}` : "";
  const titlePart = opts.content.title ? `: "${opts.content.title}"` : "";
  const subject = `${sharer} shared a link${productSuffix}${titlePart}`;

  const url = opts.content.url;
  const safeUrl = safeHref(url);

  const messageBlock = opts.message
    ? `<blockquote style="border-left: 3px solid ${opts.accent ?? "#5e81ac"}; padding: 4px 14px; color: #3b4252; margin: 16px 0; font-style: italic;">${escapeHtml(opts.message)}</blockquote>`
    : "";

  const titleHtml = opts.content.title
    ? `<p style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(opts.content.title)}</p>`
    : "";

  const textBlurb = opts.content.text ? `<p>${escapeHtml(opts.content.text)}</p>` : "";

  const body = `
    <p><strong>${escapeHtml(sharer)}</strong> shared a link with you${productSuffix ? ` on ${escapeHtml(opts.product as string)}` : ""}.</p>
    ${messageBlock}
    ${titleHtml}
    ${textBlurb}
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" class="btn">Open link</a>
    </p>
    <p style="font-size: 13px; color: #4c566a;">Or paste this URL into your browser:<br>
      <a href="${safeUrl}" style="word-break: break-all;">${escapeHtml(url)}</a>
    </p>
  `;

  const textLines = [
    `${sharer} shared a link with you${productSuffix}.`,
    opts.message ? `\nTheir note:\n"${opts.message}"` : null,
    opts.content.title ? `\n${opts.content.title}` : null,
    opts.content.text ? opts.content.text : null,
    "",
    url,
  ].filter((l): l is string => l !== null);

  return {
    subject,
    html: layout({ title: subject, body, brand: opts.brand, accent: opts.accent }),
    text: textLines.join("\n"),
  };
};

/** Server-side: render a share-by-email message and dispatch it through an `Emailer`. */
export const shareEmail = async (opts: ShareEmailOptions): Promise<SendResult> => {
  const rendered = renderShareEmail(opts);
  return opts.emailer.send({
    to: opts.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    from: opts.from,
    replyTo: opts.replyTo,
  });
};

/** Pure: render the same email without sending. Useful for previews / tests. */
export const renderShareEmailMessage = renderShareEmail;
