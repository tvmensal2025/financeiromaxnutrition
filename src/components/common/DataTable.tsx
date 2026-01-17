import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { LucideIcon } from 'lucide-react';

/**
 * Column configuration for DataTable
 * @template T - The type of data in each row
 */
export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Header text to display */
  header: string;
  /** Property key or function to access cell value */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Optional custom renderer for the cell */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Optional CSS class for the column */
  className?: string;
}

/**
 * Empty state configuration for DataTable
 */
export interface DataTableEmptyState {
  /** Icon to display in empty state */
  icon?: LucideIcon;
  /** Title text for empty state */
  title: string;
  /** Description text for empty state */
  description?: string;
  /** Optional action button */
  action?: { label: string; onClick: () => void };
}

/**
 * Props for the DataTable component
 * @template T - The type of data in each row
 */
export interface DataTableProps<T> {
  /** Column configuration array */
  columns: Column<T>[];
  /** Data array to render */
  data: T[];
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Empty state configuration */
  emptyState?: DataTableEmptyState;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Property key or function to generate unique row keys */
  rowKey: keyof T | ((row: T) => string);
}

/**
 * A reusable data table component that renders tabular data with support for
 * loading states, empty states, custom renderers, and row click handling.
 * 
 * @template T - The type of data in each row
 * 
 * @example
 * ```tsx
 * const columns: Column<User>[] = [
 *   { key: 'name', header: 'Name', accessor: 'name' },
 *   { key: 'email', header: 'Email', accessor: 'email' },
 *   { 
 *     key: 'status', 
 *     header: 'Status', 
 *     accessor: 'status',
 *     render: (value) => <Badge>{value}</Badge>
 *   },
 * ];
 * 
 * <DataTable
 *   columns={columns}
 *   data={users}
 *   rowKey="id"
 *   isLoading={isLoading}
 *   emptyState={{ title: 'No users found', icon: Users }}
 *   onRowClick={(user) => navigate(`/users/${user.id}`)}
 * />
 * ```
 * 
 * Requirements: 5.3, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12
 */
export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyState,
  onRowClick,
  rowKey,
}: DataTableProps<T>) {
  // Show loading state when data is being fetched (Requirement 5.11)
  if (isLoading) {
    return <LoadingState message="Carregando..." />;
  }

  // Show empty state when data array is empty (Requirement 5.12)
  if (data.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  /**
   * Generates a unique key for each row
   * @param row - The row data
   * @param index - The row index (fallback)
   * @returns A unique string key
   */
  const getRowKey = (row: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    const keyValue = row[rowKey];
    return keyValue != null ? String(keyValue) : String(index);
  };

  /**
   * Gets the cell value for a column, applying accessor and optional renderer
   * @param row - The row data
   * @param column - The column configuration
   * @returns The rendered cell content
   */
  const getCellValue = (row: T, column: Column<T>): React.ReactNode => {
    // Get raw value using accessor (Requirement 5.7, 5.8)
    const value = typeof column.accessor === 'function'
      ? column.accessor(row)
      : row[column.accessor];
    
    // Apply custom renderer if provided (Requirement 5.10)
    if (column.render) {
      return column.render(value, row);
    }
    
    return value as React.ReactNode;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow
            key={getRowKey(row, index)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
          >
            {columns.map((column) => (
              <TableCell key={column.key} className={column.className}>
                {getCellValue(row, column)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
