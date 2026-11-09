import { ColorModeControl, Divider, NavLink, Stack, Title } from "@atlas/ui/components";
import { isPlainClick } from "@atlas/ui/headless";
import { Database, LayoutDashboard, LogOut, Search } from "lucide-react";
import type React from "react";
import { hrefFor, paths } from "../paths.ts";

export type SidebarProps = {
  models: { table: string }[];
  active?: string;
  basePath: string;
  onNavigate: (path: string) => void;
  onSignOut?: () => void;
};

export const AdminSidebar = ({ models, active, basePath, onNavigate, onSignOut }: SidebarProps) => {
  const link = (path: string) => ({
    href: hrefFor(basePath, path),
    onClick: (event: React.MouseEvent) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onNavigate(path);
    },
  });
  return (
    <Stack gap={0} p="md">
      <Title order={4} mb="md">
        Admin
      </Title>
      <NavLink
        label="Dashboard"
        leftSection={<LayoutDashboard size={16} />}
        active={active === "dashboard"}
        {...link(paths.dashboard)}
      />
      <Divider my="sm" />
      {models.map((m) => (
        <NavLink
          key={m.table}
          label={m.table}
          leftSection={<Database size={16} />}
          active={active === m.table}
          {...link(paths.list(m.table))}
        />
      ))}
      <Divider my="sm" />
      <NavLink
        label="Query Builder"
        leftSection={<Search size={16} />}
        active={active === "query"}
        {...link(paths.query)}
      />
      <Divider my="sm" />
      <ColorModeControl />
      {onSignOut && <NavLink mt="sm" label="Sign out" leftSection={<LogOut size={16} />} onClick={onSignOut} />}
    </Stack>
  );
};
