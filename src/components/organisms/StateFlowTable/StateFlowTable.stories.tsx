import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { StateFlowTable } from './StateFlowTable'
import { itemFlows } from '../../../lib/stateFlow'
import { FIXTURE_WORK_ITEMS } from '../../../lib/azure/sprintFixtures'

// Março/2026: dia 2 é segunda-feira.
const at = (day: number) => `2026-03-${String(day).padStart(2, '0')}T12:00:00Z`
const [first, second] = FIXTURE_WORK_ITEMS
const ROWS = [
  {
    ...first,
    stateHistory: [
      { state: 'Active', date: at(4) },
      { state: 'Testing QA', date: at(9) },
      { state: 'Fail', date: at(10) },
      { state: 'Testing QA', date: at(11) },
      { state: 'Testing Prod', date: at(12) },
      { state: 'Closed', date: at(13) },
    ],
  },
  {
    ...second,
    stateHistory: [
      { state: 'Active', date: at(3) },
      { state: 'On Hold', date: at(5) },
      { state: 'Active', date: at(9) },
    ],
  },
]
const items = itemFlows(ROWS, () => '2026-03-02', new Date(at(16)))

const meta: Meta<typeof StateFlowTable> = {
  title: 'Organisms/StateFlowTable',
  component: StateFlowTable,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { items, onOpenItem: fn() },
}

export default meta
type Story = StoryObj<typeof StateFlowTable>

export const ItemAItem: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('04/03/2026')).toBeInTheDocument()
    // Sem Testing QA/Prod/Done: aparecem como "—".
    await expect(canvas.getAllByText('—').length).toBeGreaterThanOrEqual(3)
    await userEvent.click(canvas.getByText(first.title))
    await expect(args.onOpenItem).toHaveBeenCalledWith(ROWS[0])
  },
}
