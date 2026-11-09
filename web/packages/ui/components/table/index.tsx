import { component } from "../../factory/index.tsx";

// children are plain thead/tr/th/td: the table semantics are already html
export const Table = component({
  name: "table",
  element: "table",
  variants: { striped: true, highlightOnHover: true },
});
