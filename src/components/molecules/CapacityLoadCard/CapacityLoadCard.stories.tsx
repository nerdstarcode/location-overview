import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { CapacityLoadCard, type CapacityLoad } from './CapacityLoadCard'

const NO_SPRINTS: CapacityLoad['sprintStatusCounts'] = { below: 0, within: 0, above: 0, extension: 0, overload: 0 }

// Sprint de 10 dias válidos a 100%, nível com 1 / 1,5 SP por dia: previsto 10, máximo 15 e
// máximo com a extensão de +3 dias úteis 19,5.
function load(partial: Partial<CapacityLoad>): CapacityLoad {
  return {
    loadStatus: 'within',
    deliveredOnAllocatedSprintsRaw: 10,
    capacity: 10,
    maxCapacity: 15,
    maxExtendedCapacity: 19.5,
    allocatedSprints: 1,
    extensionUsedPoints: 0,
    extensionUsedSprints: 0,
    overloadPoints: 0,
    overloadSprints: [],
    sprintStatusCounts: { ...NO_SPRINTS, within: 1 },
    ...partial,
  }
}

const meta: Meta<typeof CapacityLoadCard> = {
  title: 'Molecules/CapacityLoadCard',
  component: CapacityLoadCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { label: 'Entrega × previsto', info: 'Compara o entregue com o previsto na Alocação.', unit: 'SP' },
}

export default meta
type Story = StoryObj<typeof CapacityLoadCard>

// Parecido com o print: muita entrega acima até da extensão.
export const Sobrecarga: Story = {
  args: {
    load: load({
      loadStatus: 'overload',
      deliveredOnAllocatedSprintsRaw: 93,
      capacity: 28.7,
      maxCapacity: 43,
      maxExtendedCapacity: 55.9,
      allocatedSprints: 8,
      extensionUsedPoints: 10.4,
      extensionUsedSprints: 6,
      overloadPoints: 37.1,
      overloadSprints: ['Sprint 01 - FY26-27', 'Sprint 02 - FY26-27', 'Sprint 03 - FY26-27', 'Sprint 04 - FY26-27', 'Sprint 05 - FY26-27'],
      sprintStatusCounts: { ...NO_SPRINTS, overload: 5, extension: 1, within: 1, below: 1 },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sobrecarga')).toBeInTheDocument()
    await expect(canvas.getByText('Entregou 93 SP, 37.1 acima até da extensão (55.9).')).toBeInTheDocument()
    await expect(
      canvas.getByRole('img', {
        name: 'Entregue 93 SP; previsto 28.7; máximo 43; máximo com extensão 55.9',
      }),
    ).toBeInTheDocument()
    await expect(canvas.getByText('Máximo + extensão')).toBeInTheDocument()
    await expect(canvas.getByRole('list', { name: 'Sprints por situação' })).toHaveTextContent('5 sprints: sobrecarga')
    // Lista no máximo 3 sprints e resume o resto.
    await expect(canvas.getByText(/e mais 2\): sobrecarga/)).toBeInTheDocument()
  },
}

export const NaExtensao: Story = {
  args: {
    load: load({
      loadStatus: 'extension',
      deliveredOnAllocatedSprintsRaw: 17,
      extensionUsedPoints: 2,
      extensionUsedSprints: 1,
      sprintStatusCounts: { ...NO_SPRINTS, extension: 1 },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Na extensão')).toBeInTheDocument()
    await expect(
      canvas.getByText('Entregou 17 SP: passou do máximo (15); 2 cabem na extensão de +3 dias úteis (até 19.5).'),
    ).toBeInTheDocument()
    await expect(canvas.queryByText(/acima até da extensão em/)).not.toBeInTheDocument()
  },
}

// Entregue, em andamento (sprint atual) e em andamento atrasado aparecem separados.
export const ComItensEmAberto: Story = {
  args: {
    load: load({
      loadStatus: 'above',
      deliveredOnAllocatedSprintsRaw: 12.5,
      inProgressOnAllocatedSprints: 3,
      inProgressDelayedOnAllocatedSprints: 1.5,
      sprintStatusCounts: { ...NO_SPRINTS, above: 1 },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText('Entregue (8) + em andamento (4.5) somam 12.5 SP: acima do previsto (10), mas dentro do máximo (15).'),
    ).toBeInTheDocument()
    await expect(canvas.getByText('8 SP')).toBeInTheDocument()
    await expect(canvas.getByText('Em andamento atrasado')).toBeInTheDocument()
    await expect(canvas.getByText('1.5 SP')).toBeInTheDocument()
    await expect(
      canvas.getByRole('img', {
        name: 'Entregue 8 SP; em andamento 3; em andamento atrasado 1.5; previsto 10; máximo 15; máximo com extensão 19.5',
      }),
    ).toBeInTheDocument()
  },
}

export const Dentro: Story = { args: { load: load({}) } }

export const Abaixo: Story = {
  args: { load: load({ loadStatus: 'below', deliveredOnAllocatedSprintsRaw: 4, sprintStatusCounts: { ...NO_SPRINTS, below: 1 } }) },
}

export const SemAlocacao: Story = {
  args: { load: load({ loadStatus: null, deliveredOnAllocatedSprintsRaw: 0, capacity: 0, allocatedSprints: 0 }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sem alocação nas sprints do filtro')).toBeInTheDocument()
  },
}
