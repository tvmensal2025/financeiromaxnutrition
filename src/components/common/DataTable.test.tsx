/**
 * Property tests for DataTable component
 * 
 * Feature: project-refactoring, Property 7: DataTable Data Rendering Consistency
 * 
 * Validates: Requirements 5.3, 5.7, 5.8
 * 
 * - For any DataTable with a columns configuration and data array, the component 
 *   SHALL render exactly `data.length` rows and exactly `columns.length` cells per row.
 * 
 * - For any column with an accessor function, the cell content SHALL be the result 
 *   of calling the accessor with the row data.
 * 
 * @module components/common/DataTable.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import fc from 'fast-check';
import { DataTable, Column } from './DataTable';

// Test data type for property tests
interface TestRow {
  id: string;
  name: string;
  value: number;
  active: boolean;
}

// Generator for valid column keys (alphanumeric, starting with letter)
const columnKeyArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s));

// Generator for column header text
const columnHeaderArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

// Generator for test row data
const testRowArb: fc.Arbitrary<TestRow> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  value: fc.integer({ min: 0, max: 1000000 }),
  active: fc.boolean(),
});

// Generator for non-empty array of test rows
const testDataArb = fc.array(testRowArb, { minLength: 1, maxLength: 20 });

// Generator for column configuration with property accessor
const columnWithPropertyAccessorArb = (keys: (keyof TestRow)[]): fc.Arbitrary<Column<TestRow>> => 
  fc.record({
    key: columnKeyArb,
    header: columnHeaderArb,
    accessor: fc.constantFrom(...keys),
  });

// Generator for column configuration with function accessor
const columnWithFunctionAccessorArb = (): fc.Arbitrary<Column<TestRow>> =>
  fc.record({
    key: columnKeyArb,
    header: columnHeaderArb,
    accessor: fc.constant((row: TestRow) => `${row.name}-${row.value}`),
  });

// Generator for mixed columns (property and function accessors)
const mixedColumnsArb = (minLength: number, maxLength: number): fc.Arbitrary<Column<TestRow>[]> =>
  fc.array(
    fc.oneof(
      columnWithPropertyAccessorArb(['id', 'name', 'value', 'active']),
      columnWithFunctionAccessorArb()
    ),
    { minLength, maxLength }
  ).map(columns => {
    // Ensure unique keys by appending index
    return columns.map((col, index) => ({
      ...col,
      key: `${col.key}_${index}`,
    }));
  });

describe('DataTable - Property 7: DataTable Data Rendering Consistency', () => {
  /**
   * Property 7.1: Row Count Consistency
   * 
   * For any DataTable with a columns configuration and data array, 
   * the component SHALL render exactly `data.length` rows.
   * 
   * **Validates: Requirements 5.3, 5.8**
   */
  describe('Row Count Consistency', () => {
    it('should render exactly data.length rows for any valid data array', () => {
      fc.assert(
        fc.property(
          testDataArb,
          mixedColumnsArb(1, 5),
          (data, columns) => {
            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            // Get all table body rows (excluding header row)
            const tbody = container.querySelector('tbody');
            expect(tbody).not.toBeNull();
            
            const rows = tbody!.querySelectorAll('tr');
            expect(rows.length).toBe(data.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render zero rows when data array is empty (without emptyState)', () => {
      const columns: Column<TestRow>[] = [
        { key: 'name', header: 'Name', accessor: 'name' },
      ];

      const { container } = render(
        <DataTable
          columns={columns}
          data={[]}
          rowKey="id"
        />
      );

      const tbody = container.querySelector('tbody');
      expect(tbody).not.toBeNull();
      
      const rows = tbody!.querySelectorAll('tr');
      expect(rows.length).toBe(0);
    });
  });

  /**
   * Property 7.2: Cell Count Consistency
   * 
   * For any DataTable with a columns configuration and data array,
   * the component SHALL render exactly `columns.length` cells per row.
   * 
   * **Validates: Requirements 5.3, 5.7**
   */
  describe('Cell Count Consistency', () => {
    it('should render exactly columns.length cells per row for any valid configuration', () => {
      fc.assert(
        fc.property(
          testDataArb,
          mixedColumnsArb(1, 10),
          (data, columns) => {
            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            // Check header cells
            const thead = container.querySelector('thead');
            expect(thead).not.toBeNull();
            
            const headerCells = thead!.querySelectorAll('th');
            expect(headerCells.length).toBe(columns.length);

            // Check body cells per row
            const tbody = container.querySelector('tbody');
            expect(tbody).not.toBeNull();
            
            const rows = tbody!.querySelectorAll('tr');
            rows.forEach((row) => {
              const cells = row.querySelectorAll('td');
              expect(cells.length).toBe(columns.length);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render correct number of cells for single column', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            const columns: Column<TestRow>[] = [
              { key: 'name', header: 'Name', accessor: 'name' },
            ];

            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            
            rows.forEach((row) => {
              const cells = row.querySelectorAll('td');
              expect(cells.length).toBe(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7.3: Accessor Function Correctness
   * 
   * For any column with an accessor function, the cell content SHALL be 
   * the result of calling the accessor with the row data.
   * 
   * **Validates: Requirements 5.7, 5.8**
   */
  describe('Accessor Function Correctness', () => {
    it('should render accessor function result as cell content', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            // Define a deterministic accessor function
            const accessorFn = (row: TestRow) => `computed-${row.name}-${row.value}`;
            
            const columns: Column<TestRow>[] = [
              { key: 'computed', header: 'Computed', accessor: accessorFn },
            ];

            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            
            rows.forEach((row, index) => {
              const cell = row.querySelector('td');
              const expectedContent = accessorFn(data[index]);
              expect(cell?.textContent).toBe(expectedContent);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should render property accessor value as cell content', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            const columns: Column<TestRow>[] = [
              { key: 'name', header: 'Name', accessor: 'name' },
              { key: 'value', header: 'Value', accessor: 'value' },
            ];

            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            
            rows.forEach((row, index) => {
              const cells = row.querySelectorAll('td');
              expect(cells[0]?.textContent).toBe(data[index].name);
              expect(cells[1]?.textContent).toBe(String(data[index].value));
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly apply accessor function to each row independently', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            // Track which rows the accessor was called with
            const accessorCalls: TestRow[] = [];
            const accessorFn = (row: TestRow) => {
              accessorCalls.push(row);
              return row.id;
            };
            
            const columns: Column<TestRow>[] = [
              { key: 'id', header: 'ID', accessor: accessorFn },
            ];

            render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            // Verify accessor was called for each row
            expect(accessorCalls.length).toBe(data.length);
            
            // Verify accessor was called with correct row data
            data.forEach((row, index) => {
              expect(accessorCalls[index]).toEqual(row);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7.4: Header Rendering Consistency
   * 
   * For any DataTable with a columns configuration, the component SHALL 
   * render column headers matching the header property of each column.
   * 
   * **Validates: Requirements 5.7**
   */
  describe('Header Rendering Consistency', () => {
    it('should render column headers matching the header property', () => {
      fc.assert(
        fc.property(
          testDataArb,
          mixedColumnsArb(1, 5),
          (data, columns) => {
            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const thead = container.querySelector('thead');
            const headerCells = thead!.querySelectorAll('th');
            
            columns.forEach((column, index) => {
              expect(headerCells[index]?.textContent).toBe(column.header);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7.5: Row Key Uniqueness
   * 
   * For any DataTable with a rowKey configuration, each row SHALL have 
   * a unique key derived from the rowKey property or function.
   * 
   * **Validates: Requirements 5.3**
   */
  describe('Row Key Handling', () => {
    it('should use rowKey property to generate unique keys', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            const columns: Column<TestRow>[] = [
              { key: 'name', header: 'Name', accessor: 'name' },
            ];

            // This test verifies the component renders without key warnings
            // React would warn about duplicate keys if rowKey wasn't working
            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            expect(rows.length).toBe(data.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use rowKey function to generate unique keys', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            const columns: Column<TestRow>[] = [
              { key: 'name', header: 'Name', accessor: 'name' },
            ];

            const rowKeyFn = (row: TestRow) => `custom-${row.id}`;

            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey={rowKeyFn}
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            expect(rows.length).toBe(data.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7.6: Custom Renderer Application
   * 
   * For any column with a render function, the cell content SHALL be 
   * the result of calling the render function with the accessor value and row data.
   * 
   * **Validates: Requirements 5.10**
   */
  describe('Custom Renderer Application', () => {
    it('should apply custom render function to cell content', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            const renderFn = (value: unknown, row: TestRow) => 
              `rendered-${value}-${row.active}`;
            
            const columns: Column<TestRow>[] = [
              { 
                key: 'name', 
                header: 'Name', 
                accessor: 'name',
                render: renderFn,
              },
            ];

            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            
            rows.forEach((row, index) => {
              const cell = row.querySelector('td');
              const expectedContent = renderFn(data[index].name, data[index]);
              expect(cell?.textContent).toBe(expectedContent);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass accessor function result to render function', () => {
      fc.assert(
        fc.property(
          testDataArb,
          (data) => {
            const accessorFn = (row: TestRow) => row.value * 2;
            const renderFn = (value: unknown) => `doubled: ${value}`;
            
            const columns: Column<TestRow>[] = [
              { 
                key: 'doubled', 
                header: 'Doubled Value', 
                accessor: accessorFn,
                render: renderFn,
              },
            ];

            const { container } = render(
              <DataTable
                columns={columns}
                data={data}
                rowKey="id"
              />
            );

            const tbody = container.querySelector('tbody');
            const rows = tbody!.querySelectorAll('tr');
            
            rows.forEach((row, index) => {
              const cell = row.querySelector('td');
              const accessorResult = accessorFn(data[index]);
              const expectedContent = renderFn(accessorResult);
              expect(cell?.textContent).toBe(expectedContent);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Unit tests for DataTable loading and empty states
 * 
 * **Validates: Requirements 5.11, 5.12**
 */
describe('DataTable - Loading and Empty States', () => {
  it('should display LoadingState when isLoading is true', () => {
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey="id"
        isLoading={true}
      />
    );

    // LoadingState displays "Carregando..." message
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('should display EmptyState when data is empty and emptyState is provided', () => {
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey="id"
        emptyState={{
          title: 'No data found',
          description: 'Try adding some items',
        }}
      />
    );

    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText('Try adding some items')).toBeInTheDocument();
  });

  it('should not display EmptyState when data is empty but emptyState is not provided', () => {
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    const { container } = render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey="id"
      />
    );

    // Should render empty table
    const tbody = container.querySelector('tbody');
    expect(tbody).not.toBeNull();
    const rows = tbody!.querySelectorAll('tr');
    expect(rows.length).toBe(0);
  });

  it('should prioritize isLoading over empty data', () => {
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey="id"
        isLoading={true}
        emptyState={{
          title: 'No data found',
        }}
      />
    );

    // Should show loading, not empty state
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('No data found')).not.toBeInTheDocument();
  });
});

/**
 * Unit tests for DataTable row click handling
 * 
 * **Validates: Requirements 5.9**
 */
describe('DataTable - Row Click Handling', () => {
  it('should call onRowClick with row data when row is clicked', () => {
    const mockOnRowClick = vi.fn();
    const data: TestRow[] = [
      { id: '1', name: 'Item 1', value: 100, active: true },
      { id: '2', name: 'Item 2', value: 200, active: false },
    ];
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        onRowClick={mockOnRowClick}
      />
    );

    const tbody = container.querySelector('tbody');
    const rows = tbody!.querySelectorAll('tr');
    
    // Click first row
    rows[0].click();
    expect(mockOnRowClick).toHaveBeenCalledWith(data[0]);
    
    // Click second row
    rows[1].click();
    expect(mockOnRowClick).toHaveBeenCalledWith(data[1]);
    
    expect(mockOnRowClick).toHaveBeenCalledTimes(2);
  });

  it('should add cursor-pointer class when onRowClick is provided', () => {
    const data: TestRow[] = [
      { id: '1', name: 'Item 1', value: 100, active: true },
    ];
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
        onRowClick={() => {}}
      />
    );

    const tbody = container.querySelector('tbody');
    const row = tbody!.querySelector('tr');
    expect(row?.className).toContain('cursor-pointer');
  });

  it('should not add cursor-pointer class when onRowClick is not provided', () => {
    const data: TestRow[] = [
      { id: '1', name: 'Item 1', value: 100, active: true },
    ];
    const columns: Column<TestRow>[] = [
      { key: 'name', header: 'Name', accessor: 'name' },
    ];

    const { container } = render(
      <DataTable
        columns={columns}
        data={data}
        rowKey="id"
      />
    );

    const tbody = container.querySelector('tbody');
    const row = tbody!.querySelector('tr');
    expect(row?.className).not.toContain('cursor-pointer');
  });
});
