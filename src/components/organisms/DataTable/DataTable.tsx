import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type TableMeta,
} from '@tanstack/react-table'
import clsx from 'clsx'
import { Checkbox } from '../../atoms/Checkbox/Checkbox'

// Metadados de coluna aceitos via `columnDef.meta`: alinhamento, formatação
// numérica e fixação (sticky) a partir da esquerda ou da direita.
export interface DataTableColumnMeta {
  align?: 'left' | 'right'
  /** Alinhamento do título no cabeçalho, quando diferente de `align` (que também vale para as células). */
  headerAlign?: 'left' | 'right'
  numeric?: boolean
  sticky?: true | 'left' | 'right'
  minWidth?: number
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> extends DataTableColumnMeta {}
}

const SELECT_COLUMN_ID = '__select'

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  emptyMessage?: string
  onRowClick?: (row: T) => void
  footer?: Record<string, ReactNode>
  selectable?: boolean
  getRowId?: (row: T) => string
  selectedIds?: Set<string>
  onToggleRow?: (row: T) => void
  onTogglePage?: (rows: T[]) => void
  rowSelectionAriaLabel?: (row: T) => string
  meta?: TableMeta<T>
  /** Classe extra por linha (ex.: `opacity-50` para itens ocultos). */
  getRowClassName?: (row: T) => string | undefined
}

