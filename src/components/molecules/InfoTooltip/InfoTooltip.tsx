import { useId } from 'react'
import { Info } from 'lucide-react'

export interface InfoTooltipProps {
  /** Nome do que está sendo explicado: vira "Como funciona: {label}" no botão. */
  label: string
  text: string
}

// Ícone ⓘ com tooltip (acima do ícone) ao passar o mouse ou focar pelo teclado; o texto
// também é a descrição acessível do botão.
export function InfoTooltip({ label, text }: InfoTooltipProps) {
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
