import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintTestRunsSummary } from './SprintTestRunsSummary'
import { FIXTURE_TEST_RUNS_SUMMARY, FIXTURE_WORKING_DAYS } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof SprintTestRunsSummary> = {
  title: 'Organisms/Azure/SprintTestRunsSummary',
  component: SprintTestRunsSummary,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintTestRunsSummary>

export const ComDados: Story = {
  args: { summary: FIXTURE_TEST_RUNS_SUMMARY, workingDays: FIXTURE_WORKING_DAYS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('2 automatizadas · 1 manuais')).toBeInTheDocument()
    await expect(canvas.getByText('90')).toBeInTheDocument()
  },
}
