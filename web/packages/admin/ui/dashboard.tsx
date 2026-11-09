import { Group, Paper, SimpleGrid, Text, Title } from "@atlas/ui/components";
import { isPlainClick } from "@atlas/ui/headless";
import { Database } from "lucide-react";
import type React from "react";
import { hrefFor, paths } from "./paths.ts";

export type DashboardProps = {
  models: { table: string; count: number }[];
  basePath?: string;
  onNavigate: (path: string) => void;
};

export const Dashboard = ({ models, basePath = "/admin", onNavigate }: DashboardProps) => (
  <div>
    <Title order={2} mb="lg">
      Dashboard
    </Title>
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {models.map((m) => (
        <Paper
          key={m.table}
          as="a"
          interactive
          p="lg"
          withBorder
          {...{ href: hrefFor(basePath, paths.list(m.table)) }}
          onClick={(event: React.MouseEvent) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onNavigate(paths.list(m.table));
          }}
        >
          <Group>
            <Database size={24} />
            <div>
              <Text fw={500} tt="capitalize">
                {m.table}
              </Text>
              <Text size="xl" fw={700}>
                {m.count}
              </Text>
              <Text size="sm" c="dimmed">
                records
              </Text>
            </div>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  </div>
);
