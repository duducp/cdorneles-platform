"use client";

import { Paper, Skeleton, Table } from "@mantine/core";

export interface TableSkeletonProps {
  /** Number of body rows to render. */
  rows?: number;
  /** Number of columns (header + body cells per row). */
  columns?: number;
  /** Accessible label announced while loading. */
  label?: string;
}

/**
 * Loading placeholder shaped like the `DataTable` panel: a bordered surface
 * with a header row of bars and body rows of bars, mirroring the real table's
 * layout so the swap does not jump. Use it for list pages; `LoadingScreen`
 * stays the route-level loader.
 */
export function TableSkeleton({ rows = 6, columns = 4, label = "Carregando" }: TableSkeletonProps) {
  const headerBars = Array.from({ length: columns }, (_, index) => index);
  const bodyRows = Array.from({ length: rows }, (_, index) => index);

  return (
    <Paper withBorder radius="md" role="status" aria-live="polite" aria-label={label} p={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            {headerBars.map((column) => (
              <Table.Th key={column}>
                <Skeleton h={10} w={column === 0 ? "60%" : "80%"} radius="sm" />
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bodyRows.map((row) => (
            <Table.Tr key={row}>
              {headerBars.map((column) => (
                <Table.Td key={column}>
                  <Skeleton h={12} w={`${70 + ((row + column) % 4) * 8}%`} radius="sm" />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
