import { Group, Pagination, Table, TextInput } from "@mantine/core";
import {
  type ColumnDef,
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  flexRender,
  globalFilteringFeature,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns,
  sortFns,
});

export type ColumnConfig<T> = {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
};

export const TextColumn = <T extends RowData>(config: ColumnConfig<T>): ColumnDef<typeof features, T> => ({
  accessorKey: config.key,
  header: config.label,
  enableSorting: config.sortable ?? false,
  cell: config.render
    ? (info) => config.render!(info.getValue(), info.row.original)
    : (info) => String(info.getValue() ?? ""),
});

export const DateColumn = <T extends RowData>(config: ColumnConfig<T>): ColumnDef<typeof features, T> => ({
  accessorKey: config.key,
  header: config.label,
  enableSorting: config.sortable ?? false,
  cell: (info) => {
    const val = info.getValue();
    if (!val) return "";
    return new Date(val as string | number).toLocaleDateString();
  },
});

export const ActionColumn = <T extends RowData>(config: {
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}): ColumnDef<typeof features, T> => ({
  id: "actions",
  header: "Actions",
  cell: (info) => (
    <Group gap="xs">
      {config.onEdit && (
        <button type="button" onClick={() => config.onEdit!(info.row.original)}>
          Edit
        </button>
      )}
      {config.onDelete && (
        <button type="button" onClick={() => config.onDelete!(info.row.original)}>
          Delete
        </button>
      )}
    </Group>
  ),
});

export type TableConfig<T extends RowData> = {
  data: T[];
  columns: ColumnDef<typeof features, T>[];
  pagination?: boolean;
  search?: boolean;
  pageSize?: number;
};

export const createTable = <T extends RowData>(config: TableConfig<T>) => {
  return () => {
    const [globalFilter, setGlobalFilter] = React.useState("");

    const table = useTable({
      features,
      data: config.data,
      columns: config.columns,
      manualPagination: !config.pagination,
      manualFiltering: !config.search,
      state: { globalFilter },
      onGlobalFilterChange: setGlobalFilter,
      initialState: {
        pagination: { pageIndex: 0, pageSize: config.pageSize ?? 10 },
      },
    });

    return (
      <>
        {config.search && (
          <TextInput
            placeholder="Search..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.currentTarget.value)}
            mb="md"
          />
        )}
        <Table>
          <Table.Thead>
            {table.getHeaderGroups().map((hg) => (
              <Table.Tr key={hg.id}>
                {hg.headers.map((h) => (
                  <Table.Th
                    key={h.id}
                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    style={{ cursor: h.column.getCanSort() ? "pointer" : "default" }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? (
                      <ChevronUp size={14} style={{ verticalAlign: "middle", marginLeft: 4 }} />
                    ) : h.column.getIsSorted() === "desc" ? (
                      <ChevronDown size={14} style={{ verticalAlign: "middle", marginLeft: 4 }} />
                    ) : null}
                  </Table.Th>
                ))}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => (
              <Table.Tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {config.pagination && (
          <Pagination
            total={table.getPageCount()}
            value={table.state.pagination.pageIndex + 1}
            onChange={(p) => table.setPageIndex(p - 1)}
            mt="md"
          />
        )}
      </>
    );
  };
};
