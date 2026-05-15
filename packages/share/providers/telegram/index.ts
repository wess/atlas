import type { ShareContent, ShareProvider } from "../index.ts";

export const telegram: ShareProvider = {
  channel: "telegram",
  label: "Telegram",
  build: (content: ShareContent): string => {
    const params = new URLSearchParams();
    params.set("url", content.url);
    const text = content.text ?? content.title;
    if (text) params.set("text", text);
    return `https://t.me/share/url?${params.toString()}`;
  },
};
