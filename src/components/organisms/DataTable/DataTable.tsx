import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type RowData,
  type SortingState,
  type TableMeta,
  type Updater,
} from '@tanstack/react-table'
import clsx from 'clsx'
import { Checkbox } from '../../atoms/Checkbox/Checkbox'
import { Pagination, ROW_LIMIT_OPTIONS } from '../../molecules/Pagination/Pagination'
import { SearchInput } from '../../molecules/SearchInput/SearchInput'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { matchesSearch, splitSearchTerms } from '../../../lib/tableSearch'

// Metadados de coluna aceitos via `columnDef.meta`: alinhamento, formatação
// numérica, fixação (sticky) a partir da esquerda ou da direita e texto de busca.
export interface DataTableColumnMeta<TData extends RowData = unknown> {
  align?: 'left' | 'right'
  /** Alinhamento do título no cabeçalho, quando diferente de `align` (que também vale para as células). */
  headerAlign?: 'left' | 'right'
  numeric?: boolean
  sticky?: true | 'left' | 'right'
  minWidth?: number
  /**
   * Texto que a busca considera para a coluna, quando o exibido difere do valor
   * do accessor (datas formatadas, nomes resolvidos, colunas só com `cell`).
   * Colunas sem accessor e sem `searchValue` (ex.: ações) ficam fora da busca.
   */
  searchValue?: (row: TData, tableMeta: TableMeta<TData> | undefined) => string
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> extends DataTableColumnMeta<TData> {}
}

const SELECT_COLUMN_ID = '__select'
const SEARCH_DEBOUNCE_MS = 250

function columnSearchText<T>(column: ColumnDef<T, unknown>, row: T, index: number, tableMeta: TableMeta<T> | undefined) {
  if (column.meta?.searchValue) return column.meta.searchValue(row, tableMeta)
  if ('accessorFn' in column && column.accessorFn) return String(column.accessorFn(row, index) ?? '')
  if ('accessorKey' in column && column.accessorKey) return String(row[column.accessorKey as keyof T] ?? '')
  return null
}

function rowSearchTexts<T>(columns: ColumnDef<T, unknown>[], row: T, index: number, tableMeta: TableMeta<T> | undefined) {
  return columns.map((column) => columnSearchText(column, row, index, tableMeta)).filter((text) => text !== null)
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  emptyMessage?: string
  onRowClick?: (row: T) => void
  selectable?: boolean
  getRowId?: (row: T) => string
  selectedIds?: Set<string>
  onToggleRow?: (row: T) => void
  onTogglePage?: (rows: T[]) => void
  rowSelectionAriaLabel?: (row: T) => string
  meta?: TableMeta<T>
  /** Classe extra por linha (ex.: `opacity-50` para itens ocultos). */
  getRowClassName?: (row: T) => string | undefined
  /** Opções de itens por página; a primeira é o tamanho inicial. */
  pageSizeOptions?: number[]
  searchPlaceholder?: string
  /** Controles extras ao lado da busca (ex.: filtros MultiSelect do componente pai). */
  toolbar?: ReactNode
  /**
   * Muda quando o pai altera filtros externos: volta para a página 1. Mudanças em
   * `data` sem mudança desta chave (edições) mantêm a página atual.
   */
  pageResetKey?: string
}

// Réplica, no padrão deste projeto (tokens de tema + TypeScript), da DataTable
// do portal_renovacoes: busca, ordenação e paginação sobre todo o conjunto,
// seleção por checkbox e colunas fixas (sticky) — sem loading/skeleton.
export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'Sem dados.',
  onRowClick,
  selectable = false,
  getRowId = (row) => String((row as { id?: unknown }).id),
  selectedIds,
  onToggleRow,
  onTogglePage,
  rowSelectionAriaLabel = (row) => `Selecionar ${getRowId(row)}`,
  meta,
  getRowClassName,
  pageSizeOptions = ROW_LIMIT_OPTIONS,
  searchPlaceholder,
  toolbar,
  pageResetKey = '',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: pageSizeOptions[0] })

  const searchTerms = useMemo(() => splitSearchTerms(debouncedSearch), [debouncedSearch])
  const filteredData = useMemo(
    () =>
      searchTerms.length === 0
        ? data
        : data.filter((row, index) => matchesSearch(rowSearchTexts(columns, row, index, meta), searchTerms)),
    [data, columns, meta, searchTerms],
  )

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pagination.pageSize))

  // Volta para a página 1 quando a busca ou os filtros externos mudam e recua
  // quando a página atual deixa de existir — ajuste de estado durante a
  // renderização (padrão recomendado pelo React) em vez de um efeito com setState.
  const resetKey = `${debouncedSearch}\u0000${pageResetKey}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    if (pagination.pageIndex !== 0) setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  } else if (pagination.pageIndex >= pageCount) {
    setPagination((prev) => ({ ...prev, pageIndex: pageCount - 1 }))
  }

  function handleSortingChange(updater: Updater<SortingState>) {
    setSorting(updater)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, pagination },
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta,
  })

  const pageRows = table.getRowModel().rows
  const pageRowIds = selectable ? pageRows.map((r) => getRowId(r.original)) : []
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
  }, [hasSticky, leftStickyIds.join('|'), rightStickyIds.join('|'), filteredData, pagination])

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

  // Sem dados de origem não há o que buscar nem paginar. Com `toolbar` ou busca
  // ativa, os controles continuam visíveis para o usuário poder desfazer o filtro.
  const showControls = data.length > 0 || toolbar != null || search !== ''
  if (!showControls) {
    return <MessageBox>{emptyMessage}</MessageBox>
  }

  const trimmedSearch = debouncedSearch.trim()

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} />
        {toolbar}
      </div>

      {filteredData.length === 0 ? (
        <MessageBox>{trimmedSearch ? `Nenhum resultado para “${trimmedSearch}”.` : 'Nenhum resultado.'}</MessageBox>
      ) : (
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
                          onChange={() => onTogglePage?.(pageRows.map((r) => r.original))}
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
                {pageRows.map((row, index) => {
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
            </table>
          </div>
        </div>
      )}

      <Pagination
        page={pagination.pageIndex + 1}
        pageSize={pagination.pageSize}
        totalPages={pageCount}
        total={filteredData.length}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
        onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
        pageSizeOptions={pageSizeOptions}
      />
    </div>
  )
}

function MessageBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-10 text-center">
      <p className="text-sm text-[var(--text)]">{children}</p>
    </div>
  )
}
