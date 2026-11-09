import { expect, test } from "bun:test";
import { isPlainClick, normalizeOptions, pageRange } from "../headless/index.tsx";

test("pageRange lists every page when nothing needs eliding", () => {
  expect(pageRange(4, 2)).toEqual([1, 2, 3, 4]);
  expect(pageRange(1, 1)).toEqual([1]);
  expect(pageRange(0, 1)).toEqual([]);
});

test("pageRange elides around the current page", () => {
  expect(pageRange(20, 10)).toEqual([1, "dots", 9, 10, 11, "dots", 20]);
});

test("pageRange fills a one page gap rather than hiding a single number", () => {
  expect(pageRange(20, 4)).toEqual([1, 2, 3, 4, 5, "dots", 20]);
});

test("pageRange handles both ends", () => {
  expect(pageRange(20, 1)).toEqual([1, 2, "dots", 20]);
  expect(pageRange(20, 20)).toEqual([1, "dots", 19, 20]);
});

test("normalizeOptions accepts strings and pairs", () => {
  expect(normalizeOptions(["a", { value: "b", label: "Bee" }])).toEqual([
    { value: "a", label: "a" },
    { value: "b", label: "Bee" },
  ]);
});

test("isPlainClick leaves modified and non-primary clicks to the browser", () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  expect(isPlainClick(plain)).toBe(true);
  for (const change of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
    expect(isPlainClick({ ...plain, ...change })).toBe(false);
  }
});
