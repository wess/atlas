import { expect, test } from "bun:test";
import { canModerate, canView, commentText, imageType } from "../index.ts";

test("visibility and moderation stay with the owner", () => {
  expect(canView({ ownerId: "a", viewerId: "a", visibility: "private" })).toBe(true);
  expect(canView({ ownerId: "a", viewerId: "b", visibility: "private" })).toBe(false);
  expect(canView({ ownerId: "a", visibility: "public" })).toBe(true);
  expect(canView({ ownerId: "a", viewerId: "b", visibility: "public", blocked: true })).toBe(false);
  expect(canModerate("a", "b")).toBe(false);
  expect(canModerate("a", "a")).toBe(true);
});

test("image signatures and comment length are checked", () => {
  expect(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]))?.extension).toBe("jpg");
  expect(imageType(new Uint8Array(12))).toBeNull();
  expect(commentText("  made this   tonight  ")).toBe("made this tonight");
  expect(commentText(" ")).toBeNull();
});
