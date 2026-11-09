import { Children, type ComponentProps } from "react";
import { component } from "../../factory/index.tsx";

const Base = component({ name: "breadcrumbs", element: "nav" });

export const Breadcrumbs = ({ children, ...rest }: ComponentProps<typeof Base>) => (
  <Base aria-label="Breadcrumb" {...rest}>
    <ol>
      {Children.toArray(children as React.ReactNode).map((child, index) => (
        // position is the identity of a crumb in a static trail
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <li key={index}>{child}</li>
      ))}
    </ol>
  </Base>
);
