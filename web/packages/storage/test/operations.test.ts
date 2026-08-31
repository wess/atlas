import { describe, expect, test } from "bun:test";
import { createStore } from "../store/index.ts";

// These tests require a running S3-compatible server (RustFS/MinIO).
// They are skipped by default. Set S3_TEST=1 to run them.
const S3_TEST = process.env.S3_TEST === "1";
const describeS3 = S3_TEST ? describe : describe.skip;

describeS3("operations (requires S3 server)", () => {
  const { upload, download, remove, list } = require("../operations/index.ts");

  const store = createStore({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    bucket: process.env.S3_BUCKET ?? "test",
    accessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.S3_SECRET_KEY ?? "minioadmin",
    region: process.env.S3_REGION ?? "us-east-1",
  });

  const testKey = `test/${Date.now()}.txt`;
  const testBody = "hello from atlas storage";

  test("upload a file", async () => {
    const result = await upload(store, {
      key: testKey,
      body: testBody,
      contentType: "text/plain",
    });
    expect(result.key).toBe(testKey);
    expect(result.url).toContain(testKey);
  });

  test("download the uploaded file", async () => {
    const res = await download(store, testKey);
    const text = await res.text();
    expect(text).toBe(testBody);
  });

  test("list files with prefix", async () => {
    const result = await list(store, "test/");
    expect(result.keys).toContain(testKey);
  });

  test("remove the file", async () => {
    await remove(store, testKey);
    // verify it was removed by trying to download
    try {
      await download(store, testKey);
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain("Download failed");
    }
  });
});

// Unit tests that don't require a server
describe("operations (unit)", () => {
  test("store creation for operations", () => {
    const store = createStore({
      endpoint: "http://localhost:9000",
      bucket: "mybucket",
      accessKey: "key",
      secretKey: "secret",
    });
    expect(store.bucket).toBe("mybucket");
    expect(store.region).toBe("us-east-1");
  });
});
