import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ColumnDef } from '@tanstack/react-table'
import { expect, userEvent, within } from 'storybook/test'
import { DataTable } from './DataTable'

interface Row {
  id: string
  name: string
  squad: string
  points: number
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'squad', header: 'Squad' },
  { accessorKey: 'points', header: 'Points', meta: { align: 'right', numeric: true } },
]

const data: Row[] = [
  { id: '1', name: 'Ada Lovelace', squad: 'Apollo', points: 1.5 },
  { id: '2', name: 'Grace Hopper', squad: 'Hermes', points: 2 },
]

const meta: Meta<typeof DataTable<Row>> = {
  title: 'Organisms/DataTable',
  component: DataTable<Row>,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof DataTable<Row>>

export const ComDados: Story = {
  args: { columns, data },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ada Lovelace')).toBeInTheDocument()
    await expect(canvas.getByText('Grace Hopper')).toBeInTheDocument()
  },
}

export const Ordenavel: Story = {
  args: { columns, data },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText('Name'))
    await expect(canvas.getByText('Name ↑')).toBeInTheDocument()
  },
}

export const Selecionavel: Story = {
  args: {
    columns,
    data,
    selectable: true,
    getRowId: (row: Row) => row.id,
    selectedIds: new Set(['1']),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkboxes = canvas.getAllByRole('checkbox')
    await expect(checkboxes[1]).toBeChecked()
    await expect(checkboxes[2]).not.toBeChecked()
  },
}

// 30 linhas em ordem decrescente de nome: a ordenação só acerta a página 1 se
// ordenar o conjunto inteiro antes de paginar.
const manyRows: Row[] = Array.from({ length: 30 }, (_, index) => {
  const n = 30 - index
  return { id: String(n), name: `Pessoa ${String(n).padStart(2, '0')}`, squad: n % 2 ? 'Apollo' : 'Hermes', points: n }
})
manyRows.push({ id: '31', name: 'João Conceição', squad: 'Atlas', points: 0 })

export const Paginada: Story = {
  args: { columns, data: manyRows },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Página 1 de 4')).toBeInTheDocument()
    await expect(canvas.getByText('31 no total')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Próxima página' }))
    await expect(canvas.getByText('Página 2 de 4')).toBeInTheDocument()
  },
}

export const OrdenacaoGlobal: Story = {
  args: { columns, data: manyRows },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Próxima página' }))
    await userEvent.click(canvas.getByText('Name'))
    await expect(canvas.getByText('Página 1 de 4')).toBeInTheDocument()
    await expect(canvas.getByText('Pessoa 01')).toBeInTheDocument()
  },
}

export const Busca: Story = {
  args: { columns, data: manyRows },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Próxima página' }))
    await userEvent.type(canvas.getByRole('searchbox'), 'conceicao atlas')
    await expect(await canvas.findByText('1 no total')).toBeInTheDocument()
    await expect(canvas.getByText('João Conceição')).toBeInTheDocument()
    await expect(canvas.getByText('Página 1 de 1')).toBeInTheDocument()
  },
}

export const BuscaSemResultados: Story = {
  args: { columns, data: manyRows },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('searchbox'), 'zzz')
    await expect(await canvas.findByText('Nenhum resultado para “zzz”.')).toBeInTheDocument()
    await expect(canvas.getByText('0 no total')).toBeInTheDocument()
  },
}

export const Vazia: Story = {
  args: { columns, data: [], emptyMessage: 'Nenhum dado importado.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nenhum dado importado.')).toBeInTheDocument()
  },
}
