import { Group, Paper, SimpleGrid, Text, Title } from "@mantine/core";
import { Database } from "lucide-react";
import React from "react";

export type DashboardProps = {
  models: { table: string; count: number }[];
  onNavigate: (path: string) => void;
};

export const Dashboard = ({ models, onNavigate }: DashboardProps) => (
  <div>
    <Title order={2} mb="lg">
      Dashboard
    </Title>
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {models.map((m) => (
        <Paper
          key={m.table}
          p="lg"
          withBorder
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate(`list/${m.table}`)}
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
