import { createId } from './createId'
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

// ---------------------------------------------------------------------------
// Criação e edição rápida (alocação padrão da squad, lote, desfazer)

/** O que sobra para a pessoa na sprint: 100% menos o que ela já tem nas outras squads. */
export function remainingPercentage(
  allocations: PersonAllocation[],
  personId: string,
  sprintId: string,
  excludeId?: string,
): number {
  return Math.max(0, 100 - sumPercentageForPersonInSprint(allocations, personId, sprintId, excludeId))
}

export interface AllocationDraft {
  personId: string
  percentage: number
  /** % que a pessoa já tem em outras squads nesta sprint. */
  used: number
  selected: boolean
}

/**
 * Alocação padrão de uma squad numa sprint: cada membro (`Person.squadIds`) que ainda não está
 * no grupo, com o que sobra para ele na sprint. Quem já está em 100% vem desmarcado.
 */
export function buildDefaultAllocation(
  people: Person[],
  allocations: PersonAllocation[],
  squadId: string,
  sprintId: string,
): AllocationDraft[] {
  const inGroup = new Set(allocations.filter((a) => a.squadId === squadId && a.sprintId === sprintId).map((a) => a.personId))
  return people
    .filter((person) => person.squadIds.includes(squadId) && !inGroup.has(person.id))
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((person) => {
      const used = sumPercentageForPersonInSprint(allocations, person.id, sprintId)
      const percentage = Math.max(0, 100 - used)
      return { personId: person.id, percentage, used, selected: percentage > 0 }
    })
}

/**
 * Valida a % de alocações novas ou editadas de uma sprint (cada uma com `id` vazio quando nova).
 * Devolve a mensagem de erro por `personId`; vazio = tudo certo.
 */
export function validateAllocationPercentages(
  allocations: PersonAllocation[],
  changes: Pick<PersonAllocation, 'id' | 'personId' | 'sprintId' | 'percentage'>[],
): Map<string, string> {
  const errors = new Map<string, string>()
  const changedIds = new Set(changes.map((c) => c.id).filter(Boolean))
  for (const change of changes) {
    if (!(change.percentage > 0 && change.percentage <= 100)) {
      errors.set(change.personId, 'A % deve ser maior que 0 e no máximo 100.')
      continue
    }
    const others =
      allocations
        .filter((a) => a.personId === change.personId && a.sprintId === change.sprintId && !changedIds.has(a.id))
        .reduce((sum, a) => sum + a.percentage, 0) +
      changes
        .filter((c) => c !== change && c.personId === change.personId && c.sprintId === change.sprintId)
        .reduce((sum, c) => sum + c.percentage, 0)
    if (others + change.percentage > 100) {
      errors.set(change.personId, `Já tem ${others}% nesta sprint; o total passaria de 100%.`)
    }
  }
  return errors
}

/**
 * Insere várias alocações de uma vez. Recusa (retorna `duplicates`, sem gravar nada) se alguma
 * pessoa já estiver alocada na mesma squad/sprint.
 */
export function addPersonAllocations(
  entries: Omit<PersonAllocation, 'id'>[],
): { allocations: PersonAllocation[]; added: PersonAllocation[]; duplicates: Omit<PersonAllocation, 'id'>[] } {
  const allocations = loadPersonAllocations()
  const keyOf = (a: Omit<PersonAllocation, 'id'>) => `${a.personId}|${a.squadId}|${a.sprintId}`
  const existing = new Set(allocations.map(keyOf))
  const duplicates = entries.filter((entry) => existing.has(keyOf(entry)))
  if (duplicates.length > 0) return { allocations, added: [], duplicates }

  const added = entries.map((entry) => ({ ...entry, id: createId() }))
  const next = [...allocations, ...added]
  savePersonAllocations(next)
  return { allocations: next, added, duplicates: [] }
}

/** Remove várias alocações; devolve também as removidas, para o "Desfazer". */
export function deletePersonAllocations(ids: string[]): { allocations: PersonAllocation[]; removed: PersonAllocation[] } {
  const idSet = new Set(ids)
  const all = loadPersonAllocations()
  const next = all.filter((a) => !idSet.has(a.id))
  savePersonAllocations(next)
  return { allocations: next, removed: all.filter((a) => idSet.has(a.id)) }
}

/** Devolve alocações removidas (o "Desfazer"), sem duplicar as que ainda existam. */
export function restorePersonAllocations(entries: PersonAllocation[]): PersonAllocation[] {
  const allocations = loadPersonAllocations()
  const ids = new Set(allocations.map((a) => a.id))
  const next = [...allocations, ...entries.filter((entry) => !ids.has(entry.id))]
  savePersonAllocations(next)
  return next
}

/** Define a mesma % para várias alocações, validando o total de cada pessoa na sprint. */
export function setAllocationsPercentage(
  ids: string[],
  percentage: number,
): { allocations: PersonAllocation[]; errors: Map<string, string> } {
  const allocations = loadPersonAllocations()
  const idSet = new Set(ids)
  const changes = allocations.filter((a) => idSet.has(a.id)).map((a) => ({ ...a, percentage }))
  const errors = validateAllocationPercentages(allocations, changes)
  if (errors.size > 0) return { allocations, errors }

  const next = allocations.map((a) => (idSet.has(a.id) ? { ...a, percentage } : a))
  savePersonAllocations(next)
  return { allocations: next, errors }
}
