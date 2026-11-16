import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TestResultsChart } from './TestResultsChart'
import { itemExecutions, type TestCaseRun } from '../../../lib/testExecutionsPerPoint'
import { buildWorkItemRow } from '../../../lib/workItems'

const story = (id: number, title: string, storyPoints: number, testCaseIds: number[]) => ({
  ...buildWorkItemRow({ id, workItemType: 'User Story', title, storyPoints, state: 'Closed', iterationPath: 'Proj\\Portal\\Sprint 05 - FY26-27' }),
  testCaseIds,
})

const ROWS = [story(101, 'Login com SSO', 5, [501, 502]), story(102, 'Exportar relatório', 3, [503])]
const RUNS: TestCaseRun[] = [
  { testCaseId: 501, email: 'grace@example.com', executed: 4, passed: 3, failed: 1, sprintLabel: 'Sprint 05 - FY26-27' },
  { testCaseId: 502, email: 'grace@example.com', executed: 2, passed: 1, failed: 1, sprintLabel: 'Sprint 06 - FY26-27' },
  { testCaseId: 503, email: 'grace@example.com', executed: 2, passed: 2, failed: 0, sprintLabel: 'Sprint 06 - FY26-27' },
]

const meta: Meta<typeof TestResultsChart> = {
  title: 'Organisms/TestResultsChart',
  component: TestResultsChart,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { items: itemExecutions(ROWS, RUNS), onOpenItem: fn() },
}

export default meta
type Story = StoryObj<typeof TestResultsChart>

export const ComResultados: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 6 passed ÷ 8 resultados = 75%.
    await expect(canvas.getByText('Aprovação média').closest('div')?.parentElement).toHaveTextContent('75%')
    await userEvent.click(canvas.getByRole('button', { name: 'Por item' }))
    await expect(canvas.getByRole('button', { name: 'Por item' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const Vazio: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Nenhum resultado de teste/)).toBeInTheDocument()
  },
}