// Réplica, no padrão deste projeto (tokens de tema + TypeScript), da DataTable
// do portal_renovacoes: ordenação por coluna, seleção por checkbox e colunas
// fixas (sticky) — sem os recursos de loading/skeleton daquele projeto.
export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'Sem dados.',
  onRowClick,
  footer,
  selectable = false,
  getRowId = (row) => String((row as { id?: unknown }).id),
  selectedIds,
  onToggleRow,
  onTogglePage,
  rowSelectionAriaLabel = (row) => `Selecionar ${getRowId(row)}`,
  meta,
  getRowClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta,
  })

  const pageRowIds = selectable ? table.getRowModel().rows.map((r) => getRowId(r.original)) : []
  const pageAllSelected = selectable && pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds?.has(id))
  const pageSomeSelected = selectable && !pageAllSelected && pageRowIds.some((id) => selectedIds?.has(id))

  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({})
  const [stickyOffsets, setStickyOffsets] = useState<Record<string, { side: 'left' | 'right'; px: number }>>({})

  const leftStickyDataIds = useMemo(
    () =>
      table
        .getAllLeafColumns()
        .filter((c) => c.columnDef.meta?.sticky === true || c.columnDef.meta?.sticky === 'left')
        .map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns],
  )
  const rightStickyIds = useMemo(
    () => table.getAllLeafColumns().filter((c) => c.columnDef.meta?.sticky === 'right').map((c) => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns],
  )
  const hasSticky = leftStickyDataIds.length > 0 || rightStickyIds.length > 0
  const leftStickyIds = selectable && hasSticky ? [SELECT_COLUMN_ID, ...leftStickyDataIds] : leftStickyDataIds
  const lastLeftStickyId = leftStickyIds[leftStickyIds.length - 1]
  const firstRightStickyId = rightStickyIds[0]

  useLayoutEffect(() => {
    if (!hasSticky) return
    const next: typeof stickyOffsets = {}
    let leftOffset = 0
    for (const id of leftStickyIds) {
      next[id] = { side: 'left', px: leftOffset }
      const el = headerRefs.current[id]
      if (el) leftOffset += el.offsetWidth
    }
    let rightOffset = 0
    for (let i = rightStickyIds.length - 1; i >= 0; i--) {
      const id = rightStickyIds[i]
      next[id] = { side: 'right', px: rightOffset }
      const el = headerRefs.current[id]
      if (el) rightOffset += el.offsetWidth
    }
    setStickyOffsets(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSticky, leftStickyIds.join('|'), rightStickyIds.join('|'), data])

  function stickyStyle(columnId: string) {
    const entry = stickyOffsets[columnId]
    if (!entry) return undefined
    return { position: 'sticky' as const, [entry.side]: entry.px, zIndex: 10 }
  }

  function stickyHeaderStyle(columnId: string) {
    const style = stickyStyle(columnId)
    return style ? { ...style, zIndex: 20 } : undefined
  }

  function stickyClass(columnId: string, { header = false, rowBg }: { header?: boolean; rowBg?: string } = {}) {
    const entry = stickyOffsets[columnId]
    if (!entry) return null
    return clsx(
      header ? 'bg-[var(--accent)]' : (rowBg ?? 'bg-[var(--bg-elevated)]'),
      entry.side === 'left' && columnId === lastLeftStickyId && 'shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]',
      entry.side === 'right' && columnId === firstRightStickyId && 'shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]',
    )
  }

  if (!data.length) {
    return (
      <div className="rounded-md border border-[var(--border)] p-10 text-center">
        <p className="text-sm text-[var(--text)]">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-md border border-[var(--border)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {selectable && (
                  <th
                    ref={(el) => {
                      headerRefs.current[SELECT_COLUMN_ID] = el
                    }}
                    className={clsx(
                      'w-10 border border-[var(--accent-border)] bg-[var(--accent)] px-3 py-2',
                      stickyClass(SELECT_COLUMN_ID, { header: true }),
                    )}
                    style={stickyHeaderStyle(SELECT_COLUMN_ID)}
                  >
                    <Checkbox
                      checked={pageAllSelected}
                      indeterminate={pageSomeSelected}
                      onChange={() => onTogglePage?.(table.getRowModel().rows.map((r) => r.original))}
                      aria-label="Selecionar todos nesta página"
                    />
                  </th>
                )}
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta ?? {}
                  const alignRight = (meta.headerAlign ?? meta.align) === 'right'
                  return (
                    <th
                      key={header.id}
                      ref={(el) => {
                        headerRefs.current[header.column.id] = el
                      }}
                      className={clsx(
                        'whitespace-nowrap border border-[var(--accent-border)] bg-[var(--accent)] px-3 py-2 font-semibold text-white select-none',
                        alignRight ? 'text-right' : 'text-left',
                        header.column.getCanSort() && 'cursor-pointer',
                        stickyClass(header.column.id, { header: true }),
                      )}
                      style={{ ...stickyHeaderStyle(header.column.id), minWidth: meta.minWidth }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className={clsx('flex items-center gap-1', alignRight && 'justify-end')}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && ' ↑'}
                        {header.column.getIsSorted() === 'desc' && ' ↓'}
                      </span>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => {
              const rowBg = index % 2 === 1 ? 'bg-[var(--code-bg)]' : 'bg-[var(--bg-elevated)]'
              return (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={clsx(
                    'transition-colors duration-100',
                    onRowClick && 'cursor-pointer',
                    rowBg,
                    getRowClassName?.(row.original),
                  )}
                >
                  {selectable && (
                    <td
                      className={clsx(
                        'border border-[var(--border)] px-3 py-1.5',
                        stickyClass(SELECT_COLUMN_ID, { rowBg }),
                      )}
                      style={stickyStyle(SELECT_COLUMN_ID)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={!!selectedIds?.has(getRowId(row.original))}
                        onChange={() => onToggleRow?.(row.original)}
                        aria-label={rowSelectionAriaLabel(row.original)}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta ?? {}
                    return (
                      <td
                        key={cell.id}
                        className={clsx(
                          'whitespace-nowrap border border-[var(--border)] px-3 py-1.5 text-[var(--text-h)]',
                          meta.align === 'right' && 'text-right',
                          meta.numeric && 'font-mono',
                          stickyClass(cell.column.id, { rowBg }),
                        )}
                        style={{ ...stickyStyle(cell.column.id), minWidth: meta.minWidth }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] bg-[var(--code-bg)]">
                {selectable && (
                  <td className="border border-[var(--border)] px-3 py-1.5" />
                )}
                {table.getAllLeafColumns().map((column) => {
                  const value = footer[column.id]
                  const meta = column.columnDef.meta ?? {}
                  return (
                    <td
                      key={column.id}
                      className={clsx(
                        'whitespace-nowrap border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-h)]',
                        meta.align === 'right' && 'text-right',
                        meta.numeric && 'font-mono',
                      )}
                    >
                      {value ?? ''}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
