import {
  ActionIcon,
  Button,
  Checkbox,
  Collapse,
  Group,
  Pagination,
  Paper,
  Table,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Filter, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BulkBar } from "./components/bulkbar.tsx";
import { FilterBuilder, type FilterRow } from "./components/filter.tsx";

type SchemaModel = {
  table: string;
  columns: { name: string; type: string; primary?: boolean }[];
  searchFields?: string[];
  filterFields?: string[];
  bulkActions?: string[];
  actions?: { name: string; label: string }[];
  readOnly?: boolean;
};

export type ModelListProps = {
  table: string;
  schema: SchemaModel;
  basePath: string;
  onNavigate: (path: string) => void;
};

type ListMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const ModelList = ({ table, schema, basePath, onNavigate }: ModelListProps) => {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: string; order: "asc" | "desc" } | null>(null);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [filterOpen, { toggle: toggleFilter }] = useDisclosure(false);

  const fetchData = useCallback(
    async (page = 1) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(meta.limit));
      if (search) params.set("search", search);
      if (sort) {
        params.set("sort", sort.field);
        params.set("order", sort.order);
      }
      for (const f of filters) {
        if (f.field && f.value) {
          params.set(`filter.${f.field}`, f.value);
        }
      }
      const res = await fetch(`${basePath}/api/${table}?${params}`);
      const body = await res.json();
      setData(body.data ?? []);
      setMeta(body.meta ?? { page: 1, limit: 20, total: 0, pages: 0 });
    },
    [basePath, table, search, sort, filters, meta.limit],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const toggleSort = useCallback((field: string) => {
    setSort((prev) => {
      if (prev?.field === field) {
        return prev.order === "asc" ? { field, order: "desc" } : null;
      }
      return { field, order: "asc" };
    });
  }, []);

  const toggleSelect = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((r) => r.id as string | number)));
    }
  }, [selectedIds.size, data]);

  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedIds);
    await fetch(`${basePath}/api/${table}/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    setSelectedIds(new Set());
    fetchData(meta.page);
  };

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<Record<string, unknown>>[] = [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={data.length > 0 && selectedIds.size === data.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < data.length}
            onChange={toggleAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id as string | number)}
            onChange={() => toggleSelect(row.original.id as string | number)}
          />
        ),
        size: 40,
      },
    ];
    for (const col of schema.columns) {
      cols.push({
        id: col.name,
        accessorKey: col.name,
        header: () => (
          <Group gap={4} style={{ cursor: "pointer" }} onClick={() => toggleSort(col.name)}>
            <span>{col.name}</span>
            {sort?.field === col.name && (sort.order === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
          </Group>
        ),
      });
    }
    return cols;
  }, [schema.columns, selectedIds, data.length, sort, toggleSort, toggleSelect, toggleAll]);

  const reactTable = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const filterFields = schema.filterFields ?? schema.columns.map((c) => c.name);

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={2} tt="capitalize">
          {table}
        </Title>
        {!schema.readOnly && (
          <Button leftSection={<Plus size={16} />} onClick={() => onNavigate(`create/${table}`)}>
            New
          </Button>
        )}
      </Group>

      <Group mb="md">
        <TextInput
          placeholder="Search..."
          leftSection={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <ActionIcon variant="light" onClick={toggleFilter}>
          <Filter size={16} />
        </ActionIcon>
      </Group>

      <Collapse in={filterOpen}>
        <Paper p="sm" mb="md" withBorder>
          <FilterBuilder filters={filters} fields={filterFields} onChange={setFilters} />
        </Paper>
      </Collapse>

      <BulkBar
        selectedCount={selectedIds.size}
        actions={schema.bulkActions ?? ["delete"]}
        customActions={schema.actions}
        onAction={handleBulkAction}
      />

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            {reactTable.getHeaderGroups().map((hg) => (
              <Table.Tr key={hg.id}>
                {hg.headers.map((header) => (
                  <Table.Th key={header.id} style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </Table.Th>
                ))}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {reactTable.getRowModel().rows.map((row) => (
              <Table.Tr
                key={row.id}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("input[type=checkbox]")) return;
                  onNavigate(`detail/${table}/${row.original.id}`);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {meta.pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={meta.pages} value={meta.page} onChange={(p) => fetchData(p)} />
        </Group>
      )}
    </div>
  );
};
