import type { ComponentProps } from "react";
import { component } from "../../factory/index.tsx";

const Base = component({ name: "collapse", variants: { expanded: true } });

// inert keeps collapsed controls out of the tab order, which the height animation alone would not
export const Collapse = ({ expanded, children, ...rest }: ComponentProps<typeof Base>) => (
  <Base expanded={expanded} inert={!expanded} {...rest}>
    <div>{children}</div>
  </Base>
);
