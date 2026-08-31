import type { ShareContent, ShareProvider } from "../index.ts";

const join = (v: string | readonly string[] | undefined): string => {
  if (!v) return "";
  return Array.isArray(v) ? v.join(",") : (v as string);
};

/**
 * mailto: link builder. For sending an email server-side from a transport, use
 * `shareEmail` from `@atlas/share` — this builder is for client-side links that
 * pop the user's mail client.
 */
export const email: ShareProvider = {
  channel: "email",
  label: "Email",
  build: (content: ShareContent): string => {
    const to = encodeURIComponent(join(content.to));
    const params = new URLSearchParams();
    if (content.cc) params.set("cc", join(content.cc));
    if (content.bcc) params.set("bcc", join(content.bcc));
    if (content.title) params.set("subject", content.title);
    const bodyParts = [content.text, content.url].filter((v): v is string => Boolean(v));
    if (bodyParts.length > 0) params.set("body", bodyParts.join("\n\n"));
    const query = params.toString();
    return query ? `mailto:${to}?${query}` : `mailto:${to}`;
  },
};
