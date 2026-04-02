import { expect, test } from "bun:test";
import { ActionColumn, createTable, DateColumn, TextColumn } from "../table/index.tsx";

test("TextColumn creates a column def", () => {
  const col = TextColumn({ key: "name", label: "Name", sortable: true });
  expect(col.header).toBe("Name");
  expect(col.enableSorting).toBe(true);
});

test("DateColumn creates a column def", () => {
  const col = DateColumn({ key: "createdAt", label: "Created" });
  expect(col.header).toBe("Created");
});

test("ActionColumn creates a column def", () => {
  const col = ActionColumn({ onEdit: () => {}, onDelete: () => {} });
  expect(col.id).toBe("actions");
});

test("createTable returns a function", () => {
  const Table = createTable({
    data: [{ name: "test" }],
    columns: [TextColumn({ key: "name", label: "Name" })],
  });
  expect(typeof Table).toBe("function");
});
