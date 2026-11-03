import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { TestExecutionsPerPoint } from './TestExecutionsPerPoint'
import { itemExecutions, type TestCaseRun } from '../../../lib/testExecutionsPerPoint'
import { buildWorkItemRow } from '../../../lib/workItems'

const story = (id: number, title: string, storyPoints: number, sprint: string, testCaseIds?: number[]) => ({
  ...buildWorkItemRow({ id, workItemType: 'User Story', title, storyPoints, state: 'Closed', iterationPath: `Proj\\Portal\\${sprint} - FY26-27` }),
  testCaseIds,
})

const ROWS = [
  story(101, 'Login com SSO', 5, 'Sprint 05', [501, 502]),
  story(102, 'Exportar relatório', 3, 'Sprint 05', [503]),
  story(103, 'Filtro por squad', 8, 'Sprint 06', [504, 505]),
  story(104, 'Ajuste de texto', 1, 'Sprint 06'),
]
const RUNS: TestCaseRun[] = [
  { testCaseId: 501, email: 'grace@example.com', executed: 4, passed: 3, failed: 1 },
  { testCaseId: 502, email: 'grace@example.com', executed: 2, passed: 2, failed: 0 },
  { testCaseId: 503, email: 'grace@example.com', executed: 2, passed: 2, failed: 0 },
  { testCaseId: 504, email: 'ada@example.com', executed: 6, passed: 4, failed: 2 },
  { testCaseId: 505, email: 'ada@example.com', executed: 2, passed: 2, failed: 0 },
]

const meta: Meta<typeof TestExecutionsPerPoint> = {
  title: 'Organisms/TestExecutionsPerPoint',
  component: TestExecutionsPerPoint,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { items: itemExecutions(ROWS, RUNS), onOpenItem: fn() },
}

export default meta
type Story = StoryObj<typeof TestExecutionsPerPoint>

export const PorSprint: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    // 16 execuções ÷ 16 SP dos itens com Test Case = 1.
    await expect(canvas.getByText('Execuções por SP').closest('div')).toHaveTextContent('16 execuções ÷ 16 SP')
    await expect(canvas.getByText('Itens com Test Case').closest('div')).toHaveTextContent('3 de 4')
    // O item sem Test Case fica fora da tabela.
    await expect(canvas.queryByText('Ajuste de texto')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByText('Login com SSO'))
    await expect(args.onOpenItem).toHaveBeenCalledWith(ROWS[0])
  },
}

export const SemTestCases: Story = {
  args: { items: itemExecutions([story(104, 'Ajuste de texto', 1, 'Sprint 06')], RUNS) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Nenhum item de pontos com Test Case ligado/)).toBeInTheDocument()
  },
}
