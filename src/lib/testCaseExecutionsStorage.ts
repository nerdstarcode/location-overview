import { readList, writeJson } from './localStore'

/**
 * Execuções de um Test Case por uma pessoa numa squad/sprint, a partir dos test results do Azure.
 * Junto com os Test Cases ligados (Tested By) a cada item, dá as execuções por story point.
 */
export interface TestCaseExecution {
  squadId: string
  /** Sprint da data em que o Test Case foi executado. */
  sprintId: string
  /** Sprint sincronizada que trouxe a execução (ausente nos registros antigos: a própria sprintId). */
  sourceSprintId?: string
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

/**
 * Substitui as execuções que a sincronização da squad/sprint `sourceSprintId` trouxe (o retrato
 * completo daquela sprint), cada uma já na sprint da data de execução.
 */
export function replaceTestCaseExecutions(
  squadId: string,
  sourceSprintId: string,
  incoming: Omit<TestCaseExecution, 'squadId' | 'sourceSprintId'>[],
): TestCaseExecution[] {
  const next = [
    ...loadTestCaseExecutions().filter((e) => !(e.squadId === squadId && (e.sourceSprintId ?? e.sprintId) === sourceSprintId)),
    ...incoming.map((entry) => ({ ...entry, squadId, sourceSprintId })),
  ]
  saveTestCaseExecutions(next)
  return next
}
