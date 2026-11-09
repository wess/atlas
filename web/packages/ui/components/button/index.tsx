import type { ComponentProps, ReactNode } from "react";
import { colors, component, sizes } from "../../factory/index.tsx";
import { Loader } from "../loader/index.tsx";

const Base = component({
  name: "button",
  element: "button",
  variants: { variant: ["filled", "light", "subtle"], size: sizes, color: colors, fullWidth: true },
  defaults: { variant: "filled", size: "sm", color: "primary" },
});

export type ButtonProps = ComponentProps<typeof Base> & { leftSection?: ReactNode; loading?: boolean };

export const Button = ({ leftSection, loading, disabled, children, type = "button", ...rest }: ButtonProps) => (
  <Base type={type} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
    {loading ? <Loader size="xs" /> : leftSection}
    <span>{children}</span>
  </Base>
);
