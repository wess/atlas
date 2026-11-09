import type { ComponentProps } from "react";
import { colors, component } from "../../factory/index.tsx";
import { Loader } from "../loader/index.tsx";

const Base = component({
  name: "actionicon",
  element: "button",
  variants: { variant: ["filled", "light", "subtle"], size: ["sm", "md", "lg"], color: colors },
  defaults: { variant: "filled", size: "md", color: "primary" },
});

// an icon has no text for a screen reader to announce, so the label is required
export type ActionIconProps = ComponentProps<typeof Base> & { "aria-label": string; loading?: boolean };

export const ActionIcon = ({ loading, disabled, children, type = "button", ...rest }: ActionIconProps) => (
  <Base type={type} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
    {loading ? <Loader size="xs" /> : children}
  </Base>
);
