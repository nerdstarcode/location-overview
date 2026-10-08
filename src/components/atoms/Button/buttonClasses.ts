export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 text-white hover:bg-blue-600',
  secondary: 'border border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--code-bg)]',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-2 py-1 text-xs',
}

/** Classes do átomo Button — também usadas em <Link> que precisa parecer botão. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = ''): string {
  return `${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()
}
