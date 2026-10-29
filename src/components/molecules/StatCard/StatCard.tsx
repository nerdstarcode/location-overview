import { useId } from 'react'
import { AlertTriangle, Info } from 'lucide-react'

export interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  /** Quando informado, mostra um ícone de alerta ao lado do valor, com esta mensagem como descrição. */
  alert?: string
  /** Explicação de como o valor é calculado: tooltip no ícone ⓘ ao lado do label. */
  info?: string
}

function InfoTooltip({ label, text }: { label: string; text: string }) {
  const tooltipId = useId()
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Como funciona: ${label}`}
        aria-describedby={tooltipId}
        className="rounded-full text-[var(--text)] transition-colors hover:text-[var(--text-h)] focus-visible:text-[var(--text-h)] focus-visible:outline-none"
      >
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-1 w-64 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-xs font-normal leading-snug text-[var(--text-h)] opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  )
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
