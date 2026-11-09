import type { ComponentProps, ReactNode } from "react";
import { component } from "../../factory/index.tsx";

const Base = component({ name: "navlink", element: "a", variants: { active: true } });

export type NavLinkProps = Omit<ComponentProps<typeof Base>, "children"> & {
  label: ReactNode;
  leftSection?: ReactNode;
};

// without a destination it is an action, so it has to be a button to stay keyboard reachable
export const NavLink = ({ label, leftSection, active, href, ...rest }: NavLinkProps) => (
  <Base
    as={href ? "a" : "button"}
    href={href}
    {...(href ? {} : { type: "button" })}
    active={active}
    aria-current={active ? "page" : undefined}
    {...rest}
  >
    {leftSection}
    <span>{label}</span>
  </Base>
);
