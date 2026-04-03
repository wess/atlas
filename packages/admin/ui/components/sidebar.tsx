import { Divider, NavLink, Stack, Title } from "@mantine/core";
import { Database, LayoutDashboard, Search } from "lucide-react";

export type SidebarProps = {
  models: { table: string }[];
  active?: string;
  basePath: string;
  onNavigate: (path: string) => void;
};

export const AdminSidebar = ({ models, active, _basePath, onNavigate }: SidebarProps) => (
  <Stack gap={0} p="md">
    <Title order={4} mb="md">
      Admin
    </Title>
    <NavLink
      label="Dashboard"
      leftSection={<LayoutDashboard size={16} />}
      active={active === "dashboard"}
      onClick={() => onNavigate("dashboard")}
    />
    <Divider my="sm" />
    {models.map((m) => (
      <NavLink
        key={m.table}
        label={m.table}
        leftSection={<Database size={16} />}
        active={active === m.table}
        onClick={() => onNavigate(`list/${m.table}`)}
      />
    ))}
    <Divider my="sm" />
    <NavLink
      label="Query Builder"
      leftSection={<Search size={16} />}
      active={active === "query"}
      onClick={() => onNavigate("query")}
    />
  </Stack>
);
