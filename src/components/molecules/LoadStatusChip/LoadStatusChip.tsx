import clsx from 'clsx'
import { LOAD_STATUS_LABEL, type LoadStatus } from '../../../lib/personMetrics'
import { LOAD_STATUS_STYLE } from './loadStatusStyle'

export interface LoadStatusChipProps {
  /** null = sem alocação (sem previsto para comparar). */
  status: LoadStatus | null
  emptyLabel?: string
}

// Situação da carga em palavras, com ícone e cor: abaixo, no esperado, acima, na extensão ou sobrecarga.
export function LoadStatusChip({ status, emptyLabel = 'Sem alocação' }: LoadStatusChipProps) {
  if (!status) {
    return <span className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text)]">{emptyLabel}</span>
  }
  const style = LOAD_STATUS_STYLE[status]
  const Icon = style.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full bg-[var(--code-bg)] px-2 py-0.5 text-xs font-medium', style.text)}>
      <Icon size={12} aria-hidden="true" />
      {LOAD_STATUS_LABEL[status]}
    </span>
  )
}
