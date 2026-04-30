// MIME types we'll serve `Content-Disposition: inline` for. Anything outside
// the allowlist is forced to attachment + application/octet-stream so an
// attacker who uploaded an HTML/SVG/XML file can't get our origin to render
// it as script. SVG is intentionally NOT here — it parses as XML and runs
// script. PDFs render in-place but are sandboxed by browsers.

const SAFE_INLINE_PREFIXES = ["image/", "video/", "audio/"] as const;
const SAFE_INLINE_EXACT: ReadonlySet<string> = new Set(["application/pdf", "text/plain"]);

const isSafeInlineMime = (mime: string): boolean => {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "image/svg+xml") return false;
  if (SAFE_INLINE_EXACT.has(m)) return true;
  return SAFE_INLINE_PREFIXES.some((p) => m.startsWith(p));
};

export type InlineDecision = {
  readonly contentType: string;
  readonly disposition: string;
};

/**
 * Decide content-type and content-disposition for a download response.
 * `wantInline` is the caller's request (e.g. `?inline=1`). If the file's
 * stored MIME isn't in the safe-inline allowlist, the result is forced to
 * attachment regardless of what the caller asked for.
 */
export const decideInline = (storedMime: string, filename: string, wantInline: boolean): InlineDecision => {
  const safe = wantInline && isSafeInlineMime(storedMime);
  if (safe) {
    return {
      contentType: storedMime,
      disposition: `inline; filename="${encodeURIComponent(filename)}"`,
    };
  }
  return {
    contentType: "application/octet-stream",
    disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  };
};
