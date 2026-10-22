import { afterEach, expect, test } from "bun:test";
import { createStore, list } from "../index.ts";

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test("list requests URL-encoded XML keys and decodes reserved characters and Unicode once", async () => {
  const keys = ["a&b<one>.txt", "snow/雪.txt", "literal%2Fvalue", "line\nbreak"];
  globalThis.fetch = (async (input) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("encoding-type")).toBe("url");
    expect(url.searchParams.get("prefix")).toBe("a&b");
    return new Response(
      `<ListBucketResult><EncodingType>url</EncodingType>${keys.map((key) => `<Contents><Key>${encodeURIComponent(key)}</Key></Contents>`).join("")}<IsTruncated>false</IsTruncated></ListBucketResult>`,
    );
  }) as typeof fetch;
  const store = createStore({
    endpoint: "https://s3.example.test",
    bucket: "test",
    accessKey: "key",
    secretKey: "secret",
  });
  expect(await list(store, "a&b")).toEqual({ keys, truncated: false });
});
