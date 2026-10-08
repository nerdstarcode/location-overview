import type { LabelHTMLAttributes } from 'react'
import type { TextFieldVariant } from '../Input/Input'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  error?: boolean
  variant?: TextFieldVariant
}

const baseClasses =
  'pointer-events-none absolute top-1/2 origin-left -translate-y-1/2 text-base text-[var(--text)] transition-all duration-150 ease-out'

// Position/background differ per variant: outlined needs an opaque cutout to
// fake the notched border it floats through; filled/standard sit over a
// continuous surface (or nothing) so no cutout is needed.
const variantClasses: Record<TextFieldVariant, string> = {
  outlined:
    'left-3 bg-inherit/0 rounded-full backdrop-blur-sm px-1 peer-focus:top-0 peer-focus:scale-75 peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-75',
  filled:
    'left-3 peer-focus:top-2 peer-focus:scale-75 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:scale-75',
  standard:
    'left-0 peer-focus:-top-1 peer-focus:scale-75 peer-[:not(:placeholder-shown)]:-top-1 peer-[:not(:placeholder-shown)]:scale-75',
}

// Must be rendered as the sibling immediately after a `peer` input (see
// atoms/Input) so peer-focus / peer-[:not(:placeholder-shown)] can drive the
// float animation without any React state.
export function Label({ error = false, variant = 'outlined', className = '', children, ...props }: LabelProps) {
  return (
    <label
      className={`${baseClasses} ${variantClasses[variant]} ${
        error ? 'peer-focus:text-brand-action-danger' : 'peer-focus:text-blue-500'
      } ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
