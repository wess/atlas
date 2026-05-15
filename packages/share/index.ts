import {
  email,
  facebook,
  linkedin,
  reddit,
  type ShareChannel,
  type ShareContent,
  type ShareProvider,
  sms,
  telegram,
  twitter,
  whatsapp,
} from "./providers/index.ts";

const REGISTRY: Readonly<Record<ShareChannel, ShareProvider>> = {
  twitter,
  facebook,
  linkedin,
  reddit,
  whatsapp,
  telegram,
  sms,
  email,
};

/** All built-in channels, in a display-friendly order. */
export const channels: readonly ShareChannel[] = [
  "twitter",
  "facebook",
  "linkedin",
  "reddit",
  "whatsapp",
  "telegram",
  "sms",
  "email",
];

export const listChannels = (): readonly { channel: ShareChannel; label: string }[] =>
  channels.map((c) => ({ channel: c, label: REGISTRY[c].label }));

/** Build a share URL for a single channel. Throws on unknown channel name. */
export const shareUrl = (channel: ShareChannel, content: ShareContent): string => {
  const provider = REGISTRY[channel];
  if (!provider) {
    throw new Error(`Unknown share channel '${channel}'. Known channels: [${channels.join(", ")}].`);
  }
  if (!content.url) {
    throw new Error("share content requires a non-empty 'url'.");
  }
  return provider.build(content);
};

/** Build share URLs for every channel at once. Convenient for rendering a row of buttons. */
export const share = (content: ShareContent): Readonly<Record<ShareChannel, string>> => {
  const out = {} as Record<ShareChannel, string>;
  for (const c of channels) out[c] = REGISTRY[c].build(content);
  return out;
};

export type { ShareEmailOptions } from "./email/index.ts";
export { renderShareEmailMessage, shareEmail } from "./email/index.ts";
export type { ShareChannel, ShareContent, ShareProvider } from "./providers/index.ts";
export { email, facebook, linkedin, reddit, sms, telegram, twitter, whatsapp } from "./providers/index.ts";
