import { loadPeople, savePeople } from './peopleStorage'
import { loadPersonAllocations, savePersonAllocations } from './personAllocationsStorage'
import { squadNames } from './squadMatching'
import { loadSquads, saveSquads } from './squadsStorage'
import { loadTestReports, saveTestReports } from './testReportsStorage'
import { normalizeKey } from './text'

export interface SquadMergeResult {
  allocationsMoved: number
  /** Alocações da squad absorvida descartadas por já existir uma da mesma pessoa+sprint na principal. */
  allocationsDiscarded: number
  testReportsMoved: number
  testReportsDiscarded: number
}

/** Remove nomes repetidos (sem diferenciar maiúsculas/espaços) e o próprio nome principal. */
export function dedupeAliases(name: string, aliases: string[]): string[] {
  const seen = new Set([normalizeKey(name)])
  const result: string[] = []
  for (const alias of aliases.map((a) => a.trim()).filter(Boolean)) {
    const key = normalizeKey(alias)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(alias)
  }
  return result
}

/**
 * Absorve a squad `sourceId` em `targetId`: o nome e os aliases da source viram
 * aliases da target, e alocações, relatórios de teste e vínculos de pessoas
 * passam para a target. Em conflito (mesma pessoa+sprint, ou mesma sprint no
 * relatório), mantém o registro da target e descarta o da source.
 */
export function mergeSquads(sourceId: string, targetId: string): SquadMergeResult {
  const squads = loadSquads()
  const source = squads.find((s) => s.id === sourceId)
  const target = squads.find((s) => s.id === targetId)
  if (!source || !target || sourceId === targetId) {
    return { allocationsMoved: 0, allocationsDiscarded: 0, testReportsMoved: 0, testReportsDiscarded: 0 }
  }

  const merged = { ...target, aliases: dedupeAliases(target.name, [...(target.aliases ?? []), ...squadNames(source)]) }
  saveSquads(squads.filter((s) => s.id !== sourceId).map((s) => (s.id === targetId ? merged : s)))

  const allocations = loadPersonAllocations()
  const targetAllocationKeys = new Set(
    allocations.filter((a) => a.squadId === targetId).map((a) => `${a.personId}::${a.sprintId}`),
  )
  let allocationsMoved = 0
  let allocationsDiscarded = 0
  const nextAllocations = allocations.flatMap((a) => {
    if (a.squadId !== sourceId) return [a]
    if (targetAllocationKeys.has(`${a.personId}::${a.sprintId}`)) {
      allocationsDiscarded += 1
      return []
    }
    allocationsMoved += 1
    return [{ ...a, squadId: targetId }]
  })
  savePersonAllocations(nextAllocations)

  const reports = loadTestReports()
  const targetSprintIds = new Set(reports.filter((r) => r.squadId === targetId).map((r) => r.sprintId))
  let testReportsMoved = 0
  let testReportsDiscarded = 0
  const nextReports = reports.flatMap((r) => {
    if (r.squadId !== sourceId) return [r]
    if (targetSprintIds.has(r.sprintId)) {
      testReportsDiscarded += 1
      return []
    }
    testReportsMoved += 1
    return [{ ...r, squadId: targetId }]
  })
  saveTestReports(nextReports)

  savePeople(
    loadPeople().map((person) =>
      person.squadIds.includes(sourceId)
        ? {
            ...person,
            squadIds: [...new Set(person.squadIds.map((id) => (id === sourceId ? targetId : id)))],
          }
        : person,
    ),
  )

  return { allocationsMoved, allocationsDiscarded, testReportsMoved, testReportsDiscarded }
}
