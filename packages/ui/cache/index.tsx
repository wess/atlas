import { Badge, Button, Group, Paper, Table, Text, Title } from "@mantine/core";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import React from "react";

export type CacheEntry = {
  key: string;
  value: unknown;
  ttl?: number;
};

export type CacheInspectorProps = {
  entries: CacheEntry[];
  onInvalidate?: (key: string) => void;
  onFlush?: () => void;
};

export const CacheInspector = ({ entries, onInvalidate, onFlush }: CacheInspectorProps) => (
  <Paper p="md">
    <Group justify="space-between" mb="md">
      <Group gap="xs">
        <Database size={18} />
        <Title order={4}>Cache Inspector</Title>
      </Group>
      {onFlush && (
        <Button color="red" size="xs" onClick={onFlush} leftSection={<RefreshCw size={14} />}>
          Flush All
        </Button>
      )}
    </Group>
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Key</Table.Th>
          <Table.Th>Value</Table.Th>
          <Table.Th>TTL</Table.Th>
          {onInvalidate && <Table.Th>Actions</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entries.map((entry) => (
          <Table.Tr key={entry.key}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {entry.key}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" truncate>
                {JSON.stringify(entry.value)}
              </Text>
            </Table.Td>
            <Table.Td>{entry.ttl ? <Badge>{entry.ttl}s</Badge> : <Badge color="gray">none</Badge>}</Table.Td>
            {onInvalidate && (
              <Table.Td>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={() => onInvalidate(entry.key)}
                  leftSection={<Trash2 size={14} />}
                >
                  Invalidate
                </Button>
              </Table.Td>
            )}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  </Paper>
);

export type CacheStatusProps = {
  connected: boolean;
  entries: number;
  hitRate?: number;
};

export const CacheStatus = ({ connected, entries, hitRate }: CacheStatusProps) => (
  <Group>
    <Badge color={connected ? "green" : "red"}>{connected ? "Connected" : "Disconnected"}</Badge>
    <Text size="sm">{entries} entries</Text>
    {hitRate !== undefined && <Text size="sm">{(hitRate * 100).toFixed(1)}% hit rate</Text>}
  </Group>
);
