import { Link } from 'react-router-dom'
import { ArrowLeft, DatabaseZap, RotateCw } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { EditableCell } from '../DataTable/EditableCell'
import { formatDateBR } from '../../../lib/dates'

export interface SprintHeaderProps {
  title: string
  startDate: string | null | undefined
  finishDate: string | null | undefined
  /** Dias úteis do calendário do Azure (descontando days off) — só informativo. */
  workingDaysCount: number
  /** Dias válidos da sprint na base local, usados no cálculo de capacity/max. */
  validDays: number
  onValidDaysChange: (days: number) => void
  backHref: string
  backLabel: string
  loading: boolean
  canSave: boolean
  onRefresh: () => void
  onSave: () => void
}

export function SprintHeader({
  title,
  startDate,
  finishDate,
  workingDaysCount,
  validDays,
  onValidDaysChange,
  backHref,
  backLabel,
  loading,
  canSave,
  onRefresh,
  onSave,
}: SprintHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-[var(--text)] hover:text-[var(--text-h)]">
          <ArrowLeft size={14} /> {backLabel}
        </Link>
        <h2 className="text-lg font-semibold text-[var(--text-h)]">{title}</h2>
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-[var(--text)]">
          <span>
            {formatDateBR(startDate)} – {formatDateBR(finishDate)} · {workingDaysCount} dia(s) útil(eis) no Azure ·
          </span>
          <label className="flex items-center gap-1" title="Base de cálculo de capacity/max da alocação (padrão 10).">
            Dias válidos:
            <span className="w-14 rounded border border-[var(--border)] text-[var(--text-h)]">
              <EditableCell
                value={String(validDays)}
                type="number"
                onCommit={(value) => onValidDaysChange(Number(value.replace(',', '.')))}
              />
            </span>
          </label>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onRefresh} disabled={loading}>
          <RotateCw size={14} className={loading ? 'animate-spin' : undefined} /> Buscar novamente
        </Button>
        <Button type="button" onClick={onSave} disabled={loading || !canSave}>
          <DatabaseZap size={14} /> Atualizar base
        </Button>
      </div>
    </div>
  )
}
