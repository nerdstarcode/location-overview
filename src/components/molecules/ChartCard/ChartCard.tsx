import type { ReactNode } from 'react'
import clsx from 'clsx'

export interface ChartCardProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  /** Quando true, mostra `emptyMessage` no lugar do conteúdo. */
  isEmpty?: boolean
  emptyMessage?: string
  children: ReactNode
}

export function ChartCard({ title, description, actions, className, isEmpty = false, emptyMessage = 'Sem dados.', children }: ChartCardProps) {
  return (
    <section className={clsx('rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4', className)}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-h)]">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[var(--text)]">{description}</p>}
        </div>
        {actions}
      </div>
      {isEmpty ? <p className="p-6 text-center text-sm text-[var(--text)]">{emptyMessage}</p> : children}
    </section>
  )
}
