import {
  Button,
  Code,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Eye, Play } from "lucide-react";
import React, { useState } from "react";
import { FilterBuilder, type FilterRow } from "./components/filter.tsx";

type SchemaModel = {
  table: string;
  columns: { name: string; type: string }[];
};

export type QueryBuilderProps = {
  models: SchemaModel[];
  basePath: string;
};

export const QueryBuilder = ({ models, basePath }: QueryBuilderProps) => {
  const [selectedTable, setSelectedTable] = useState<string>(models[0]?.table ?? "");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<string>("asc");
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [limit, setLimit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);
  const [sql, setSql] = useState("");
  const [params, setParams] = useState<unknown[]>([]);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);

  const currentModel = models.find((m) => m.table === selectedTable);
  const columnNames = currentModel?.columns.map((c) => c.name) ?? [];
  const tableNames = models.map((m) => m.table);

  const buildPayload = () => ({
    table: selectedTable,
    select: selectedColumns.length > 0 ? selectedColumns : undefined,
    filters: filters
      .filter((f) => f.field)
      .map((f) => ({
        field: f.field,
        op: f.op,
        value: ["null", "notnull"].includes(f.op) ? undefined : f.value,
      })),
    sort: sortField ? { field: sortField, order: sortOrder } : undefined,
    limit,
    offset,
    groupBy: groupBy.length > 0 ? groupBy : undefined,
  });

  const handlePreview = async () => {
    const res = await fetch(`${basePath}/api/query/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const body = await res.json();
    setSql(body.sql ?? "");
    setParams(body.params ?? []);
    setResults(null);
  };

  const handleExecute = async () => {
    const res = await fetch(`${basePath}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const body = await res.json();
    setSql(body.sql ?? "");
    setParams(body.params ?? []);
    setResults(body.data ?? []);
  };

  return (
    <div>
      <Title order={2} mb="lg">
        Query Builder
      </Title>

      <Stack gap="md">
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Select
              label="Table"
              data={tableNames}
              value={selectedTable}
              onChange={(v) => {
                setSelectedTable(v ?? "");
                setSelectedColumns([]);
                setFilters([]);
                setSortField(null);
                setGroupBy([]);
              }}
            />
            <MultiSelect
              label="Columns"
              data={columnNames}
              value={selectedColumns}
              onChange={setSelectedColumns}
              placeholder="All columns"
            />
            <Text fw={500} size="sm">
              Filters
            </Text>
            <FilterBuilder filters={filters} fields={columnNames} onChange={setFilters} />
            <Group grow>
              <Select label="Sort by" data={columnNames} value={sortField} onChange={setSortField} clearable />
              <Select
                label="Order"
                data={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
                value={sortOrder}
                onChange={(v) => setSortOrder(v ?? "asc")}
              />
            </Group>
            <MultiSelect label="Group by" data={columnNames} value={groupBy} onChange={setGroupBy} />
            <Group grow>
              <NumberInput
                label="Limit"
                value={limit}
                onChange={(v) => setLimit(Number(v) || 100)}
                min={1}
                max={10000}
              />
              <NumberInput label="Offset" value={offset} onChange={(v) => setOffset(Number(v) || 0)} min={0} />
            </Group>
          </Stack>
        </Paper>

        <Group>
          <Button leftSection={<Eye size={16} />} variant="light" onClick={handlePreview}>
            Preview SQL
          </Button>
          <Button leftSection={<Play size={16} />} onClick={handleExecute}>
            Execute
          </Button>
        </Group>

        {sql && (
          <Paper p="md" withBorder>
            <Text fw={500} mb="xs">
              Generated SQL
            </Text>
            <Code block>{sql}</Code>
            {params.length > 0 && (
              <>
                <Text fw={500} mt="sm" mb="xs">
                  Parameters
                </Text>
                <Code block>{JSON.stringify(params, null, 2)}</Code>
              </>
            )}
          </Paper>
        )}

        {results && (
          <Paper p="md" withBorder>
            <Text fw={500} mb="xs">
              Results ({results.length} rows)
            </Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  {results[0] && Object.keys(results[0]).map((k) => <Table.Th key={k}>{k}</Table.Th>)}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {results.map((row, i) => (
                  <Table.Tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <Table.Td key={j}>{typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </div>
  );
};
