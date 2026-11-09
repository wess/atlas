const origin = "http://atlas.invalid";

/**
 * The path when it stays on this site, else null. Browsers drop tabs and
 * newlines from URLs and treat `\` as `/`, so `/\t/evil.example` and
 * `/\evil.example` both leave the site; any control character, backslash, or
 * leading `//` is refused, and the result must resolve to this origin.
 */
export const localReturnPath = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this rejects
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, origin);
    return url.origin === origin && url.pathname.startsWith("/") && !url.pathname.startsWith("//") ? value : null;
  } catch {
    return null;
  }
};
