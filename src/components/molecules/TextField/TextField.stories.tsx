import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TextField } from './TextField'

const meta: Meta<typeof TextField> = {
  title: 'Molecules/TextField',
  component: TextField,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Campo de texto com label flutuante, inspirado no `TextField` do MUI React ' +
          '(https://mui.com/material-ui/react-text-field/). O label começa sobreposto ao valor (como um ' +
          'placeholder) e sobe quando o campo recebe foco ou já possui um valor preenchido. A animação é ' +
          'feita inteiramente em CSS (Tailwind `peer` + `:focus` + `:placeholder-shown`), sem estado em ' +
          'React — funciona igual em campos controlados e não controlados. Composto pelos átomos `Input`, ' +
          '`Label` e `HelperText`.\n\n' +
          'Suporta as 3 variantes do MUI via prop `variant`: `outlined` (padrão, borda completa com o ' +
          'label "recortando" a borda superior), `filled` (fundo preenchido, sublinhado) e `standard` ' +
          '(apenas sublinhado, sem fundo).',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['outlined', 'filled', 'standard'],
    },
  },
  args: {
    label: 'Nome completo',
    onChange: fn(),
  },
}

export default meta
type Story = StoryObj<typeof TextField>

export const Default: Story = {}

export const Filled: Story = {
  args: { variant: 'filled' },
}

export const Standard: Story = {
  args: { variant: 'standard' },
}

export const TresVariantes: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex flex-col gap-8">
      <TextField {...args} variant="outlined" label="Outlined" />
      <TextField {...args} variant="filled" label="Filled" />
      <TextField {...args} variant="standard" label="Standard" />
    </div>
  ),
}

export const ComValor: Story = {
  args: { defaultValue: 'Ada Lovelace' },
}

export const ComErro: Story = {
  args: {
    error: true,
    helperText: 'Este campo é obrigatório.',
  },
}

export const Desabilitado: Story = {
  args: { disabled: true, defaultValue: 'Somente leitura' },
}

export const Interacao: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('Nome completo')

    await userEvent.type(input, 'Grace Hopper')
    await expect(input).toHaveValue('Grace Hopper')
  },
}
