import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { NewSprintAllocationModal } from './NewSprintAllocationModal'
import { FIXTURE_PEOPLE, FIXTURE_SPRINT } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof NewSprintAllocationModal> = {
  title: 'Organisms/NewSprintAllocationModal',
  component: NewSprintAllocationModal,
  tags: ['autodocs'],
  args: {
    open: true,
    onClose: fn(),
    people: FIXTURE_PEOPLE,
    squads: [
      { id: 'sq1', name: 'Portal' },
      { id: 'sq2', name: 'Renewals' },
    ],
    sprints: [FIXTURE_SPRINT],
    // Ada já está 100% e Alan 40% em outra squad nesta sprint.
    allocations: [
      { id: 'x1', personId: 'p1', squadId: 'sq2', sprintId: 's8', percentage: 100 },
      { id: 'x2', personId: 'p2', squadId: 'sq2', sprintId: 's8', percentage: 40 },
    ],
    onSave: fn(() => null),
    onOpenGroup: fn(),
  },
}

export default meta
type Story = StoryObj<typeof NewSprintAllocationModal>

export const AlocacaoPadraoDaSquad: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(body.getByRole('combobox', { name: 'Squad' }))
    await userEvent.click(body.getByRole('option', { name: 'Portal' }))
    await userEvent.click(body.getByRole('combobox', { name: 'Sprint' }))
    await userEvent.click(body.getByRole('option', { name: 'Sprint 08 - FY25-26' }))

    // Membros com o que sobra: Ada (100% em outra) vem desmarcada.
    await expect(body.getByRole('checkbox', { name: 'Alocar Ada Lovelace' })).not.toBeChecked()
    await expect(body.getByRole('spinbutton', { name: '% de Alan Turing' })).toHaveValue(60)
    await expect(body.getByRole('spinbutton', { name: '% de Grace Hopper' })).toHaveValue(100)

    await userEvent.click(body.getByRole('checkbox', { name: 'Alocar Grace Hopper' }))
    await userEvent.click(body.getByRole('button', { name: 'Alocar 1 pessoa' }))
    await expect(args.onSave).toHaveBeenCalledWith([{ personId: 'p2', squadId: 'sq1', sprintId: 's8', percentage: 60 }])
  },
}
