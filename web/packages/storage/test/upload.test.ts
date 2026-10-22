import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { createStore, type UploadOptions, upload } from "../index.ts";

const store = createStore({
  endpoint: "https://s3.example.test",
  bucket: "media",
  accessKey: "key",
  secretKey: "secret",
});
const original = globalThis.fetch;
const requests: Array<{ url: string; init: RequestInit }> = [];
let response: Response;

beforeEach(() => {
  requests.length = 0;
  response = new Response(null, { status: 200 });
  setSystemTime(new Date("2026-10-22T12:00:00Z"));
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init: init! });
    return response;
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = original;
  setSystemTime();
});

const cases: Array<[UploadOptions["acl"], string]> = [
  [undefined, "a9bc4069483f714a0a82111e6d47bd9285856084e0fa1fe7f1857910e7367c45"],
  ["private", "4450d8f5d8a087726b3cbcd2ac744f61c33254442f34afd0fc0f7789ec2078ec"],
  ["public-read", "197b77670e42b9edd57fcb8db59dd6a7589183a1090a4b1a5c4721c59567fc1f"],
];

test.each(cases)("upload signs the exact headers for ACL %s", async (acl, signature) => {
  expect(
    await upload(store, {
      key: "files/hello.txt",
      body: "hello",
      contentType: "text/plain",
      ...(acl === undefined ? {} : { acl }),
    }),
  ).toEqual({ key: "files/hello.txt", url: "https://s3.example.test/media/files/hello.txt" });

  expect(requests).toHaveLength(1);
  const { url, init } = requests[0]!;
  const signedHeaders =
    acl === undefined
      ? "content-type;host;x-amz-content-sha256;x-amz-date"
      : "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";
  expect(url).toBe("https://s3.example.test/media/files/hello.txt");
  expect(init.method).toBe("PUT");
  expect(await new Response(init.body).text()).toBe("hello");
  expect(Object.fromEntries(new Headers(init.headers))).toEqual({
    authorization: `AWS4-HMAC-SHA256 Credential=key/20261022/us-east-1/s3/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "content-type": "text/plain",
    host: "s3.example.test",
    ...(acl === undefined ? {} : { "x-amz-acl": acl }),
    "x-amz-content-sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    "x-amz-date": "20261022T120000Z",
  });
});

test("a public upload does not change later uploads or store configuration", async () => {
  const initial = { ...store };
  await upload(store, { key: "public.txt", body: "public", acl: "public-read" });
  await upload(store, { key: "private.txt", body: "private" });
  const headers = new Headers(requests[1]!.init.headers);
  expect(headers.get("x-amz-acl")).toBeNull();
  expect(headers.get("authorization")).toContain("SignedHeaders=host;x-amz-content-sha256;x-amz-date,");
  expect(store).toEqual(initial);
});

test("a rejected public upload throws instead of returning an object URL", async () => {
  response = new Response("AccessDenied", { status: 403 });
  await expect(upload(store, { key: "denied.txt", body: "denied", acl: "public-read" })).rejects.toThrow("HTTP 403");
});
