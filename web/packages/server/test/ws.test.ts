import { expect, test } from "bun:test";
import { channel, createRooms } from "../ws/index.ts";

test("channel creates a channel definition", () => {
  const ch = channel("chat", {
    join: () => true,
    handle: () => {},
  });
  expect(ch.name).toBe("chat");
  expect(typeof ch.join).toBe("function");
});

test("createRooms manages rooms", () => {
  const rooms = createRooms();
  const mockWs = {
    raw: null,
    data: {},
    send: () => {},
    close: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
  };
  rooms.join(mockWs as any, "lobby");
  expect(rooms.members("lobby").size).toBe(1);
  rooms.leave(mockWs as any, "lobby");
  expect(rooms.members("lobby").size).toBe(0);
});

test("createRooms returns empty set for unknown room", () => {
  const rooms = createRooms();
  expect(rooms.members("nope").size).toBe(0);
});

test("createRooms broadcast sends to all members except excluded", () => {
  const rooms = createRooms();
  const sent: string[] = [];
  const makeMock = (id: string) => ({
    raw: null,
    data: {},
    send: (msg: string) => {
      sent.push(`${id}:${msg}`);
    },
    close: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
  });

  const ws1 = makeMock("ws1");
  const ws2 = makeMock("ws2");
  rooms.join(ws1 as any, "room");
  rooms.join(ws2 as any, "room");

  rooms.broadcast("room", "hello", ws1 as any);
  expect(sent).toEqual(["ws2:hello"]);
});

test("createRooms broadcast serializes objects", () => {
  const rooms = createRooms();
  const sent: string[] = [];
  const mockWs = {
    raw: null,
    data: {},
    send: (msg: string) => {
      sent.push(msg);
    },
    close: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
  };
  rooms.join(mockWs as any, "room");
  rooms.broadcast("room", { foo: "bar" });
  expect(sent).toEqual([JSON.stringify({ foo: "bar" })]);
});
