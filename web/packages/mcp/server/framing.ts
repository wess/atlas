const MAX_HEADER = 8192;
const MAX_BODY = 1024 * 1024;

export const createFramer = (): { push: (chunk: Uint8Array) => string[] } => {
  let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  return {
    push: (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
      const messages: string[] = [];
      while (buffer.length) {
        const end = buffer.indexOf("\r\n\r\n");
        if (end === -1) {
          if (buffer.length > MAX_HEADER) throw new Error("MCP header exceeds size limit");
          break;
        }
        if (end > MAX_HEADER) throw new Error("MCP header exceeds size limit");
        const lengths = [
          ...buffer
            .subarray(0, end)
            .toString("ascii")
            .matchAll(/^Content-Length:\s*(\d+)\s*$/gim),
        ];
        const length = Number(lengths[0]?.[1]);
        if (lengths.length !== 1 || !Number.isSafeInteger(length) || length < 1 || length > MAX_BODY) {
          throw new Error("Invalid MCP content length");
        }
        const start = end + 4;
        if (buffer.length < start + length) break;
        messages.push(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(start, start + length)));
        buffer = buffer.subarray(start + length);
      }
      return messages;
    },
  };
};
