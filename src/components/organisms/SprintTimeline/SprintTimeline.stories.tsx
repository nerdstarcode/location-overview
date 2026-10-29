import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SprintTimeline, type SprintPhaseFilter, type SprintTimelineProps, type SprintTimelineRow } from './SprintTimeline'
import { FIXTURE_SPRINT } from '../../../lib/azure/sprintFixtures'

const plan = (status: SprintTimelineRow['plan']['status'], squads = 1) => ({
  squads,
  people: squads * 3,
  percentage: squads * 250,
  capacity: 35,
  max: 47.5,
  maxExtended: 61.8,
  plannedPoints: status === 'below' ? 12 : 33,
  status,
})

const ROWS: SprintTimelineRow[] = [
  { sprint: { ...FIXTURE_SPRINT, id: 's7', number: 7, startDate: '2025-08-18', endDate: '2025-08-29' }, phase: 'closed', plan: plan('below') },
  { sprint: FIXTURE_SPRINT, phase: 'current', plan: plan('within') },
  { sprint: { ...FIXTURE_SPRINT, id: 's9', number: 9, startDate: '2025-09-15', endDate: '2025-09-26' }, phase: 'open', plan: plan(null, 0) },
]

function Stateful(props: SprintTimelineProps) {
  const [filter, setFilter] = useState<SprintPhaseFilter>(props.phaseFilter)
  return <SprintTimeline {...props} phaseFilter={filter} onPhaseFilterChange={setFilter} />
}

const meta: Meta<typeof SprintTimeline> = {
  title: 'Organisms/SprintTimeline',
  component: SprintTimeline,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { rows: ROWS, phaseFilter: 'active', onPhaseFilterChange: fn(), onOpen: fn(), onCreate: fn(), onEdit: fn(), onDelete: fn() },
  render: (args) => <Stateful {...args} />,
}

export default meta
type Story = StoryObj<typeof SprintTimeline>

export const AtualEAbertas: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Atual')).toBeInTheDocument()
    await expect(canvas.getByText('Aberta')).toBeInTheDocument()
    await expect(canvas.queryByText('Sprint 07 - FY25-26')).not.toBeInTheDocument()
    await expect(canvas.getByText('Dentro do previsto')).toBeInTheDocument()
    await expect(canvas.getByText('Sem alocação')).toBeInTheDocument()

    await userEvent.click(canvas.getByText('Sprint 08 - FY25-26'))
    await expect(args.onOpen).toHaveBeenCalledWith(FIXTURE_SPRINT)

    await userEvent.click(canvas.getByRole('button', { name: 'Fechadas' }))
    await expect(canvas.getByText('Sprint 07 - FY25-26')).toBeInTheDocument()
    await expect(canvas.getByText('Fechada')).toBeInTheDocument()
  },
}
