import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type SchemaColumn = {
  name: string;
  type: string;
  primary?: boolean;
  nullable?: boolean;
};

type SchemaModel = {
  table: string;
  columns: SchemaColumn[];
  readOnly?: boolean;
  relations?: { table: string; foreignKey: string; label?: string }[];
};

export type DetailProps = {
  table: string;
  id: string;
  schema: SchemaModel;
  basePath: string;
  onNavigate: (path: string) => void;
};

const fieldForColumn = (
  col: SchemaColumn,
  value: unknown,
  onChange: (name: string, val: unknown) => void,
  readOnly: boolean,
) => {
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
          disabled={col.primary || readOnly}
        />
      );
    case "boolean":
      return (
        <Checkbox
          key={col.name}
          label={col.name}
          checked={!!v}
          onChange={(e) => onChange(col.name, e.currentTarget.checked)}
          disabled={readOnly}
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
          disabled={readOnly}
        />
      );
    default:
      return (
        <TextInput
          key={col.name}
          label={col.name}
          value={String(v)}
          onChange={(e) => onChange(col.name, e.currentTarget.value)}
          disabled={col.primary || readOnly}
        />
      );
  }
};

export const Detail = ({ table, id, schema, basePath, onNavigate }: DetailProps) => {
  const [record, setRecord] = useState<Record<string, unknown>>({});
  const [relations, setRelations] = useState<Record<string, Record<string, unknown>[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${basePath}/api/${table}/${id}`);
      const body = await res.json();
      setRecord(body.data ?? {});
      setLoading(false);

      if (schema.relations) {
        for (const rel of schema.relations) {
          const rres = await fetch(`${basePath}/api/${table}/${id}/relations/${rel.table}`);
          const rbody = await rres.json();
          setRelations((prev) => ({ ...prev, [rel.table]: rbody.data ?? [] }));
        }
      }
    };
    load();
  }, [basePath, table, id, schema.relations]);

  const handleChange = (name: string, value: unknown) => {
    setRecord((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const payload = { ...record };
    const primaryCol = schema.columns.find((c) => c.primary);
    if (primaryCol) delete payload[primaryCol.name];

    await fetch(`${basePath}/api/${table}/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const handleDelete = async () => {
    await fetch(`${basePath}/api/${table}/${id}`, { method: "DELETE" });
    onNavigate(`list/${table}`);
  };

  if (loading) return <Text>Loading...</Text>;

  const readOnly = schema.readOnly ?? false;

  return (
    <div>
      <Group mb="md">
        <Button variant="subtle" leftSection={<ArrowLeft size={16} />} onClick={() => onNavigate(`list/${table}`)}>
          Back
        </Button>
        <Title order={2} tt="capitalize">
          {table} #{id}
        </Title>
      </Group>

      <Tabs defaultValue="details">
        <Tabs.List>
          <Tabs.Tab value="details">Details</Tabs.Tab>
          {schema.relations?.map((rel) => (
            <Tabs.Tab key={rel.table} value={rel.table}>
              {rel.label ?? rel.table}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="details" pt="md">
          <Paper p="md" withBorder>
            <Stack>
              {schema.columns.map((col) => fieldForColumn(col, record[col.name], handleChange, readOnly))}
              {!readOnly && (
                <Group>
                  <Button leftSection={<Save size={16} />} onClick={handleSave}>
                    Save
                  </Button>
                  <Button color="red" variant="light" leftSection={<Trash2 size={16} />} onClick={handleDelete}>
                    Delete
                  </Button>
                </Group>
              )}
            </Stack>
          </Paper>
        </Tabs.Panel>

        {schema.relations?.map((rel) => (
          <Tabs.Panel key={rel.table} value={rel.table} pt="md">
            <Paper p="md" withBorder>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    {relations[rel.table]?.[0] &&
                      Object.keys(relations[rel.table]![0]!).map((k) => <Table.Th key={k}>{k}</Table.Th>)}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(relations[rel.table] ?? []).map((row, i) => (
                    <Table.Tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <Table.Td key={j}>{String(v)}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
};
