import type { ComponentProps, CSSProperties } from "react";
import { component, compound } from "../../factory/index.tsx";

const Root = component({ name: "appshell" });

export type AppShellRootProps = ComponentProps<typeof Root> & { navbarWidth?: number };

export const AppShell = compound(
  ({ navbarWidth = 250, style, ...rest }: AppShellRootProps) => (
    <Root style={{ "--navbar-width": `${navbarWidth}px`, ...style } as CSSProperties} {...rest} />
  ),
  {
    Header: component({ name: "appshell__header", element: "header" }),
    Navbar: component({ name: "appshell__navbar", element: "nav" }),
    Main: component({ name: "appshell__main", element: "main" }),
  },
);
