import { ActionIcon, Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { Plus, X } from "lucide-react";

export type FilterRow = {
  field: string;
  op: string;
  value: string;
};

export type FilterBuilderProps = {
  filters: FilterRow[];
  fields: string[];
  onChange: (filters: FilterRow[]) => void;
};

const OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "like", label: "like" },
  { value: "ilike", label: "ilike" },
  { value: "null", label: "is null" },
  { value: "notnull", label: "is not null" },
];

export const FilterBuilder = ({ filters, fields, onChange }: FilterBuilderProps) => {
  const add = () => onChange([...filters, { field: fields[0] ?? "", op: "eq", value: "" }]);
  const remove = (i: number) => onChange(filters.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<FilterRow>) =>
    onChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <Stack gap="xs">
      {filters.map((f, i) => (
        <Group key={i} gap="xs">
          <Select size="xs" data={fields} value={f.field} onChange={(v) => update(i, { field: v ?? "" })} />
          <Select size="xs" data={OPS} value={f.op} onChange={(v) => update(i, { op: v ?? "eq" })} />
          {!["null", "notnull"].includes(f.op) && (
            <TextInput size="xs" value={f.value} onChange={(e) => update(i, { value: e.currentTarget.value })} />
          )}
          <ActionIcon size="sm" color="red" variant="light" onClick={() => remove(i)}>
            <X size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="light" leftSection={<Plus size={14} />} onClick={add}>
        Add Filter
      </Button>
    </Stack>
  );
};
