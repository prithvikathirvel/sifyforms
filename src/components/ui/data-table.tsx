import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, rowIndex: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  ariaLabel: string;
  emptyState?: ReactNode;
  className?: string;
  tableClassName?: string;
  rowClassName?: string | ((row: T, rowIndex: number) => string);
}

/** Generic, responsive table shell for dense enterprise collections. */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  ariaLabel,
  emptyState,
  className,
  tableClassName,
  rowClassName,
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-visible rounded-xl border border-border/90 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.025)]', className)}>
      <div className="scrollbar-subtle w-full overflow-x-auto rounded-xl">
        <table aria-label={ariaLabel} className={cn('w-full border-collapse text-left text-[12px] text-ink-700', tableClassName)}>
          <thead className="bg-ink-50/75">
            <tr className="border-b border-border/80">
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn('h-10 whitespace-nowrap px-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground', column.headerClassName)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/65">
            {data.map((row, rowIndex) => (
              <tr
                key={getRowId(row)}
                className={cn(
                  'transition-colors hover:bg-ink-50/65',
                  typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : rowClassName
                )}
              >
                {columns.map((column) => (
                  <td key={column.id} className={cn('px-3.5 py-3 align-middle', column.cellClassName)}>
                    {column.cell(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="border-t border-border/70 px-4 py-10 text-center text-xs font-medium text-muted-foreground">
          {emptyState || 'No items to display.'}
        </div>
      )}
    </div>
  );
}

export default DataTable;
