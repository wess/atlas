import { expect, test } from "bun:test";
import { defineConfig } from "../define.ts";
import { env } from "../env.ts";

test("defineConfig resolves env refs into a frozen object", () => {
  process.env.TEST_DB_URL = "postgres://localhost/test";
  process.env.TEST_PORT = "8080";

  const config = defineConfig({
    database: {
      url: env("TEST_DB_URL"),
    },
    http: {
      port: env("TEST_PORT", { parse: Number }),
    },
  });

  expect(config.database.url).toBe("postgres://localhost/test");
  expect(config.http.port).toBe(8080);

  delete process.env.TEST_DB_URL;
  delete process.env.TEST_PORT;
});

test("defineConfig returns a frozen object", () => {
  process.env.TEST_VAL = "x";
  const config = defineConfig({ val: env("TEST_VAL") });
  expect(Object.isFrozen(config)).toBe(true);
  delete process.env.TEST_VAL;
});

test("defineConfig throws if required var is missing", () => {
  expect(() => defineConfig({ missing: env("TOTALLY_MISSING") })).toThrow(
    "Missing required environment variable: TOTALLY_MISSING",
  );
});
