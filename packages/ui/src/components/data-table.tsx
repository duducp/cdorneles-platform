"use client";

import { Paper, Table } from "@mantine/core";
import {
  useLegacyTable,
  getCoreRowModel,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { flexRender, type RowData } from "@tanstack/react-table";

export interface DataTableProps<TData extends RowData> {
  data: TData[];
  columns: LegacyColumnDef<TData, unknown>[];
  /**
   * Draws the component's own border. Keep it when the table sits directly on
   * the page; turn it off inside a `PageBody` panel, which already draws one —
   * otherwise the console panel shows a border within a border.
   */
  withBorder?: boolean;
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  withBorder = true,
}: DataTableProps<TData>) {
  const table = useLegacyTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Paper withBorder={withBorder} radius="md">
      <Table striped highlightOnHover>
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Table.Th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {table.getRowModel().rows.map((row) => (
            <Table.Tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <Table.Td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
