import { colors, component } from "../../factory/index.tsx";

export const Badge = component({
  name: "badge",
  element: "span",
  variants: { color: colors, variant: ["filled", "light"], size: ["sm", "md"] },
  defaults: { color: "primary", variant: "filled", size: "md" },
});
