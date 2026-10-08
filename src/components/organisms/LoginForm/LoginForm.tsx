import { useState, type FormEvent } from 'react'
import { Button } from '../../atoms/Button/Button'
import { TextField } from '../../molecules/TextField/TextField'

export interface LoginFormValues {
  email: string
  password: string
}

export interface LoginFormProps {
  onSubmit?: (values: LoginFormValues) => void
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email || !password) {
      setError('Preencha e-mail e senha para continuar.')
      return
    }

    setError(null)
    onSubmit?.({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-5">
      <TextField
        label="E-mail"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        fullWidth
      />
      <TextField
        label="Senha"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={Boolean(error)}
        helperText={error ?? undefined}
        fullWidth
      />
      <Button type="submit">Entrar</Button>
    </form>
  )
}
