import { Button, Group, Text } from "@mantine/core";
import { Download, Trash2 } from "lucide-react";
import React from "react";

export type BulkBarProps = {
  selectedCount: number;
  actions: string[];
  customActions?: { name: string; label: string }[];
  onAction: (action: string) => void;
};

export const BulkBar = ({ selectedCount, actions, customActions, onAction }: BulkBarProps) => {
  if (selectedCount === 0) return null;
  return (
    <Group p="xs" bg="blue.0" mb="md" style={{ borderRadius: 4 }}>
      <Text size="sm" fw={500}>
        {selectedCount} selected
      </Text>
      {actions.includes("delete") && (
        <Button size="xs" color="red" leftSection={<Trash2 size={14} />} onClick={() => onAction("delete")}>
          Delete
        </Button>
      )}
      {actions.includes("export") && (
        <Button size="xs" variant="light" leftSection={<Download size={14} />} onClick={() => onAction("export")}>
          Export CSV
        </Button>
      )}
      {customActions?.map((a) => (
        <Button key={a.name} size="xs" variant="light" onClick={() => onAction(a.name)}>
          {a.label}
        </Button>
      ))}
    </Group>
  );
};
