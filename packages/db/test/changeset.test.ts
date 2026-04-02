import { expect, test } from "bun:test";
import { z } from "zod";
import { changeset } from "../changeset/index.ts";
import { column, defineSchema } from "../schema/index.ts";

const users = defineSchema("users", {
  id: column.serial().primaryKey(),
  email: column.text(),
  name: column.text(),
  age: column.integer(),
});

const createUser = changeset(users, {
  cast: ["email", "name", "age"],
  required: ["email"],
  validate: {
    email: z.string().email(),
    name: z.string().min(1).max(100),
    age: z.number().int().min(0).optional(),
  },
});

test("valid changeset", () => {
  const cs = createUser({ email: "wess@test.com", name: "Wess" });
  expect(cs.valid).toBe(true);
  expect(cs.changes).toEqual({ email: "wess@test.com", name: "Wess" });
  expect(cs.errors).toEqual({});
});

test("missing required field", () => {
  const cs = createUser({ name: "Wess" });
  expect(cs.valid).toBe(false);
  expect(cs.errors.email).toBeDefined();
});

test("validation error", () => {
  const cs = createUser({ email: "not-an-email", name: "Wess" });
  expect(cs.valid).toBe(false);
  expect(cs.errors.email).toBeDefined();
});

test("strips fields not in cast", () => {
  const cs = createUser({ email: "wess@test.com", name: "Wess", admin: true } as any);
  expect(cs.valid).toBe(true);
  expect(cs.changes).toEqual({ email: "wess@test.com", name: "Wess" });
  expect((cs.changes as any).admin).toBeUndefined();
});

test("changeset with all fields", () => {
  const cs = createUser({ email: "wess@test.com", name: "Wess", age: 30 });
  expect(cs.valid).toBe(true);
  expect(cs.changes).toEqual({ email: "wess@test.com", name: "Wess", age: 30 });
});
