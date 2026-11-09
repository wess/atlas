import { component } from "../../factory/index.tsx";

export const Paper = component({
  name: "paper",
  variants: { radius: ["sm", "md", "lg"], withBorder: true, interactive: true },
  defaults: { radius: "md" },
});
