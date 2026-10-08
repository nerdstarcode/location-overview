import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintPointsByTypeChart } from './SprintPointsByTypeChart'
import { FIXTURE_BY_TYPE, FIXTURE_USER_STORIES } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof SprintPointsByTypeChart> = {
  title: 'Organisms/Azure/SprintPointsByTypeChart',
  component: SprintPointsByTypeChart,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintPointsByTypeChart>

export const ComDados: Story = {
  args: { byType: FIXTURE_BY_TYPE, userStories: FIXTURE_USER_STORIES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('4 User Story(ies) · 5 Task(s) atreladas nesta sprint')).toBeInTheDocument()
    await expect(canvas.getByText('Login com SSO')).toBeInTheDocument()
    // "Filtro por squad": 2 tasks, nenhuma fechada.
    await expect(canvas.getByText('0/2')).toBeInTheDocument()
  },
}
