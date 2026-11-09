import type { ComponentProps } from "react";
import { createField } from "../../factory/index.tsx";
import { normalizeOptions, type OptionInput } from "../../headless/index.tsx";

export type SelectOwnProps = Omit<ComponentProps<"select">, "value" | "onChange" | "multiple"> & {
  data: readonly OptionInput[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  clearable?: boolean;
  placeholder?: string;
};

// native on purpose: keyboard, screen reader and mobile pickers all come free
export const Select = createField<SelectOwnProps>(
  "select",
  (control, { data, value, onChange, clearable, placeholder, ...props }) => {
    const empty = clearable || placeholder || !value;
    return (
      <select
        {...control}
        {...props}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.currentTarget.value || null)}
      >
        {empty && (
          <option value="" disabled={!clearable}>
            {placeholder ?? ""}
          </option>
        )}
        {normalizeOptions(data).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
);
