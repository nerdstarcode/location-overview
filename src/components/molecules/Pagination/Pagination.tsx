import { ChevronLeft, ChevronRight } from 'lucide-react'

export const ROW_LIMIT_OPTIONS = [10, 25, 50, 100]

export interface PaginationProps {
  page: number
  pageSize: number
  totalPages?: number
  total?: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

// Barra de paginação reutilizável: seletor de itens por página à esquerda,
// Anterior / "Página X de Y" / Próxima à direita.
export function Pagination({
  page,
  pageSize,
  totalPages = 1,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ROW_LIMIT_OPTIONS,
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <select
            className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)]"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} por página
              </option>
            ))}
          </select>
        )}
        {typeof total === 'number' && <span className="text-xs text-[var(--text)]">{total} no total</span>}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Página anterior"
          className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
        <span className="text-xs text-[var(--text)]">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="Próxima página"
          className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Próxima
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
