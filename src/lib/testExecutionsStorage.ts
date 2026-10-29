import { createId } from './createId'
import { readList, writeJson } from './localStore'
import { normalizeKey } from './text'

/** Testes executados por uma pessoa numa squad/sprint, a partir dos test results do Azure (runBy). */
export interface TestExecution {
  id: string
  squadId: string
  sprintId: string
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
 * Substitui as execuções da squad/sprint pelas de `incoming` (a sincronização traz o
 * retrato completo da sprint), mantendo o id de quem já existia.
 */
export function replaceTestExecutions(
  squadId: string,
  sprintId: string,
  incoming: Omit<TestExecution, 'id' | 'squadId' | 'sprintId'>[],
): TestExecution[] {
  const all = loadTestExecutions()
  const isTarget = (e: TestExecution) => e.squadId === squadId && e.sprintId === sprintId
  const previousByEmail = new Map(all.filter(isTarget).map((e) => [normalizeKey(e.email), e.id]))
  const next = [
    ...all.filter((e) => !isTarget(e)),
    ...incoming.map((entry) => ({ ...entry, id: previousByEmail.get(normalizeKey(entry.email)) ?? createId(), squadId, sprintId })),
  ]
  saveTestExecutions(next)
  return next
}
