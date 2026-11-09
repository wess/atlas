import type { ComponentProps } from "react";
import { createField } from "../../factory/index.tsx";

type NativeProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange">;

export type NumberInputOwnProps = NativeProps & {
  value?: number | "";
  onChange?: (value: number | "") => void;
};

export const NumberInput = createField<NumberInputOwnProps>("numberinput", (control, { onChange, ...props }) => (
  <input
    type="number"
    step="any"
    {...control}
    {...props}
    onChange={(event) => {
      const { value } = event.currentTarget;
      onChange?.(value === "" ? "" : Number(value));
    }}
  />
));
