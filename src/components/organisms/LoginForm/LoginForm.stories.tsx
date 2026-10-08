import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { LoginForm } from './LoginForm'

const meta: Meta<typeof LoginForm> = {
  title: 'Organisms/LoginForm',
  component: LoginForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Formulário de login que compõe duas moléculas `TextField` (e-mail e senha) e o átomo `Button`. ' +
          'Mantém o estado dos campos e uma validação simples: se algum campo estiver vazio ao enviar, ' +
          'o campo de senha exibe erro via `helperText`. Ao submeter com sucesso, chama `onSubmit` com ' +
          '`{ email, password }`.',
      },
    },
  },
  args: {
    onSubmit: fn(),
  },
}

export default meta
type Story = StoryObj<typeof LoginForm>

export const Default: Story = {}

export const PreenchimentoEEnvio: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText('E-mail'), 'ada@lovelace.dev')
    await userEvent.type(canvas.getByLabelText('Senha'), 'senha-super-secreta')
    await userEvent.click(canvas.getByRole('button', { name: 'Entrar' }))

    await expect(args.onSubmit).toHaveBeenCalledTimes(1)
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'ada@lovelace.dev',
      password: 'senha-super-secreta',
    })
  },
}

export const ValidacaoDeCamposVazios: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Entrar' }))

    await expect(canvas.getByText('Preencha e-mail e senha para continuar.')).toBeInTheDocument()
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}
