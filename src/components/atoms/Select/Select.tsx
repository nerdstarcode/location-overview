import { forwardRef, type SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]
  placeholder?: string
}

// Select nativo estilizado no mesmo padrão de Input.tsx (outlined).
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className = '', ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      // bg/color explícitos (não transparent) porque o painel do dropdown nativo
      // segue o background do próprio <select>/<option>, não o da página — com
      // bg-transparent ele cai no branco padrão do navegador no tema escuro.
      className={`h-14 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-base text-[var(--text-h)] outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {placeholder && (
        <option value="" disabled className="bg-[var(--bg-elevated)] text-[var(--text-h)]">
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-[var(--bg-elevated)] text-[var(--text-h)]">
          {option.label}
        </option>
      ))}
    </select>
  )
})
