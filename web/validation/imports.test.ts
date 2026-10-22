import { expect, test } from "bun:test";
import { migrateImports } from "./imports.ts";

test("migration keeps bindings while separating auth primitives and flows", () => {
  const text = migrateImports(
    'import { hash, verify as check, token as jwt, requireAuth, type Jwk } from "@atlas/auth";',
  );
  expect(text).toContain('import * as jwt from "@wess/atlas/auth/token";');
  expect(text).toContain('import { hash, verify as check } from "@wess/atlas/auth/password";');
  expect(text).toContain('import { requireAuth } from "@wess/atlas/auth/flows";');
  expect(text).toContain('import { type Jwk } from "@wess/atlas/auth/token";');
});

test("migration chooses an explicit driver only when the source has one driver", () => {
  const source = 'import { connect, from, type Connection } from "atlas/db"; connect({driver:"postgres",url});';
  expect(migrateImports(source)).toContain('import { connect } from "@wess/atlas/db/postgres";');
  expect(migrateImports(source)).toContain('import { from, type Connection } from "@wess/atlas/db/query";');
  expect(migrateImports(`${source}\nconnect({driver:"sqlite",path});`)).toContain(
    'import { connect } from "@wess/atlas/db";',
  );
});

test("migration handles public MCP and storage signing exports", () => {
  expect(migrateImports('import { signRequest } from "atlas/packages/storage/signing/index.ts";')).toContain(
    'from "@wess/atlas/storage/signing"',
  );
  expect(migrateImports('import { defineTool } from "@wess/atlas/packages/mcp/tools/types.ts";')).toContain(
    'from "@wess/atlas/mcp"',
  );
});

test("migration preserves commented bindings and is idempotent", () => {
  const source = 'import { /* password */ hash } from "@atlas/auth";';
  expect(migrateImports(source)).toBe(source.replace("@atlas/auth", "@wess/atlas/auth"));
  const result = migrateImports('import { hash, token } from "@atlas/auth";');
  expect(migrateImports(result)).toBe(result);
});
