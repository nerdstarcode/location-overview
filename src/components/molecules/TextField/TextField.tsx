import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { Input, type TextFieldVariant } from '../../atoms/Input/Input'
import { Label } from '../../atoms/Label/Label'
import { HelperText } from '../../atoms/HelperText/HelperText'

export type { TextFieldVariant }

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  helperText?: string
  error?: boolean
  fullWidth?: boolean
  variant?: TextFieldVariant
  id?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helperText, error = false, fullWidth = false, variant = 'outlined', id, ...inputProps },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const helperId = helperText ? `${inputId}-helper-text` : undefined

  return (
    <div className={'w-full'}>
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          error={error}
          variant={variant}
          aria-invalid={error || undefined}
          aria-describedby={helperId}
          {...inputProps}
        />
        <Label htmlFor={inputId} error={error} variant={variant}>
          {label}
        </Label>
      </div>
      <HelperText id={helperId} error={error}>
        {helperText}
      </HelperText>
    </div>
  )
})
