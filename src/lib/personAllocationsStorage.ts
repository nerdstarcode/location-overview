import { readList, writeJson } from './localStore'
import { round1 } from './numbers'
import type { LevelConfig } from './levelsStorage'
import type { Person } from './peopleStorage'
import type { Sprint } from './sprintsStorage'

export interface PersonAllocation {
  id: string
  personId: string
  squadId: string
  sprintId: string
  percentage: number
}

const STORAGE_KEY = 'location-overview:person-allocations'

export function loadPersonAllocations(): PersonAllocation[] {
  return readList<PersonAllocation>(STORAGE_KEY)
}

export function savePersonAllocations(allocations: PersonAllocation[]): void {
  writeJson(STORAGE_KEY, allocations)
}

/** Cria (sem id) ou atualiza (com id existente) uma alocação. */
export function upsertPersonAllocation(allocation: PersonAllocation): PersonAllocation[] {
  const allocations = loadPersonAllocations()
  const index = allocations.findIndex((a) => a.id === allocation.id)
  const next = index >= 0 ? allocations.map((a, i) => (i === index ? allocation : a)) : [...allocations, allocation]
  savePersonAllocations(next)
  return next
}

export function deletePersonAllocation(id: string): PersonAllocation[] {
  const next = loadPersonAllocations().filter((a) => a.id !== id)
  savePersonAllocations(next)
  return next
}

/** Soma as porcentagens de uma pessoa entre todas as squads dela numa sprint, ignorando `excludeId` (o registro em edição). */
export function sumPercentageForPersonInSprint(
  allocations: PersonAllocation[],
  personId: string,
  sprintId: string,
  excludeId?: string,
): number {
  return allocations
    .filter((a) => a.personId === personId && a.sprintId === sprintId && a.id !== excludeId)
    .reduce((sum, a) => sum + a.percentage, 0)
}

/** Dias que a pessoa tem disponíveis na squad/sprint, a partir do total de dias válidos da sprint. */
export function computeAllocatedDays(percentage: number, totalValidDays: number): number {
  return round1((percentage / 100) * totalValidDays)
}

/** Capacity/max points de uma alocação individual: dias alocados × capacity/max points/day do nível da pessoa. */
export function pointsForEntry(
  entry: Pick<PersonAllocation, 'percentage'>,
  sprint: Pick<Sprint, 'totalValidDays'>,
  person: Person | undefined,
  levels: LevelConfig[],
): { capacity: number; max: number } {
  const dias = computeAllocatedDays(entry.percentage, sprint.totalValidDays)
  const level = findLevelFor(person, levels)
  if (!level) return { capacity: 0, max: 0 }
  return { capacity: dias * level.capacityPointsDay, max: dias * level.maxPointsDay }
}

/** Nível cadastrado da pessoa, sem diferenciar maiúsculas nem espaços (ex.: "sr " → "SR"). */
export function findLevelFor(person: Pick<Person, 'nivel'> | undefined, levels: LevelConfig[]): LevelConfig | undefined {
  const key = person?.nivel.trim().toLowerCase()
  return key ? levels.find((l) => l.nivel.trim().toLowerCase() === key) : undefined
}

/**
 * Move de uma vez as alocações `ids` para a squad `squadId`. Recusa (retorna
 * `conflicts`) se alguma pessoa já tiver alocação na squad destino na mesma sprint.
 */
export function moveAllocationsToSquad(
  ids: string[],
  squadId: string,
): { allocations: PersonAllocation[]; conflicts: PersonAllocation[] } {
  const allocations = loadPersonAllocations()
  const idSet = new Set(ids)
  const moving = allocations.filter((a) => idSet.has(a.id))
  const conflicts = moving.filter((entry) =>
    allocations.some(
      (a) => !idSet.has(a.id) && a.squadId === squadId && a.sprintId === entry.sprintId && a.personId === entry.personId,
    ),
  )
  if (conflicts.length > 0) return { allocations, conflicts }

  const next = allocations.map((a) => (idSet.has(a.id) ? { ...a, squadId } : a))
  savePersonAllocations(next)
  return { allocations: next, conflicts: [] }
}
