import { expect, test } from "bun:test";
import { createFramer } from "../server/framing.ts";

const frame = (body: string) => Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);

test("stdio frames use byte lengths across split UTF-8 and combined messages", () => {
  const frames = createFramer();
  const body = JSON.stringify({ id: 1, text: "日本語 café" });
  const first = frame(body);
  const split = first.indexOf(Buffer.from("日")) + 1;
  expect(frames.push(first.subarray(0, split))).toEqual([]);
  expect(frames.push(Buffer.concat([first.subarray(split), frame("{}")]))).toEqual([body, "{}"]);
});

test("stdio rejects oversized or ambiguous frames before reading their bodies", () => {
  for (const header of [
    "Content-Length: 1048577",
    "Content-Length: 0",
    "Content-Length: 10\r\nContent-Length: 10",
    "Content-Length: 9007199254740993",
  ]) {
    expect(() => createFramer().push(Buffer.from(`${header}\r\n\r\n`))).toThrow();
  }
  expect(() => createFramer().push(Buffer.from("x".repeat(8193)))).toThrow();
});
