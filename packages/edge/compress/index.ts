export type Encoding = "gzip" | "zstd" | "br";

const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript|wasm|x-ndjson)|image\/svg\+xml)/i;

const pick = (accept: string, allow: ReadonlyArray<Encoding>): Encoding | null => {
  const offered = accept
    .split(",")
    .map((s) => s.trim().split(";")[0]!.toLowerCase())
    .filter(Boolean);
  for (const enc of allow) {
    if (offered.includes(enc)) return enc;
  }
  return null;
};

const supportedByRuntime = (enc: Encoding): boolean => {
  if (enc === "gzip") return true;
  if (enc === "zstd") return typeof (Bun as { zstdCompressSync?: unknown }).zstdCompressSync === "function";
  return false;
};

const compressBuffer = (data: Uint8Array, enc: Encoding): Uint8Array => {
  const copy = new Uint8Array(data);
  if (enc === "gzip") return Bun.gzipSync(copy);
  if (enc === "zstd") {
    const fn = (Bun as { zstdCompressSync?: (b: Uint8Array) => Uint8Array }).zstdCompressSync;
    if (!fn) throw new Error("zstd compression not available");
    return fn(copy);
  }
  throw new Error(`unsupported encoding: ${enc}`);
};

export const compressResponse = async (
  res: Response,
  accept: string | null,
  allow: ReadonlyArray<Encoding>,
): Promise<Response> => {
  if (!accept || allow.length === 0) return res;
  if (res.headers.has("content-encoding")) return res;
  const ct = res.headers.get("content-type") ?? "";
  if (!COMPRESSIBLE.test(ct)) return res;

  const runtimeAllowed = allow.filter(supportedByRuntime);
  const enc = pick(accept, runtimeAllowed);
  if (!enc) return res;

  const buf = new Uint8Array(await res.arrayBuffer());
  const compressed = compressBuffer(buf, enc);
  const headers = new Headers(res.headers);
  headers.set("content-encoding", enc);
  headers.set("content-length", String(compressed.byteLength));
  headers.append("vary", "Accept-Encoding");
  return new Response(compressed, { status: res.status, headers });
};
