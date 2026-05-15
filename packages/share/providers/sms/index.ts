import type { ShareContent, ShareProvider } from "../index.ts";

/**
 * sms:?body=… — works on iOS / Android / macOS. Some Android dialers want a
 * `?` separator instead of `?`; modern devices accept both.
 */
export const sms: ShareProvider = {
  channel: "sms",
  label: "SMS",
  build: (content: ShareContent): string => {
    const parts = [content.title, content.text, content.url].filter((v): v is string => Boolean(v));
    const body = parts.join("\n\n");
    const recipient = content.phone ? encodeURIComponent(content.phone) : "";
    const query = body ? `body=${encodeURIComponent(body)}` : "";
    if (recipient && query) return `sms:${recipient}?${query}`;
    if (recipient) return `sms:${recipient}`;
    if (query) return `sms:?${query}`;
    return "sms:";
  },
};
