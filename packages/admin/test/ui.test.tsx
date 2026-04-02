import { expect, test } from "bun:test";
import { AdminApp } from "../ui/app.tsx";
import { BulkBar } from "../ui/components/bulkbar.tsx";
import { FilterBuilder } from "../ui/components/filter.tsx";
import { AdminSidebar } from "../ui/components/sidebar.tsx";
import { Create } from "../ui/create.tsx";
import { Dashboard } from "../ui/dashboard.tsx";
import { Detail } from "../ui/detail.tsx";
import { ModelList } from "../ui/list.tsx";
import { QueryBuilder } from "../ui/query.tsx";

test("AdminApp is a function", () => {
  expect(typeof AdminApp).toBe("function");
});

test("Dashboard is a function", () => {
  expect(typeof Dashboard).toBe("function");
});

test("ModelList is a function", () => {
  expect(typeof ModelList).toBe("function");
});

test("FilterBuilder is a function", () => {
  expect(typeof FilterBuilder).toBe("function");
});

test("BulkBar is a function", () => {
  expect(typeof BulkBar).toBe("function");
});

test("QueryBuilder is a function", () => {
  expect(typeof QueryBuilder).toBe("function");
});

test("AdminSidebar is a function", () => {
  expect(typeof AdminSidebar).toBe("function");
});

test("Detail is a function", () => {
  expect(typeof Detail).toBe("function");
});

test("Create is a function", () => {
  expect(typeof Create).toBe("function");
});
