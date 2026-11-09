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
import { Button, Group, Pagination, ScrollArea, Table, TextInput } from "../components/index.tsx";

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
        <Button size="xs" variant="subtle" onClick={() => config.onEdit!(info.row.original)}>
          Edit
        </Button>
      )}
      {config.onDelete && (
        <Button size="xs" variant="subtle" color="danger" onClick={() => config.onDelete!(info.row.original)}>
          Delete
        </Button>
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
        <ScrollArea>
          <Table>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id}>
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          className="atlas-table__sort"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === "asc" && <ChevronUp size={14} aria-label="Sorted ascending" />}
                          {h.column.getIsSorted() === "desc" && (
                            <ChevronDown size={14} aria-label="Sorted descending" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </ScrollArea>
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
