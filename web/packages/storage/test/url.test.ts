import { afterEach, expect, setSystemTime, test } from "bun:test";
import { signRequest } from "../signing/index.ts";
import { canonicalPath, objectUrl } from "../url/index.ts";

afterEach(() => setSystemTime());

// reference signatures independently checked with Smithy's SignatureV4, uriEscapePath: false
const cases = [
  [
    "sp ace/#?%+!.txt",
    "/media/sp%20ace/%23%3F%25%2B%21.txt",
    "172e4b3bc3d79ed8c71004c49c1e891d65bb2331ed7528ef93ef46f7c8671c46",
  ],
  [
    "résumé/雪.txt",
    "/media/r%C3%A9sum%C3%A9/%E9%9B%AA.txt",
    "7aa499807221bbb927238f8324d75502ba66fe8ec973cc13d295051e7e6aeb18",
  ],
  [
    "folder//repeat.txt",
    "/media/folder//repeat.txt",
    "abeda6efc7462a48f308acbefa03559faca8d6da15c6abb58f1d3ebda9a85c2f",
  ],
  ["literal%2Fvalue", "/media/literal%252Fvalue", "4aa882f594fb14719eada31558094642d5db2bf6d8b3944828bf8f061b4204e0"],
] as const;

test.each(cases)("S3 signing preserves the exact object key %s", (key, path, signature) => {
  setSystemTime(new Date("2026-10-22T12:00:00Z"));
  const url = objectUrl({ endpoint: "https://s3.example.test", bucket: "media" }, key);
  expect(url.pathname).toBe(path);
  expect(url.search).toBe("");
  expect(url.hash).toBe("");
  expect(canonicalPath(url)).toBe(path);
  const signed = signRequest({
    method: "PUT",
    url,
    headers: new Headers({ host: url.host, "content-type": "text/plain" }),
    body: "hello",
    accessKey: "key",
    secretKey: "secret",
  });
  expect(signed.authorization).toEndWith(`Signature=${signature}`);
});

test("keys cannot escape the bucket through URL normalization", () => {
  const store = { endpoint: "https://s3.example.test", bucket: "media" };
  expect(() => objectUrl(store, "../anotherbucket/key")).toThrow("dot path");
  expect(() => objectUrl(store, "folder/./key")).toThrow("dot path");
  expect(objectUrl(store, "literal%2e%2e/key").pathname).toBe("/media/literal%252e%252e/key");
});
