import type { ShareContent, ShareProvider } from "../index.ts";

export const linkedin: ShareProvider = {
  channel: "linkedin",
  label: "LinkedIn",
  build: (content: ShareContent): string => {
    const params = new URLSearchParams();
    params.set("url", content.url);
    return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
  },
};
