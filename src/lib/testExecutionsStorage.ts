import { createId } from './createId'
import { readList, writeJson } from './localStore'
import { normalizeKey } from './text'

/** Testes executados por uma pessoa numa squad/sprint, a partir dos test results do Azure (runBy). */
export interface TestExecution {
  id: string
  squadId: string
  /** Sprint da data em que os testes foram executados. */
  sprintId: string
  /** Sprint sincronizada que trouxe a execução (ausente nos registros antigos: a própria sprintId). */
  sourceSprintId?: string
  email: string
  name: string
  executed: number
  passed: number
  failed: number
  other: number
}

const STORAGE_KEY = 'location-overview:test-executions'

export function loadTestExecutions(): TestExecution[] {
  return readList<TestExecution>(STORAGE_KEY)
}

export function saveTestExecutions(executions: TestExecution[]): void {
  writeJson(STORAGE_KEY, executions)
}

/**
 * Substitui as execuções que a sincronização da squad/sprint `sourceSprintId` trouxe pelas de
 * `incoming` (o retrato completo daquela sprint), cada uma já na sprint da data de execução,
 * mantendo o id de quem já existia.
 */
export function replaceTestExecutions(
  squadId: string,
  sourceSprintId: string,
  incoming: Omit<TestExecution, 'id' | 'squadId' | 'sourceSprintId'>[],
): TestExecution[] {
  const all = loadTestExecutions()
  const isTarget = (e: TestExecution) => e.squadId === squadId && (e.sourceSprintId ?? e.sprintId) === sourceSprintId
  const keyOf = (e: Pick<TestExecution, 'sprintId' | 'email'>) => `${e.sprintId}|${normalizeKey(e.email)}`
  const previousIds = new Map(all.filter(isTarget).map((e) => [keyOf(e), e.id]))
  const next = [
    ...all.filter((e) => !isTarget(e)),
    ...incoming.map((entry) => ({ ...entry, id: previousIds.get(keyOf(entry)) ?? createId(), squadId, sourceSprintId })),
  ]
  saveTestExecutions(next)
  return next
}
