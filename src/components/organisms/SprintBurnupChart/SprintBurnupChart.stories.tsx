import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintBurnupChart } from './SprintBurnupChart'
import { FIXTURE_BURNUP } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof SprintBurnupChart> = {
  title: 'Organisms/Azure/SprintBurnupChart',
  component: SprintBurnupChart,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintBurnupChart>

export const ComDados: Story = {
  args: { points: FIXTURE_BURNUP },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Story Points entregues por dia')).toBeInTheDocument()
  },
}

export const SemDatas: Story = {
  args: { points: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('A sprint não tem datas de início/fim configuradas.')).toBeInTheDocument()
  },
}
