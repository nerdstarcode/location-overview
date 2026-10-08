import type { ReactNode } from 'react'

export interface HelperTextProps {
  children?: ReactNode
  error?: boolean
  id?: string
}

export function HelperText({ children, error = false, id }: HelperTextProps) {
  if (!children) return null

  return (
    <p id={id} className={`mt-1 px-3 text-xs ${error ? 'text-brand-action-danger' : 'text-[var(--text)]'}`}>
      {children}
    </p>
  )
}
