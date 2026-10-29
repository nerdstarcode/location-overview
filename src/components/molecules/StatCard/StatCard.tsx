import { AlertTriangle } from 'lucide-react'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'

export interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  /** Quando informado, mostra um ícone de alerta ao lado do valor, com esta mensagem como descrição. */
  alert?: string
  /** Explicação de como o valor é calculado: tooltip no ícone ⓘ ao lado do label. */
  info?: string
}

export function StatCard({ label, value, hint, alert, info }: StatCardProps) {
  return (
    // h-full: numa grade, todos os cards da linha ficam da mesma altura; o alerta vai para o rodapé.
    <div className="flex h-full min-w-0 flex-col rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
      <p className="flex items-center gap-1 text-xs font-medium text-[var(--text)]">
        {label}
        {info && <InfoTooltip label={label} text={info} />}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-2xl font-semibold tabular-nums break-words text-[var(--text-h)]">
        {value}
        {alert && (
          <span role="img" aria-label={alert} title={alert} className="text-brand-action-warning">
            <AlertTriangle size={18} />
          </span>
        )}
      </p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-[var(--text)]">{hint}</p>}
      {alert && (
        <p className="mt-auto pt-2">
          <span className="block rounded-r border-l-2 border-brand-action-warning bg-[var(--code-bg)] px-2 py-1 text-xs leading-snug text-[var(--text-h)]">
            {alert}
          </span>
        </p>
      )}
    </div>
  )
}
