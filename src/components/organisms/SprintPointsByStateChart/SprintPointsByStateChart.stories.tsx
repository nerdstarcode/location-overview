import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintPointsByStateChart } from './SprintPointsByStateChart'
import { FIXTURE_BY_STATE } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof SprintPointsByStateChart> = {
  title: 'Organisms/Azure/SprintPointsByStateChart',
  component: SprintPointsByStateChart,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintPointsByStateChart>

export const ComDados: Story = {
  args: { byState: FIXTURE_BY_STATE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Story Points por State')).toBeInTheDocument()
  },
}
