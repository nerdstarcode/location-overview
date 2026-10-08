import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SprintAllocationComparison } from './SprintAllocationComparison'
import { FIXTURE_ALLOCATION, FIXTURE_TOTAL_POINTS } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof SprintAllocationComparison> = {
  title: 'Organisms/Azure/SprintAllocationComparison',
  component: SprintAllocationComparison,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof SprintAllocationComparison>

export const ComBaseLocal: Story = {
  args: {
    rows: FIXTURE_ALLOCATION,
    totalPoints: FIXTURE_TOTAL_POINTS,
    qaMinPercent: 20,
    qaMaxPercent: 30,
    localSquadName: 'Portal',
    localSprintLabel: 'Sprint 08 - FY25-26',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // QA (Grace, 100%): 20%–30% de 33 SP = 6.6–9.9, com 8 SP atribuídos → dentro.
    await expect(canvas.getByText('6.6 – 9.9')).toBeInTheDocument()
    await expect(canvas.getByText('Dentro')).toBeInTheDocument()
    // Ada (SR, 100%): capacity 15 com 10 SP → abaixo; Alan (PL, 50%): max 7.5 com 10 SP → acima.
    await expect(canvas.getByText('Abaixo')).toBeInTheDocument()
    await expect(canvas.getByText('Acima')).toBeInTheDocument()
  },
}

export const SemBaseLocal: Story = {
  args: { rows: FIXTURE_ALLOCATION, totalPoints: FIXTURE_TOTAL_POINTS, qaMinPercent: 20, qaMaxPercent: 30 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/ainda não existe na base local/)).toBeInTheDocument()
  },
}
