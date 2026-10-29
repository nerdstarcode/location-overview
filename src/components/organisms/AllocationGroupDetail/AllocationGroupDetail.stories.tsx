import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AllocationGroupDetail } from './AllocationGroupDetail'
import { DEFAULT_LEVELS } from '../../../lib/levelsStorage'
import type { PersonAllocation } from '../../../lib/personAllocationsStorage'
import { FIXTURE_ALLOCATIONS, FIXTURE_PEOPLE, FIXTURE_SPRINT, FIXTURE_WORK_ITEMS } from '../../../lib/azure/sprintFixtures'

const LINUS = { id: 'p4', nome: 'Linus Torvalds', email: 'linus@example.com', cargo: 'Software Developer', nivel: 'PL', squadIds: ['sq2'] }
// Alan tem 50% na outra squad: ao escolhê-lo, a % já vem com os 50% que sobram.
const OTHER_SQUAD: PersonAllocation = { id: 'a9', personId: 'p4', squadId: 'sq2', sprintId: 's8', percentage: 30 }

const meta: Meta<typeof AllocationGroupDetail> = {
  title: 'Organisms/AllocationGroupDetail',
  component: AllocationGroupDetail,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    squad: { id: 'sq1', name: 'Portal' },
    sprint: FIXTURE_SPRINT,
    entries: FIXTURE_ALLOCATIONS,
    allocations: [...FIXTURE_ALLOCATIONS, OTHER_SQUAD],
    people: [...FIXTURE_PEOPLE, LINUS],
    squads: [
      { id: 'sq1', name: 'Portal' },
      { id: 'sq2', name: 'Renewals' },
    ],
    levels: DEFAULT_LEVELS,
    workItems: FIXTURE_WORK_ITEMS,
    summary: { capacityPoints: 25, maxPoints: 37.5, storyPoints: 13 },
    onBack: fn(),
    onAdd: fn(() => null),
    onRemove: fn((ids: string[]) => FIXTURE_ALLOCATIONS.filter((a) => ids.includes(a.id))),
    onRestore: fn(),
    onSetPercentage: fn(() => null),
    onMove: fn(() => null),
    onEdit: fn(),
  },
}

export default meta
type Story = StoryObj<typeof AllocationGroupDetail>

export const AdicionarRapido: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Pessoa para adicionar' }))
    await userEvent.click(body.getByRole('option', { name: 'Linus Torvalds (fora da squad)' }))
    // 30% já usados na outra squad: sobram 70%.
    await expect(canvas.getByRole('spinbutton', { name: '% da nova pessoa' })).toHaveValue(70)
    await userEvent.click(canvas.getByRole('button', { name: 'Adicionar' }))
    await expect(args.onAdd).toHaveBeenCalledWith([{ personId: 'p4', squadId: 'sq1', sprintId: 's8', percentage: 70 }])
  },
}

export const RemoverComDesfazer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Remover Alan Turing' }))
    await expect(args.onRemove).toHaveBeenCalledWith(['a2'])
    await expect(canvas.getByRole('status')).toHaveTextContent('Alan Turing removido(a)')
    await userEvent.click(canvas.getByRole('button', { name: 'Desfazer' }))
    await expect(args.onRestore).toHaveBeenCalledWith([FIXTURE_ALLOCATIONS[1]])
  },
}

export const EdicaoInlineEEmLote: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const cell = canvas.getByDisplayValue('50')
    await userEvent.clear(cell)
    await userEvent.type(cell, '80{Enter}')
    await expect(args.onSetPercentage).toHaveBeenCalledWith(['a2'], 80)

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Selecionar Ada Lovelace' }))
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Selecionar Grace Hopper' }))
    const toolbar = within(canvas.getByRole('toolbar', { name: 'Ações em lote' }))
    await expect(toolbar.getByText('2 selecionadas')).toBeInTheDocument()
    await userEvent.click(toolbar.getByRole('button', { name: 'Remover' }))
    await expect(args.onRemove).toHaveBeenCalledWith(['a1', 'a3'])
    await expect(canvas.getByRole('status')).toHaveTextContent('2 pessoas removidas')
  },
}

export const Vazio: Story = {
  args: { entries: [], allocations: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Adicionar membros da squad (3)' })).toBeEnabled()
  },
}
