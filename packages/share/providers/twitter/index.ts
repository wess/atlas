import type { ShareContent, ShareProvider } from "../index.ts";

export const twitter: ShareProvider = {
  channel: "twitter",
  label: "X (Twitter)",
  build: (content: ShareContent): string => {
    const params = new URLSearchParams();
    params.set("url", content.url);
    if (content.text || content.title) params.set("text", content.text ?? content.title ?? "");
    if (content.hashtags && content.hashtags.length > 0) params.set("hashtags", content.hashtags.join(","));
    if (content.via) params.set("via", content.via);
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  },
};
