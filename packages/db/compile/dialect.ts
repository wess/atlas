import type { Dialect } from "../types/index.ts";
import type { ParamCounter } from "../utils/params.ts";

export const createDialectCounter = (dialect: Dialect = "postgres", start: number = 1): ParamCounter => {
  let count = start;
  return dialect === "sqlite"
    ? {
        next: () => {
          count++;
          return "?";
        },
        current: () => count - 1,
      }
    : {
        next: () => `$${count++}`,
        current: () => count - 1,
      };
};
