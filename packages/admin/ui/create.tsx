import { Button, Checkbox, Group, NumberInput, Paper, Stack, Textarea, TextInput, Title } from "@mantine/core";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";

type SchemaColumn = {
  name: string;
  type: string;
  primary?: boolean;
};

type SchemaModel = {
  table: string;
  columns: SchemaColumn[];
};

export type CreateProps = {
  table: string;
  schema: SchemaModel;
  basePath: string;
  onNavigate: (path: string) => void;
};

const fieldForColumn = (col: SchemaColumn, value: unknown, onChange: (name: string, val: unknown) => void) => {
  if (col.primary) return null;
  const v = value ?? "";
  switch (col.type) {
    case "integer":
    case "real":
      return (
        <NumberInput
          key={col.name}
          label={col.name}
          value={typeof v === "number" ? v : Number(v) || 0}
          onChange={(val) => onChange(col.name, val)}
        />
      );
    case "boolean":
      return (
        <Checkbox
          key={col.name}
          label={col.name}
          checked={!!v}
          onChange={(e) => onChange(col.name, e.currentTarget.checked)}
        />
      );
    case "json":
    case "jsonb":
      return (
        <Textarea
          key={col.name}
          label={col.name}
          value={typeof v === "string" ? v : JSON.stringify(v, null, 2)}
          onChange={(e) => onChange(col.name, e.currentTarget.value)}
          autosize
          minRows={3}
        />
      );
    default:
      return (
        <TextInput
          key={col.name}
          label={col.name}
          value={String(v)}
          onChange={(e) => onChange(col.name, e.currentTarget.value)}
        />
      );
  }
};

export const Create = ({ table, schema, basePath, onNavigate }: CreateProps) => {
  const [record, setRecord] = useState<Record<string, unknown>>({});

  const handleChange = (name: string, value: unknown) => {
    setRecord((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const res = await fetch(`${basePath}/api/${table}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
    });
    const body = await res.json();
    if (body.data?.id) {
      onNavigate(`detail/${table}/${body.data.id}`);
    } else {
      onNavigate(`list/${table}`);
    }
  };

  return (
    <div>
      <Group mb="md">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => onNavigate(`list/${table}`)}>
          Back
        </Button>
        <Title order={2} tt="capitalize">
          New {table}
        </Title>
      </Group>

      <Paper p="md" withBorder>
        <Stack>
          {schema.columns.map((col) => fieldForColumn(col, record[col.name], handleChange))}
          <Group>
            <Button leftSection={<Save size={16} />} onClick={handleSave}>
              Create
            </Button>
          </Group>
        </Stack>
      </Paper>
    </div>
  );
};
