import { X } from 'lucide-react'

export interface ChipProps {
  label: string
  onRemove?: () => void
}

export function Chip({ label, onRemove }: ChipProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text-h)]">
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          aria-label={`Remover ${label}`}
          className="shrink-0 rounded-full p-0.5 text-[var(--text)] transition-colors hover:bg-[var(--accent)]/20 hover:text-[var(--text-h)]"
        >
          <X size={10} />
        </button>
      )}
    </span>
  )
}
