import type { ComponentProps } from "react";
import { createField } from "../../factory/index.tsx";

export const TextInput = createField<ComponentProps<"input">>("textinput", (control, props) => (
  <input type="text" {...control} {...props} />
));
