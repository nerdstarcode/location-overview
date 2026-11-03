import { describe, expect, it } from 'vitest'
import { executionsBySprint, executionsSummary, itemExecutions, type TestCaseRun } from './testExecutionsPerPoint'
import { buildWorkItemRow, type WorkItemRow } from './workItems'

const item = (id: number, storyPoints: number, testCaseIds: number[] | undefined, sprint = 'Sprint 01'): WorkItemRow => ({
  ...buildWorkItemRow({ id, workItemType: 'User Story', title: `Item ${id}`, storyPoints, iterationPath: `Proj\\${sprint} - FY25-26` }),
  testCaseIds,
})

const RUNS: TestCaseRun[] = [
  { testCaseId: 10, email: 'grace@x.com', executed: 3, passed: 2, failed: 1 },
  { testCaseId: 10, email: 'ada@x.com', executed: 1, passed: 1, failed: 0 },
  { testCaseId: 11, email: 'grace@x.com', executed: 2, passed: 2, failed: 0 },
  // Test Case sem item ligado: não entra.
  { testCaseId: 99, email: 'grace@x.com', executed: 5, passed: 5, failed: 0 },
]

// Item 1 (5 SP) com 2 Test Cases; item 2 (3 SP) compartilha o Test Case 10; item 3 sem Test Case.
const ROWS = [item(1, 5, [10, 11]), item(2, 3, [10], 'Sprint 02'), item(3, 8, undefined)]

describe('itemExecutions', () => {
  it('soma os resultados executados dos Test Cases ligados, com re-testes', () => {
    expect(itemExecutions(ROWS, RUNS).map((i) => [i.row.id, i.testCases, i.executions, i.passed, i.failed, i.perPoint])).toEqual([
      [1, 2, 6, 5, 1, 1.2],
      [2, 1, 4, 3, 1, 4 / 3],
      [3, 0, 0, 0, 0, null],
    ])
  })

  it('com email, só as execuções da pessoa', () => {
    expect(itemExecutions(ROWS, RUNS, 'GRACE@x.com').map((i) => i.executions)).toEqual([5, 3, 0])
  })
})

describe('executionsSummary / executionsBySprint', () => {
  it('média de execuções por SP só sobre os itens com Test Case', () => {
    expect(executionsSummary(itemExecutions(ROWS, RUNS))).toEqual({
      items: 3,
      itemsWithTests: 2,
      points: 16,
      pointsWithTests: 8,
      executions: 10,
      passed: 8,
      failed: 2,
      perPoint: 1.3,
    })
  })

  it('separa por sprint planejada, em ordem', () => {
    const sprints = executionsBySprint(itemExecutions(ROWS, RUNS))
    expect(sprints.map((s) => [s.label, s.summary.perPoint])).toEqual([
      ['Sprint 01 - FY25-26', 1.2],
      ['Sprint 02 - FY25-26', 1.3],
    ])
  })
})
