import type { ShareContent, ShareProvider } from "../index.ts";

export const reddit: ShareProvider = {
  channel: "reddit",
  label: "Reddit",
  build: (content: ShareContent): string => {
    const params = new URLSearchParams();
    params.set("url", content.url);
    if (content.title) params.set("title", content.title);
    return `https://www.reddit.com/submit?${params.toString()}`;
  },
};
