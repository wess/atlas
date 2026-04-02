import { Group, Pagination, Table, TextInput } from "@mantine/core";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import React from "react";

export type ColumnConfig<T> = {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
};

export const TextColumn = <T,>(config: ColumnConfig<T>): ColumnDef<T> => ({
  accessorKey: config.key,
  header: config.label,
  enableSorting: config.sortable ?? false,
  cell: config.render
    ? (info) => config.render!(info.getValue(), info.row.original)
    : (info) => String(info.getValue() ?? ""),
});

export const DateColumn = <T,>(config: ColumnConfig<T>): ColumnDef<T> => ({
  accessorKey: config.key,
  header: config.label,
  enableSorting: config.sortable ?? false,
  cell: (info) => {
    const val = info.getValue();
    if (!val) return "";
    return new Date(val as string | number).toLocaleDateString();
  },
});

export const ActionColumn = <T,>(config: { onEdit?: (row: T) => void; onDelete?: (row: T) => void }): ColumnDef<T> => ({
  id: "actions",
  header: "Actions",
  cell: (info) => (
    <Group gap="xs">
      {config.onEdit && <button onClick={() => config.onEdit!(info.row.original)}>Edit</button>}
      {config.onDelete && <button onClick={() => config.onDelete!(info.row.original)}>Delete</button>}
    </Group>
  ),
});

export type TableConfig<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  pagination?: boolean;
  search?: boolean;
  pageSize?: number;
};

export const createTable = <T,>(config: TableConfig<T>) => {
  return () => {
    const [globalFilter, setGlobalFilter] = React.useState("");

    const table = useReactTable({
      data: config.data,
      columns: config.columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      ...(config.pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
      ...(config.search
        ? { getFilteredRowModel: getFilteredRowModel(), state: { globalFilter }, onGlobalFilterChange: setGlobalFilter }
        : {}),
      initialState: {
        pagination: { pageSize: config.pageSize ?? 10 },
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
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {config.pagination && (
          <Pagination
            total={table.getPageCount()}
            value={table.getState().pagination.pageIndex + 1}
            onChange={(p) => table.setPageIndex(p - 1)}
            mt="md"
          />
        )}
      </>
    );
  };
};
