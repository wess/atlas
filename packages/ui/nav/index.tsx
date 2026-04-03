import { Anchor, Breadcrumbs, NavLink as MantineNavLink, Stack } from "@mantine/core";
import type React from "react";

export { FileText, Home, LayoutDashboard, Settings, Users } from "lucide-react";

export type NavLinkProps = {
  to: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
};

export const NavLink = ({ to, label, icon, active, onClick }: NavLinkProps) => (
  <MantineNavLink href={to} label={label} leftSection={icon} active={active} onClick={onClick} />
);

export type SidebarProps = {
  children: React.ReactNode;
};

export const Sidebar = ({ children }: SidebarProps) => (
  <Stack gap={0} p="md">
    {children}
  </Stack>
);

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export const Breadcrumb = ({ items }: { items: BreadcrumbItem[] }) => (
  <Breadcrumbs>
    {items.map((item, i) =>
      item.href ? (
        <Anchor href={item.href} key={i}>
          {item.label}
        </Anchor>
      ) : (
        <span key={i}>{item.label}</span>
      ),
    )}
  </Breadcrumbs>
);
