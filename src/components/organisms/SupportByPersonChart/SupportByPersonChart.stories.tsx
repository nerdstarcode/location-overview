import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { SupportByPersonChart } from './SupportByPersonChart'
import type { SprintSupport } from '../../../lib/supportMetrics'

const share = (personId: string, nome: string, percentage: number, base: number) => ({ personId, nome, percentage, base, points: (base * percentage) / 100 })

const BY_SPRINT = new Map<string, SprintSupport>([
  ['Sprint 05 - FY26-27', { points: 12, detail: [share('p1', 'Samyr Melo', 50, 10), share('p2', 'Thais Costa', 50, 4), share('p3', 'Helen Lima', 25, 20)] }],
  ['Sprint 06 - FY26-27', { points: 6.5, detail: [share('p1', 'Samyr Melo', 50, 8), share('p3', 'Helen Lima', 25, 10)] }],
])

const meta: Meta<typeof SupportByPersonChart> = {
  title: 'Organisms/SupportByPersonChart',
  component: SupportByPersonChart,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    sprintLabels: ['Sprint 04 - FY26-27', 'Sprint 05 - FY26-27', 'Sprint 06 - FY26-27'],
    bySprint: BY_SPRINT,
    unit: 'SP',
  },
}

export default meta
type Story = StoryObj<typeof SupportByPersonChart>

export const ComApoio: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Apoio por pessoa e sprint')).toBeInTheDocument()
    await expect(canvas.queryByText('Nenhum apoio nas sprints selecionadas.')).not.toBeInTheDocument()
  },
}

export const SemApoio: Story = {
  args: { bySprint: new Map() },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Nenhum apoio nas sprints selecionadas.')).toBeInTheDocument()
  },
}
