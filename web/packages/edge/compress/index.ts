export type Encoding = "gzip" | "zstd" | "br";

const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript|wasm|x-ndjson)|image\/svg\+xml)/i;
const MAX_BUFFER = 1024 * 1024;

const pick = (accept: string, allow: ReadonlyArray<Encoding>): Encoding | null => {
  const offered = new Map(
    accept.split(",").map((part) => {
      const [name, ...params] = part.trim().toLowerCase().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return [name!, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0] as const;
    }),
  );
  let chosen: Encoding | null = null;
  let quality = 0;
  for (const enc of allow) {
    const q = offered.get(enc) ?? offered.get("*") ?? 0;
    if (q > quality) {
      chosen = enc;
      quality = q;
    }
  }
  return chosen;
};

export const compressResponse = async (
  res: Response,
  accept: string | null,
  allow: ReadonlyArray<Encoding>,
): Promise<Response> => {
  if (!accept || allow.length === 0 || !res.body || res.status === 206) return res;
  if (res.headers.has("content-encoding") || res.headers.has("content-range")) return res;
  if (/\bno-transform\b/i.test(res.headers.get("cache-control") ?? "")) return res;
  const ct = res.headers.get("content-type") ?? "";
  if (!COMPRESSIBLE.test(ct) || /^text\/event-stream/i.test(ct)) return res;
  const length = Number(res.headers.get("content-length") ?? NaN);
  if (Number.isFinite(length) && length < 1024) return res;

  const runtimeAllowed = allow.filter(
    (enc) =>
      enc === "gzip" ||
      (enc === "zstd" && typeof Bun.zstdCompressSync === "function" && length > 0 && length <= MAX_BUFFER),
  );
  const enc = pick(accept, runtimeAllowed);
  const headers = new Headers(res.headers);
  if (
    !headers
      .get("vary")
      ?.toLowerCase()
      .split(/\s*,\s*/)
      .includes("accept-encoding")
  )
    headers.append("vary", "Accept-Encoding");
  if (!enc) return new Response(res.body, { status: res.status, statusText: res.statusText, headers });

  let body: ConstructorParameters<typeof Response>[0];
  if (enc === "gzip") {
    body = res.body.pipeThrough(new CompressionStream("gzip"));
  } else {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
      if (total > MAX_BUFFER) {
        // a lying upstream must not turn its content-length into an unbounded allocation
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
          },
          async pull(controller) {
            const next = await reader.read();
            if (next.done) {
              reader.releaseLock();
              controller.close();
            } else controller.enqueue(next.value);
          },
          async cancel(reason) {
            await reader.cancel(reason);
            reader.releaseLock();
          },
        });
        headers.delete("content-length");
        return new Response(stream, { status: res.status, headers });
      }
    }
    reader.releaseLock();
    const data = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = new Uint8Array(Bun.zstdCompressSync(data));
  }
  headers.set("content-encoding", enc);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("content-md5");
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
};
