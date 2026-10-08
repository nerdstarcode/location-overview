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

export const Vazia: Story = {
  args: { columns, data: [], emptyMessage: 'Nenhum dado importado.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nenhum dado importado.')).toBeInTheDocument()
  },
}
