import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Select, type SelectProps } from './Select'

const OPTIONS = [
  { value: 'p1', label: 'Ada Lovelace · Sr Software Developer' },
  { value: 'p2', label: 'Alan Turing · Software Developer' },
  { value: 'p3', label: 'Grace Hopper · Sr Software Tester Quality' },
  { value: 'p4', label: 'Márcia Pinheiro · Software Developer' },
]

// Controlado, como nas telas: o valor escolhido volta como `value`.
function ControlledSelect(props: SelectProps) {
  const [value, setValue] = useState(props.value)
  return (
    <div className="max-w-sm">
      <Select
        {...props}
        value={value}
        onChange={(next) => {
          setValue(next)
          props.onChange(next)
        }}
      />
    </div>
  )
}

const meta: Meta<typeof Select> = {
  title: 'Atoms/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { options: OPTIONS, value: '', placeholder: 'Selecione uma pessoa', 'aria-label': 'Pessoa', onChange: fn() },
  render: (args) => <ControlledSelect {...args} />,
}

export default meta
type Story = StoryObj<typeof Select>

export const FiltraAoDigitar: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const input = canvas.getByRole('combobox', { name: 'Pessoa' })

    await userEvent.click(input)
    await expect(body.getAllByRole('option')).toHaveLength(4)

    // Sem acento e com mais de um termo, como a busca das tabelas.
    await userEvent.type(input, 'marcia dev')
    await expect(body.getAllByRole('option')).toHaveLength(1)
    await userEvent.click(body.getByRole('option', { name: 'Márcia Pinheiro · Software Developer' }))

    await expect(args.onChange).toHaveBeenCalledWith('p4')
    await expect(input).toHaveValue('Márcia Pinheiro · Software Developer')
    await expect(body.queryByRole('listbox')).not.toBeInTheDocument()
  },
}

export const NavegaPeloTeclado: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('combobox', { name: 'Pessoa' })

    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    await expect(args.onChange).toHaveBeenCalledWith('p3')

    // Esc fecha e devolve o label escolhido.
    await userEvent.type(input, 'xyz')
    await expect(within(canvasElement.ownerDocument.body).getByText('Nenhuma opção')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect(input).toHaveValue('Grace Hopper · Sr Software Tester Quality')
  },
}

export const Limpar: Story = {
  args: { value: 'p2' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Limpar' }))
    await expect(args.onChange).toHaveBeenCalledWith('')
    await expect(canvas.getByRole('combobox', { name: 'Pessoa' })).toHaveValue('')
  },
}

export const Desabilitado: Story = {
  args: { value: 'p1', disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: 'Pessoa' })).toBeDisabled()
    await expect(canvas.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument()
  },
}
