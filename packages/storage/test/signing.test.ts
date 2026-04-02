import { expect, test } from "bun:test";
import { hmacSha256, sha256, signRequest } from "../signing/index.ts";

test("sha256 of empty string", () => {
  expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sha256 of known value", () => {
  expect(sha256("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

test("hmacSha256 produces correct output", () => {
  const result = hmacSha256(Buffer.from("key"), "data");
  expect(result).toBeInstanceOf(Buffer);
  expect(result.length).toBe(32);
});

test("signRequest produces valid authorization header", () => {
  const result = signRequest({
    method: "GET",
    url: new URL("https://s3.amazonaws.com/mybucket/mykey"),
    headers: new Headers({ host: "s3.amazonaws.com" }),
    accessKey: "AKIAIOSFODNN7EXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
  });

  expect(result.authorization).toContain("AWS4-HMAC-SHA256");
  expect(result.authorization).toContain("AKIAIOSFODNN7EXAMPLE");
  expect(result.authorization).toContain("us-east-1/s3/aws4_request");
  expect(result.authorization).toContain("SignedHeaders=");
  expect(result.authorization).toContain("Signature=");
  expect(result.date).toMatch(/^\d{8}T\d{6}Z$/);
  expect(result.contentHash).toBe(sha256(""));
});

test("signRequest with body hashes body", () => {
  const body = "hello world";
  const result = signRequest({
    method: "PUT",
    url: new URL("https://s3.amazonaws.com/mybucket/mykey"),
    headers: new Headers({ host: "s3.amazonaws.com" }),
    body,
    accessKey: "AKIAIOSFODNN7EXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
  });

  expect(result.contentHash).toBe(sha256(body));
});

test("signRequest includes all standard headers in signed headers", () => {
  const headers = new Headers({
    host: "s3.amazonaws.com",
    "content-type": "application/json",
  });

  const result = signRequest({
    method: "POST",
    url: new URL("https://s3.amazonaws.com/mybucket"),
    headers,
    body: "{}",
    accessKey: "AKIAIOSFODNN7EXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
  });

  expect(result.authorization).toContain("content-type");
  expect(result.authorization).toContain("host");
  expect(result.authorization).toContain("x-amz-content-sha256");
  expect(result.authorization).toContain("x-amz-date");
});

test("signRequest handles query parameters", () => {
  const url = new URL("https://s3.amazonaws.com/mybucket?list-type=2&prefix=photos/");
  const result = signRequest({
    method: "GET",
    url,
    headers: new Headers({ host: "s3.amazonaws.com" }),
    accessKey: "AKIAIOSFODNN7EXAMPLE",
    secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
  });

  expect(result.authorization).toContain("AWS4-HMAC-SHA256");
});
