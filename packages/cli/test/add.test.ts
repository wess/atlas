import { test, expect } from "bun:test";
import { addCommand } from "../add/index.ts";

test("addCommand is defined", () => {
  expect(addCommand.name).toBe("add");
  expect(addCommand.description).toContain("Atlas");
});
