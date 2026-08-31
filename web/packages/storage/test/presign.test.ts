import { expect, test } from "bun:test";
import { presign } from "../presign/index.ts";
import { createStore } from "../store/index.ts";

const store = createStore({
  endpoint: "http://localhost:9000",
  bucket: "test",
  accessKey: "minioadmin",
  secretKey: "minioadmin",
  region: "us-east-1",
});

test("presign generates URL with all signing params", () => {
  const url = presign(store, "photo.png", { expires: 3600 });
  expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
  expect(url).toContain("X-Amz-Credential=");
  expect(url).toContain("X-Amz-Signature=");
  expect(url).toContain("X-Amz-Expires=3600");
  expect(url).toContain("X-Amz-Date=");
  expect(url).toContain("X-Amz-SignedHeaders=host");
});

test("presign defaults to 3600 seconds expiry", () => {
  const url = presign(store, "file.txt");
  expect(url).toContain("X-Amz-Expires=3600");
});

test("presign uses custom expiry", () => {
  const url = presign(store, "file.txt", { expires: 900 });
  expect(url).toContain("X-Amz-Expires=900");
});

test("presign includes bucket and key in path", () => {
  const url = presign(store, "docs/readme.pdf");
  const parsed = new URL(url);
  expect(parsed.pathname).toBe("/test/docs/readme.pdf");
});

test("presign credential includes region and service", () => {
  const url = presign(store, "file.txt");
  expect(url).toContain("us-east-1");
  expect(url).toContain("s3");
  expect(url).toContain("aws4_request");
});

test("presign returns valid URL", () => {
  const url = presign(store, "file.txt");
  expect(() => new URL(url)).not.toThrow();
});
