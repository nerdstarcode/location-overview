import { round1 } from './numbers'
import { compareSprintLabels, plannedSprintLabel } from './personMetrics'
import { normalizeKey } from './text'
import type { WorkItemRow } from './workItems'

// Execuções de teste por story point: cada item de pontos (User Story, Bug, Enabler) soma os
// resultados executados dos Test Cases ligados a ele (Tested By), em qualquer sprint, contando os
// re-testes. Execuções ÷ SP dos itens com Test Case dá a média de execuções por story point.

/** Execuções de um Test Case (por pessoa); o que a sincronização ou a análise ao vivo trazem. */
export interface TestCaseRun {
  testCaseId: number
  email: string
  executed: number
  passed: number
  failed: number
}

export interface ItemExecutions {
  row: WorkItemRow
  testCases: number
  executions: number
  passed: number
  failed: number
  /** Execuções ÷ story points do item; null sem SP ou sem Test Case ligado. */
  perPoint: number | null
}

/**
 * Execuções de cada item pelos Test Cases ligados. Com `email`, só as execuções feitas por essa
 * pessoa (visão individual de QA).
 */
export function itemExecutions(rows: WorkItemRow[], runs: TestCaseRun[], email?: string): ItemExecutions[] {
  const person = email ? normalizeKey(email) : null
  const byTestCase = new Map<number, { executed: number; passed: number; failed: number }>()
  for (const run of runs) {
    if (person && normalizeKey(run.email) !== person) continue
    const entry = byTestCase.get(run.testCaseId) ?? { executed: 0, passed: 0, failed: 0 }
    byTestCase.set(run.testCaseId, { executed: entry.executed + run.executed, passed: entry.passed + run.passed, failed: entry.failed + run.failed })
  }
  return rows.map((row) => {
    const ids = row.testCaseIds ?? []
    const totals = ids.reduce(
      (sum, id) => {
        const entry = byTestCase.get(id)
        return entry ? { executed: sum.executed + entry.executed, passed: sum.passed + entry.passed, failed: sum.failed + entry.failed } : sum
      },
      { executed: 0, passed: 0, failed: 0 },
    )
    return {
      row,
      testCases: ids.length,
      executions: totals.executed,
      passed: totals.passed,
      failed: totals.failed,
      perPoint: ids.length > 0 && row.storyPoints > 0 ? totals.executed / row.storyPoints : null,
    }
  })
}

export interface ExecutionsSummary {
  items: number
  /** Itens com pelo menos um Test Case ligado (Tested By). */
  itemsWithTests: number
  points: number
  /** SP dos itens com Test Case: o denominador da média. */
  pointsWithTests: number
  executions: number
  passed: number
  failed: number
  /** Execuções ÷ SP dos itens com Test Case; null sem SP com Test Case. */
  perPoint: number | null
}

export function executionsSummary(items: ItemExecutions[]): ExecutionsSummary {
  const withTests = items.filter((item) => item.testCases > 0)
  const sum = (list: ItemExecutions[], pick: (item: ItemExecutions) => number) => list.reduce((total, item) => total + pick(item), 0)
  const pointsWithTests = sum(withTests, (item) => item.row.storyPoints)
  const executions = sum(withTests, (item) => item.executions)
  return {
    items: items.length,
    itemsWithTests: withTests.length,
    points: round1(sum(items, (item) => item.row.storyPoints)),
    pointsWithTests: round1(pointsWithTests),
    executions,
    passed: sum(withTests, (item) => item.passed),
    failed: sum(withTests, (item) => item.failed),
    perPoint: pointsWithTests > 0 ? round1(executions / pointsWithTests) : null,
  }
}

/** Resumo por sprint planejada (coluna Sprint), em ordem cronológica. */
export function executionsBySprint(items: ItemExecutions[]): { label: string; summary: ExecutionsSummary }[] {
  const bySprint = new Map<string, ItemExecutions[]>()
  for (const item of items) {
    const label = plannedSprintLabel(item.row)
    if (label) bySprint.set(label, [...(bySprint.get(label) ?? []), item])
  }
  return [...bySprint.entries()]
    .map(([label, list]) => ({ label, summary: executionsSummary(list) }))
    .sort((a, b) => compareSprintLabels(a.label, b.label))
}
