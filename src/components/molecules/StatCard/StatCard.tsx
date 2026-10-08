import { AlertTriangle } from 'lucide-react'

export interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  /** Quando informado, mostra um ícone de alerta ao lado do valor, com esta mensagem como descrição. */
  alert?: string
}

export function StatCard({ label, value, hint, alert }: StatCardProps) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
      <p className="text-xs font-medium text-[var(--text)]">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-[var(--text-h)]">
        {value}
        {alert && (
          <span role="img" aria-label={alert} title={alert} className="text-brand-action-warning">
            <AlertTriangle size={18} />
          </span>
        )}
      </p>
      {hint && <p className="mt-0.5 text-xs text-[var(--text)]">{hint}</p>}
      {alert && <p className="mt-0.5 text-xs font-medium text-[var(--text-h)]">{alert}</p>}
    </div>
  )
}
