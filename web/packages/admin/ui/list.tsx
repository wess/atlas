import {
  ActionIcon,
  Button,
  Checkbox,
  Collapse,
  Group,
  Pagination,
  Paper,
  ScrollArea,
  Table,
  TextInput,
  Title,
} from "@atlas/ui/components";
import { navigate, useDisclosure, useLocation } from "@atlas/ui/headless";
import { type ColumnDef, columnSizingFeature, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Filter, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "./api.ts";
import { BulkBar } from "./components/bulkbar.tsx";
import { FilterBuilder, type FilterRow } from "./components/filter.tsx";
import { paths } from "./paths.ts";

const features = tableFeatures({ columnSizingFeature });

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

const filtersFrom = (query: URLSearchParams): FilterRow[] =>
  [...query.entries()]
    .filter(([key, value]) => key.startsWith("filter.") && value)
    .map(([key, value]) => ({ field: key.slice("filter.".length), op: "eq", value }));

export const ModelList = ({ table, schema, basePath, onNavigate }: ModelListProps) => {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ page: 1, limit: 20, total: 0, pages: 0 });
  // the url owns everything worth returning to, so reload and back land on the same rows
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const page = Number(query.get("page")) || 1;
  const search = query.get("search") ?? "";
  const sortField = query.get("sort");
  const sort = sortField ? { field: sortField, order: query.get("order") === "desc" ? "desc" : "asc" } : null;
  const urlFilters = filtersFrom(query);
  const [filters, setFilters] = useState<FilterRow[]>(urlFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [filterOpen, { toggle: toggleFilter }] = useDisclosure(urlFilters.length > 0);

  const update = useCallback(
    (patch: Record<string, string | null>, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(query);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const text = next.toString();
      navigate(text ? `${location.pathname}?${text}` : location.pathname, options);
    },
    [query, location.pathname],
  );

  const changeFilters = (rows: FilterRow[]) => {
    setFilters(rows);
    const next = new URLSearchParams(query);
    for (const key of [...next.keys()]) if (key.startsWith("filter.")) next.delete(key);
    for (const row of rows) if (row.field && row.value) next.set(`filter.${row.field}`, row.value);
    next.delete("page");
    const text = next.toString();
    navigate(text ? `${location.pathname}?${text}` : location.pathname, { replace: true });
  };

  // back and forward change the url underneath the draft rows; half-typed rows have no url form to compare
  const urlFilterKey = JSON.stringify(urlFilters);
  useEffect(() => {
    setFilters((rows) => {
      const complete = rows.filter((row) => row.field && row.value).map((row) => ({ ...row, op: "eq" }));
      return JSON.stringify(complete) === urlFilterKey ? rows : JSON.parse(urlFilterKey);
    });
  }, [urlFilterKey]);

  const load = useCallback(async () => {
    const params = new URLSearchParams(location.search);
    params.set("page", String(page));
    params.set("limit", String(meta.limit));
    const res = await adminFetch(`${basePath}/api/${table}?${params}`);
    const body = await res.json();
    setData(body.data ?? []);
    setMeta(body.meta ?? { page: 1, limit: 20, total: 0, pages: 0 });
  }, [basePath, table, location.search, page, meta.limit]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = useCallback(
    (field: string) => {
      const direction = sort?.field === field ? sort.order : null;
      if (direction === "desc") update({ sort: null, order: null, page: null });
      else update({ sort: field, order: direction === "asc" ? "desc" : "asc", page: null });
    },
    [sort?.field, sort?.order, update],
  );

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
    await adminFetch(`${basePath}/api/${table}/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ids }),
    });
    setSelectedIds(new Set());
    load();
  };

  const columns = useMemo<ColumnDef<typeof features, Record<string, unknown>>[]>(() => {
    const cols: ColumnDef<typeof features, Record<string, unknown>>[] = [
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
          <button type="button" className="atlas-table__sort" onClick={() => toggleSort(col.name)}>
            {col.name}
            {sort?.field === col.name &&
              (sort.order === "asc" ? (
                <ArrowUp size={14} aria-label="Sorted ascending" />
              ) : (
                <ArrowDown size={14} aria-label="Sorted descending" />
              ))}
          </button>
        ),
      });
    }
    return cols;
  }, [schema.columns, selectedIds, data.length, sort?.field, sort?.order, toggleSort, toggleSelect, toggleAll]);

  const reactTable = useTable({
    features,
    data,
    columns,
  });

  const filterFields = schema.filterFields ?? schema.columns.map((c) => c.name);

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={2} tt="capitalize">
          {table}
        </Title>
        {!schema.readOnly && (
          <Button leftSection={<Plus size={16} />} onClick={() => onNavigate(paths.create(table))}>
            New
          </Button>
        )}
      </Group>

      <Group mb="md">
        <TextInput
          placeholder="Search..."
          leftSection={<Search size={16} />}
          value={search}
          onChange={(e) => update({ search: e.currentTarget.value, page: null }, { replace: true })}
          flex={1}
        />
        <ActionIcon aria-label="Toggle filters" aria-expanded={filterOpen} variant="light" onClick={toggleFilter}>
          <Filter size={16} />
        </ActionIcon>
      </Group>

      <Collapse expanded={filterOpen}>
        <Paper p="sm" mb="md" withBorder>
          <FilterBuilder filters={filters} fields={filterFields} onChange={changeFilters} />
        </Paper>
      </Collapse>

      <BulkBar
        selectedCount={selectedIds.size}
        actions={schema.bulkActions ?? ["delete"]}
        customActions={schema.actions}
        onAction={handleBulkAction}
      />

      <Paper withBorder>
        <ScrollArea>
          <Table striped highlightOnHover>
            <thead>
              {reactTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {reactTable.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget)
                      onNavigate(paths.detail(table, row.original.id as string | number));
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("input[type=checkbox]")) return;
                    onNavigate(paths.detail(table, row.original.id as string | number));
                  }}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {meta.pages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={meta.pages} value={meta.page} onChange={(p) => update({ page: String(p) })} />
        </Group>
      )}
    </div>
  );
};
