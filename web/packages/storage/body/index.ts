import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileSink } from "bun";
import { sha256 } from "../signing/index.ts";

export type UploadBody = Blob | Uint8Array | string | ReadableStream;
type PreparedBody = { body: Blob | Uint8Array | string | null; hash: string; dispose?: () => Promise<void> };

const DEFAULT_LIMIT = 5 * 1024 ** 3;

const checkSize = (size: number, maxBytes: number): void => {
  if (size > maxBytes) throw new Error(`Storage upload exceeds maxBytes (${maxBytes})`);
};

const hashStream = async (
  stream: ReadableStream,
  maxBytes: number,
  writer?: FileSink,
  signal?: AbortSignal,
): Promise<string> => {
  signal?.throwIfAborted();
  const reader = stream.getReader();
  const abort = async () => {
    try {
      await reader.cancel(signal?.reason);
    } catch {
      /* cancellation can race a stream error */
    }
  };
  signal?.addEventListener("abort", abort, { once: true });
  const hash = new Bun.CryptoHasher("sha256");
  let size = 0;
  let buffered = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error("Storage upload streams must contain byte chunks");
      size += value.byteLength;
      checkSize(size, maxBytes);
      hash.update(value);
      if (writer) {
        writer.write(value);
        buffered += value.byteLength;
        if (buffered >= 1024 * 1024) {
          await writer.flush();
          buffered = 0;
        }
      }
    }
    return hash.digest("hex");
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      /* errored streams can reject cancellation */
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
};

export const prepareBody = async (
  body?: UploadBody | null,
  maxBytes = DEFAULT_LIMIT,
  signal?: AbortSignal,
): Promise<PreparedBody> => {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("maxBytes must be a non-negative safe integer");
  if (body == null) return { body: null, hash: sha256("") };
  if (typeof body === "string" || body instanceof Uint8Array) {
    checkSize(typeof body === "string" ? Buffer.byteLength(body) : body.byteLength, maxBytes);
    return { body, hash: sha256(body) };
  }
  if (body instanceof Blob) {
    checkSize(body.size, maxBytes);
    return { body, hash: await hashStream(body.stream(), maxBytes, undefined, signal) };
  }
  // a one-shot stream must be replayable after its digest is known; keep it off the heap
  const directory = await mkdtemp(join(tmpdir(), "atlasupload"));
  const file = Bun.file(join(directory, "payload"));
  const dispose = () => rm(directory, { recursive: true, force: true });
  try {
    const writer = file.writer({ highWaterMark: 64 * 1024 });
    let hash: string;
    try {
      hash = await hashStream(body, maxBytes, writer, signal);
    } finally {
      await writer.end();
    }
    return { body: file, hash, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};
