import type { ComponentProps, ReactNode } from "react";
import { component } from "../../factory/index.tsx";

const Root = component({ name: "checkbox", element: "label" });

export type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { label?: ReactNode; indeterminate?: boolean };

export const Checkbox = ({ label, indeterminate = false, className, style, ...props }: CheckboxProps) => (
  <Root className={className} style={style}>
    <input
      type="checkbox"
      // indeterminate has no html attribute, it only exists as a dom property
      ref={(element) => {
        if (element) element.indeterminate = indeterminate;
      }}
      {...props}
    />
    {label && <span>{label}</span>}
  </Root>
);
