import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { ItemStateTimeline } from './ItemStateTimeline'
import { itemTimelines } from '../../../lib/stateFlow'
import { FIXTURE_WORK_ITEMS } from '../../../lib/azure/sprintFixtures'

// Março/2026: dia 2 é segunda-feira.
const at = (day: number) => `2026-03-${String(day).padStart(2, '0')}T12:00:00Z`
const [first, second, third] = FIXTURE_WORK_ITEMS
const ROWS = [
  {
    ...first,
    stateHistory: [
      { state: 'Active', date: at(2) },
      { state: 'Testing QA', date: at(5) },
      { state: 'Fail', date: at(6) },
      { state: 'Active', date: at(9) },
      { state: 'Testing QA', date: at(10) },
      { state: 'Testing Prod', date: at(11) },
      { state: 'Closed', date: at(13) },
    ],
  },
  {
    ...second,
    stateHistory: [
      { state: 'Active', date: at(3) },
      { state: 'On Hold', date: at(4) },
      { state: 'Active', date: at(9) },
      { state: 'Testing QA', date: at(12) },
    ],
  },
  { ...third, stateHistory: [{ state: 'Active', date: at(10) }] },
]
const TIMELINES = itemTimelines(ROWS, new Date(at(16)))

const meta: Meta<typeof ItemStateTimeline> = {
  title: 'Organisms/ItemStateTimeline',
  component: ItemStateTimeline,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { timelines: TIMELINES, onOpenItem: fn() },
}

export default meta
type Story = StoryObj<typeof ItemStateTimeline>

export const ComItens: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Active: 3 + 1 do primeiro, 1 + 3 do segundo (sem o On Hold) e 4 do terceiro → média 4.
    await expect(canvas.getByText('Em Active').closest('div')).toHaveTextContent('4 dias')
    await expect(canvas.getByText('On Hold').closest('div')).toHaveTextContent('3 dias')
    await expect(canvas.getByText('Ciclo até Done (sem On Hold)').closest('div')).toHaveTextContent('9 dias')
    await expect(canvas.getByText('Idas a Fail').closest('div')).toHaveTextContent('1')
  },
}

export const SemHistorico: Story = {
  args: { timelines: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Nenhum item com histórico de estados/)).toBeInTheDocument()
  },
}
