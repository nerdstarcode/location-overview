import { forwardRef, type InputHTMLAttributes } from 'react'

export type TextFieldVariant = 'outlined' | 'filled' | 'standard'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  variant?: TextFieldVariant
}

const baseClasses =
  'peer h-14 w-full text-base text-[var(--text-h)] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50'

// Border stays the same width across states (only its color changes) so
// focusing/erroring never shifts layout — MUI achieves the same result with
// an extra pseudo-element, this keeps it to a single element.
const variantClasses: Record<TextFieldVariant, string> = {
  outlined: 'rounded-md border bg-transparent px-3 py-1.5',
  filled: 'rounded-t-md border-0 border-b-2 bg-[var(--code-bg)] px-3 pt-5 pb-1.5',
  standard: 'border-0 border-b-2 bg-transparent px-0 pt-4 pb-1.5',
}

const borderColorClasses = {
  default: 'border-[var(--border)] focus:border-blue-500',
  error: 'border-brand-action-danger focus:border-brand-action-danger',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, variant = 'outlined', placeholder = ' ', className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      placeholder={placeholder}
      className={`${baseClasses} ${variantClasses[variant]} ${
        error ? borderColorClasses.error : borderColorClasses.default
      } ${className}`}
      {...props}
    />
  )
})
