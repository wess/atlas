import { component, sizes } from "../../factory/index.tsx";

export const Text = component({
  name: "text",
  element: "p",
  variants: { size: sizes, c: ["dimmed"], truncate: true },
});
