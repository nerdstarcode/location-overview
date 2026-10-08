import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintPointsByPerson } from './SprintPointsByPerson'
import { FIXTURE_POINTS_BY_PERSON, FIXTURE_TOTAL_POINTS } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof SprintPointsByPerson> = {
  title: 'Organisms/Azure/SprintPointsByPerson',
  component: SprintPointsByPerson,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintPointsByPerson>

export const ComDados: Story = {
  args: { ...FIXTURE_POINTS_BY_PERSON, totalPoints: FIXTURE_TOTAL_POINTS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('33 SP na sprint · 5 SP sem responsável (2 item(ns))')).toBeInTheDocument()
  },
}

export const Vazio: Story = {
  args: {
    people: [],
    unassigned: { name: 'Sem responsável', email: '', storyPoints: 0, deliveredPoints: 0, itemCount: 0 },
    totalPoints: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nenhum item com story points nesta sprint.')).toBeInTheDocument()
  },
}
