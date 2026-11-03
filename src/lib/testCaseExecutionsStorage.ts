import { readList, writeJson } from './localStore'

/**
 * Execuções de um Test Case por uma pessoa numa squad/sprint, a partir dos test results do Azure.
 * Junto com os Test Cases ligados (Tested By) a cada item, dá as execuções por story point.
 */
export interface TestCaseExecution {
  squadId: string
  sprintId: string
  testCaseId: number
  /** Quem executou (runBy); vazio nos runs automatizados sem responsável. */
  email: string
  name: string
  executed: number
  passed: number
  failed: number
}

const STORAGE_KEY = 'location-overview:test-case-executions'

export function loadTestCaseExecutions(): TestCaseExecution[] {
  return readList<TestCaseExecution>(STORAGE_KEY)
}

export function saveTestCaseExecutions(executions: TestCaseExecution[]): void {
  writeJson(STORAGE_KEY, executions)
}

/** Substitui as execuções da squad/sprint (a sincronização traz o retrato completo da sprint). */
export function replaceTestCaseExecutions(
  squadId: string,
  sprintId: string,
  incoming: Omit<TestCaseExecution, 'squadId' | 'sprintId'>[],
): TestCaseExecution[] {
  const next = [
    ...loadTestCaseExecutions().filter((e) => !(e.squadId === squadId && e.sprintId === sprintId)),
    ...incoming.map((entry) => ({ ...entry, squadId, sprintId })),
  ]
  saveTestCaseExecutions(next)
  return next
}
