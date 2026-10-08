import { forwardRef, type InputHTMLAttributes } from 'react'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  indeterminate?: boolean
}

// Checkbox controlado com suporte a estado indeterminado (seleção parcial em tabelas).
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { indeterminate = false, className = '', ...props },
  forwardedRef,
) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = indeterminate
        if (typeof forwardedRef === 'function') forwardedRef(el)
        else if (forwardedRef) forwardedRef.current = el
      }}
      className={`h-4 w-4 cursor-pointer rounded border-[var(--border)] accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  )
})
