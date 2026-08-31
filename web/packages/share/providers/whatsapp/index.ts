import type { ShareContent, ShareProvider } from "../index.ts";

export const whatsapp: ShareProvider = {
  channel: "whatsapp",
  label: "WhatsApp",
  build: (content: ShareContent): string => {
    const parts = [content.title, content.text, content.url].filter((v): v is string => Boolean(v));
    const message = parts.join("\n\n");
    const params = new URLSearchParams();
    params.set("text", message);
    return `https://wa.me/?${params.toString()}`;
  },
};
