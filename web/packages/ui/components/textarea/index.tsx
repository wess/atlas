import type { ComponentProps, CSSProperties } from "react";
import { createField } from "../../factory/index.tsx";

export type TextareaOwnProps = ComponentProps<"textarea"> & { autosize?: boolean; minRows?: number; maxRows?: number };

export const Textarea = createField<TextareaOwnProps>(
  "textarea",
  (control, { autosize, minRows = 2, maxRows, style, ...props }) => {
    const rows = { "--rows-min": minRows, "--rows-max": maxRows ?? "none" } as CSSProperties;
    return (
      <textarea
        {...control}
        {...props}
        rows={minRows}
        data-autosize={autosize ? "" : undefined}
        style={{ ...rows, ...style }}
      />
    );
  },
);
