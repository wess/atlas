import type { ShareContent, ShareProvider } from "../index.ts";

export const facebook: ShareProvider = {
  channel: "facebook",
  label: "Facebook",
  build: (content: ShareContent): string => {
    const params = new URLSearchParams();
    params.set("u", content.url);
    if (content.text || content.title) params.set("quote", content.text ?? content.title ?? "");
    return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
  },
};
