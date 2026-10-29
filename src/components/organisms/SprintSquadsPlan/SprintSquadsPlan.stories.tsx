import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SprintSquadsPlan } from './SprintSquadsPlan'
import { DEFAULT_LEVELS } from '../../../lib/levelsStorage'
import { sprintPlanSummary, sprintSquadPlans } from '../../../lib/sprintPlanning'
import { FIXTURE_ALLOCATIONS, FIXTURE_PEOPLE, FIXTURE_SPRINT, FIXTURE_WORK_ITEMS } from '../../../lib/azure/sprintFixtures'

const SQUADS = [
  { id: 'sq1', name: 'Portal' },
  { id: 'sq2', name: 'Renewals' },
]
const PLANS = sprintSquadPlans(FIXTURE_SPRINT, SQUADS, {
  allocations: FIXTURE_ALLOCATIONS,
  people: FIXTURE_PEOPLE,
  levels: DEFAULT_LEVELS,
  workItems: FIXTURE_WORK_ITEMS,
})

const meta: Meta<typeof SprintSquadsPlan> = {
  title: 'Organisms/SprintSquadsPlan',
  component: SprintSquadsPlan,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    sprint: FIXTURE_SPRINT,
    phase: 'current',
    plans: PLANS,
    summary: sprintPlanSummary(PLANS),
    onBack: fn(),
    onOpenSquad: fn(),
    onCreateDefault: fn(),
  },
}

export default meta
type Story = StoryObj<typeof SprintSquadsPlan>

export const PorSquad: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const portal = canvas.getByRole('button', { name: 'Abrir Portal' })
    await expect(within(portal).getByText('Dentro do previsto')).toBeInTheDocument()
    await expect(
      within(portal).getByRole('img', { name: 'Planejado 33 SP; previsto 35; máximo 47.5; máximo com extensão 61.8' }),
    ).toBeInTheDocument()
    await userEvent.click(portal)
    await expect(args.onOpenSquad).toHaveBeenCalledWith(SQUADS[0])

    const renewals = within(canvas.getByRole('listitem', { name: 'Renewals sem alocação' }))
    await userEvent.click(renewals.getByRole('button', { name: 'Criar alocação padrão' }))
    await expect(args.onCreateDefault).toHaveBeenCalledWith(SQUADS[1])
  },
}
