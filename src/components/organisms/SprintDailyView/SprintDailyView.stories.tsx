import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintDailyView } from './SprintDailyView'
import { buildDaily } from '../../../lib/azure/dailyView'
import { FIXTURE_POINT_TYPES, FIXTURE_WORK_ITEMS } from '../../../lib/azure/sprintFixtures'

const view = buildDaily({
  liveItems: FIXTURE_WORK_ITEMS,
  liveSquadName: 'Portal',
  localSquad: undefined,
  localSprint: undefined,
  pointTypes: FIXTURE_POINT_TYPES,
  qaMinPercent: 30,
  qaMaxPercent: 50,
  base: { workItems: [], squads: [], sprints: [], people: [], allocations: [], cargos: [], levels: [], testCaseExecutions: [] },
})

const meta: Meta<typeof SprintDailyView> = {
  title: 'Organisms/Azure/SprintDailyView',
  component: SprintDailyView,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintDailyView>

export const ComDados: Story = {
  args: { view },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Sem ninguém alocado')).toBeInTheDocument()
  },
}
