import type { Fragment } from "../types/index.ts";

export const raw = (sql: string, ...values: any[]): Fragment => ({
  __brand: "fragment" as const,
  sql,
  values,
});

export const isFragment = (value: unknown): value is Fragment => {
  return (
    typeof value === "object" && value !== null && "__brand" in value && (value as Fragment).__brand === "fragment"
  );
};
