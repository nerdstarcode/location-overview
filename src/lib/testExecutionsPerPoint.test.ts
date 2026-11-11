import { describe, expect, it } from 'vitest'
import { executionsBySprint, executionsSummary, itemExecutions, type TestCaseRun } from './testExecutionsPerPoint'
import { buildWorkItemRow, type WorkItemRow } from './workItems'

const item = (id: number, storyPoints: number, testCaseIds: number[] | undefined): WorkItemRow => ({
  ...buildWorkItemRow({ id, workItemType: 'User Story', title: `Item ${id}`, storyPoints, iterationPath: 'Proj\\Sprint 01 - FY25-26' }),
  testCaseIds,
})

const S1 = 'Sprint 01 - FY25-26'
const S2 = 'Sprint 02 - FY25-26'
const RUNS: TestCaseRun[] = [
  { testCaseId: 10, email: 'grace@x.com', executed: 3, passed: 2, failed: 1, sprintLabel: S1 },
  { testCaseId: 10, email: 'ada@x.com', executed: 1, passed: 1, failed: 0, sprintLabel: S2 },
  { testCaseId: 11, email: 'grace@x.com', executed: 2, passed: 2, failed: 0, sprintLabel: S1 },
  // Test Case sem item ligado: não entra.
  { testCaseId: 99, email: 'grace@x.com', executed: 5, passed: 5, failed: 0, sprintLabel: S1 },
]

// Item 1 (5 SP) com 2 Test Cases; item 2 (3 SP) compartilha o Test Case 10; item 3 tem Test Case sem execução; item 4 sem Test Case.
const ROWS = [item(1, 5, [10, 11]), item(2, 3, [10]), item(3, 8, [12]), item(4, 2, undefined)]

describe('itemExecutions', () => {
  it('soma os resultados executados dos Test Cases ligados, com re-testes, e separa pela sprint da execução', () => {
    const items = itemExecutions(ROWS, RUNS)
    expect(items.map((i) => [i.row.id, i.testCases, i.executions, i.passed, i.failed, i.perPoint])).toEqual([
      [1, 2, 6, 5, 1, 1.2],
      [2, 1, 4, 3, 1, 4 / 3],
      [3, 1, 0, 0, 0, null],
      [4, 0, 0, 0, 0, null],
    ])
    expect(Object.fromEntries(items[0].bySprint)).toEqual({ [S1]: { executed: 5, passed: 4, failed: 1 }, [S2]: { executed: 1, passed: 1, failed: 0 } })
  })

  it('soma os Test Cases das Tasks filhas do item, sem repetir', () => {
    const task = { ...item(50, 0, [10, 13]), workItemType: 'Task', parentId: 2 }
    const runs = [...RUNS, { testCaseId: 13, email: 'grace@x.com', executed: 2, passed: 2, failed: 0, sprintLabel: S1 }]
    const [, second] = itemExecutions(ROWS, runs, undefined, [...ROWS, task])
    // Item 2: Test Case 10 (dele e da Task, conta uma vez) + 13 da Task.
    expect([second.testCases, second.executions]).toEqual([2, 6])
  })

  it('com email, só as execuções da pessoa', () => {
    expect(itemExecutions(ROWS, RUNS, 'GRACE@x.com').map((i) => i.executions)).toEqual([5, 3, 0, 0])
  })
})

describe('executionsSummary / executionsBySprint', () => {
  it('média do período: execuções ÷ SP dos itens testados', () => {
    expect(executionsSummary(itemExecutions(ROWS, RUNS))).toEqual({
      testedItems: 2,
      testedPoints: 8,
      executions: 10,
      passed: 8,
      failed: 2,
      perPoint: 1.3,
    })
  })

  it('por sprint da execução: execuções feitas nela ÷ SP dos itens testados nela', () => {
    const sprints = executionsBySprint(itemExecutions(ROWS, RUNS))
    // S1: 5 + 3 execuções ÷ (5 + 3) SP; S2: 1 + 1 execuções (Test Case 10 compartilhado) ÷ (5 + 3) SP.
    expect(sprints.map((s) => [s.label, s.summary.executions, s.summary.testedPoints, s.summary.perPoint])).toEqual([
      [S1, 8, 8, 1],
      [S2, 2, 8, 0.3],
    ])
  })
})
