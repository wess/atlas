import { Database, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Group, Paper, Table, Text, Title } from "../components/index.tsx";

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
        <Button color="danger" size="xs" onClick={onFlush} leftSection={<RefreshCw size={14} />}>
          Flush All
        </Button>
      )}
    </Group>
    <Table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
          <th>TTL</th>
          {onInvalidate && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.key}>
            <td>
              <Text size="sm" fw={500}>
                {entry.key}
              </Text>
            </td>
            <td>
              <Text size="sm" truncate>
                {JSON.stringify(entry.value)}
              </Text>
            </td>
            <td>{entry.ttl ? <Badge>{entry.ttl}s</Badge> : <Badge color="neutral">none</Badge>}</td>
            {onInvalidate && (
              <td>
                <Button
                  size="xs"
                  variant="light"
                  color="danger"
                  onClick={() => onInvalidate(entry.key)}
                  leftSection={<Trash2 size={14} />}
                >
                  Invalidate
                </Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
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
    <Badge color={connected ? "success" : "danger"}>{connected ? "Connected" : "Disconnected"}</Badge>
    <Text size="sm">{entries} entries</Text>
    {hitRate !== undefined && <Text size="sm">{(hitRate * 100).toFixed(1)}% hit rate</Text>}
  </Group>
);
