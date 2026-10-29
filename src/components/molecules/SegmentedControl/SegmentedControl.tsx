export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
}

// Botões lado a lado para alternar entre visões (mesmo visual do seletor PE/TP do Dashboard por Squad).
export function SegmentedControl<T extends string>({ options, value, onChange, 'aria-label': ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5 text-xs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded px-2 py-1 transition-colors ${
            value === option.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--code-bg)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
