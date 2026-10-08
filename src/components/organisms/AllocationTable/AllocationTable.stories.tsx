import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AllocationTable } from './AllocationTable'
import type { AllocationRow } from '../../../lib/allocation'

const sampleRows: AllocationRow[] = [
  {
    name: 'Ada Lovelace',
    cargo: 'Sr Software Developer',
    squad: 'Apollo',
    sprint: 'Sprint 06-FY25-26',
    perfil: 'DEV-BACK',
    nivel: 'SR',
    diasSprint: 10,
    capacityPointsDay: 1.5,
    maxPointsDay: 2,
    capacityPointsSprint: 15,
    maxPointsSprint: 20,
  },
]

const meta: Meta<typeof AllocationTable> = {
  title: 'Organisms/AllocationTable',
  component: AllocationTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Permite importar uma planilha (.xlsx/.xls/.csv) no formato "Alocação Sprint" e exibe o resultado ' +
          'numa `DataTable` com as mesmas colunas da planilha original (Name, Cargo, Squad, Sprint, Perfil, ' +
          'Nivel e os pontos mínimos/máximos por dia e por sprint).',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof AllocationTable>

export const Vazia: Story = {
  args: { initialRows: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Importar planilha')).toBeInTheDocument()
    await expect(canvas.getByText('Importe uma planilha para visualizar a alocação.')).toBeInTheDocument()
  },
}

export const ComDadosImportados: Story = {
  args: { initialRows: sampleRows },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Ada Lovelace')).toBeInTheDocument()
    await expect(canvas.getByText('1 linha')).toBeInTheDocument()
  },
}

const manyRows: AllocationRow[] = Array.from({ length: 60 }, (_, index) => ({
  ...sampleRows[0],
  name: `Pessoa ${index + 1}`,
}))

export const ComPaginacao: Story = {
  args: { initialRows: manyRows },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('60 linhas')).toBeInTheDocument()
    await expect(canvas.getByText('Página 1 de 3')).toBeInTheDocument()
    await expect(canvas.getByText('Pessoa 1')).toBeInTheDocument()
    await expect(canvas.queryByText('Pessoa 26')).not.toBeInTheDocument()
  },
}
