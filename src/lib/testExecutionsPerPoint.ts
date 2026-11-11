import { round1 } from './numbers'
import { compareSprintLabels } from './personMetrics'
import { normalizeKey } from './text'
import type { WorkItemRow } from './workItems'

// Execuções de teste por story point: cada item de pontos (User Story, Bug, Enabler) soma os
// resultados executados dos Test Cases ligados a ele ou às Tasks filhas dele (Tested By), contando os re-testes. Cada
// execução fica na sprint da data em que foi executada; numa sprint, a média é execuções feitas nela
// ÷ SP dos itens testados nela (um item testado em duas sprints conta nas duas).

/** Execuções de um Test Case (por pessoa); o que a sincronização ou a análise ao vivo trazem. */
export interface TestCaseRun {
  testCaseId: number
  email: string
  executed: number
  passed: number
  failed: number
  /** Sprint da data de execução ("Sprint NN - FYxx-yy"); ausente na análise ao vivo de uma sprint. */
  sprintLabel?: string
}

interface Counts {
  executed: number
  passed: number
  failed: number
}

const ZERO: Counts = { executed: 0, passed: 0, failed: 0 }
const add = (a: Counts, b: Counts): Counts => ({ executed: a.executed + b.executed, passed: a.passed + b.passed, failed: a.failed + b.failed })

export interface ItemExecutions {
  row: WorkItemRow
  testCases: number
  executions: number
  passed: number
  failed: number
  /** Execuções ÷ story points do item; null sem SP ou sem execução. */
  perPoint: number | null
  /** Execuções por sprint da data de execução. */
  bySprint: Map<string, Counts>
}

/**
 * Execuções de cada item pelos Test Cases ligados a ele e às Tasks filhas dele (Parent = o item), que
 * vêm de `allRows`. Com `email`, só as execuções feitas por essa pessoa (visão individual de QA).
 */
export function itemExecutions(rows: WorkItemRow[], runs: TestCaseRun[], email?: string, allRows: WorkItemRow[] = rows): ItemExecutions[] {
  const childTestCases = new Map<number, number[]>()
  for (const child of allRows) {
    if (child.parentId === undefined || !child.testCaseIds?.length) continue
    childTestCases.set(child.parentId, [...(childTestCases.get(child.parentId) ?? []), ...child.testCaseIds])
  }
  const person = email ? normalizeKey(email) : null
  const byTestCase = new Map<number, TestCaseRun[]>()
  for (const run of runs) {
    if (person && normalizeKey(run.email) !== person) continue
    byTestCase.set(run.testCaseId, [...(byTestCase.get(run.testCaseId) ?? []), run])
  }
  return rows.map((row) => {
    // Sem repetir: o mesmo Test Case ligado à US e a uma Task dela conta uma vez.
    const ids = [...new Set([...(row.testCaseIds ?? []), ...(childTestCases.get(row.id) ?? [])])]
    const itemRuns = ids.flatMap((id) => byTestCase.get(id) ?? [])
    const totals = itemRuns.reduce<Counts>((sum, run) => add(sum, run), ZERO)
    const bySprint = new Map<string, Counts>()
    for (const run of itemRuns) {
      if (run.sprintLabel) bySprint.set(run.sprintLabel, add(bySprint.get(run.sprintLabel) ?? ZERO, run))
    }
    return {
      row,
      testCases: ids.length,
      executions: totals.executed,
      passed: totals.passed,
      failed: totals.failed,
      perPoint: totals.executed > 0 && row.storyPoints > 0 ? totals.executed / row.storyPoints : null,
      bySprint,
    }
  })
}

export interface ExecutionsSummary {
  /** Itens com pelo menos uma execução de Test Case ligado. */
  testedItems: number
  /** SP dos itens testados: o denominador da média. */
  testedPoints: number
  executions: number
  passed: number
  failed: number
  /** Execuções ÷ SP dos itens testados; null sem SP testado. */
  perPoint: number | null
}

function summarize(entries: { points: number; counts: Counts }[]): ExecutionsSummary {
  const tested = entries.filter((entry) => entry.counts.executed > 0)
  const points = tested.reduce((sum, entry) => sum + entry.points, 0)
  const counts = tested.reduce<Counts>((sum, entry) => add(sum, entry.counts), ZERO)
  return {
    testedItems: tested.length,
    testedPoints: round1(points),
    executions: counts.executed,
    passed: counts.passed,
    failed: counts.failed,
    perPoint: points > 0 ? round1(counts.executed / points) : null,
  }
}

/** Resumo do período: todas as execuções ÷ SP dos itens testados. */
export function executionsSummary(items: ItemExecutions[]): ExecutionsSummary {
  return summarize(items.map((item) => ({ points: item.row.storyPoints, counts: { executed: item.executions, passed: item.passed, failed: item.failed } })))
}

/** Resumo por sprint da data de execução: execuções feitas na sprint ÷ SP dos itens testados nela. */
export function executionsBySprint(items: ItemExecutions[]): { label: string; summary: ExecutionsSummary }[] {
  const labels = new Set(items.flatMap((item) => [...item.bySprint.keys()]))
  return [...labels]
    .map((label) => ({
      label,
      summary: summarize(items.map((item) => ({ points: item.row.storyPoints, counts: item.bySprint.get(label) ?? ZERO }))),
    }))
    .sort((a, b) => compareSprintLabels(a.label, b.label))
}
