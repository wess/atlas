export type ShareContent = {
  /** The URL being shared. Required. */
  readonly url: string;
  /** Short title — used as the link title or tweet text where supported. */
  readonly title?: string;
  /** Free-form copy — used as the body / pre-filled message. */
  readonly text?: string;
  /** Hashtags (without `#`). Used by Twitter/X and some intent endpoints. */
  readonly hashtags?: readonly string[];
  /** Twitter/X attribution handle (without `@`). */
  readonly via?: string;
  /** Recipient phone number (sms:) — international format like `+15551234567`. */
  readonly phone?: string;
  /** Email recipients (mailto:). */
  readonly to?: string | readonly string[];
  /** CC recipients (mailto:). */
  readonly cc?: string | readonly string[];
  /** BCC recipients (mailto:). */
  readonly bcc?: string | readonly string[];
};

export type ShareChannel = "twitter" | "facebook" | "linkedin" | "reddit" | "whatsapp" | "telegram" | "sms" | "email";

export type ShareProvider = {
  readonly channel: ShareChannel;
  readonly label: string;
  readonly build: (content: ShareContent) => string;
};

export { email } from "./email/index.ts";
export { facebook } from "./facebook/index.ts";
export { linkedin } from "./linkedin/index.ts";
export { reddit } from "./reddit/index.ts";
export { sms } from "./sms/index.ts";
export { telegram } from "./telegram/index.ts";
export { twitter } from "./twitter/index.ts";
export { whatsapp } from "./whatsapp/index.ts";
