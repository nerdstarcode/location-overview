import type { ReactNode } from 'react'
import { AlertTriangle, LoaderCircle, RotateCw } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'

export interface RequestStateProps {
  loading?: boolean
  error?: Error | null
  /** true quando a requisição terminou sem dados — mostra `emptyMessage`. */
  empty?: boolean
  emptyMessage?: string
  loadingMessage?: string
  onRetry?: () => void
  children?: ReactNode
}

/** Carregando / erro (com "Tentar de novo") / vazio / conteúdo de um bloco que depende de uma requisição. */
export function RequestState({
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'Nenhum dado encontrado.',
  loadingMessage = 'Carregando…',
  onRetry,
  children,
}: RequestStateProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-md border border-brand-action-danger/50 bg-brand-action-danger/10 p-4 text-sm text-[var(--text-h)]"
      >
        <AlertTriangle size={16} className="shrink-0 text-brand-action-danger" />
        <span className="min-w-0 flex-1">{error.message}</span>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw size={12} /> Tentar de novo
          </Button>
        )}
      </div>
    )
  }

  if (loading && empty) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-[var(--text)]" aria-live="polite">
        <LoaderCircle size={16} className="animate-spin" /> {loadingMessage}
      </div>
    )
  }

  if (empty) {
    return (
      <div className="rounded-md border border-[var(--border)] p-6 text-center text-sm text-[var(--text)]">{emptyMessage}</div>
    )
  }

  return <>{children}</>
}
