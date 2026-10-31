import { isQaPerson } from './azure/sprintMetrics'
import type { CargoConfig } from './cargosStorage'
import { createId } from './createId'
import { readList, writeJson } from './localStore'
import type { Person } from './peopleStorage'
import type { PersonAllocation } from './personAllocationsStorage'

// Apoio (mentoria) entre pessoas numa sprint: `supporterId` dedica `percentage`% a apoiar
// `supportedId`. A % vira pontos sobre a carga do apoiado (ver supportMetrics) e entra como
// crédito no status "com apoio" de quem apoia; os números do apoiado não mudam.

export interface PersonSupport {
  id: string
  supporterId: string
  supportedId: string
  sprintId: string
  percentage: number
}

export type SupportDraft = Omit<PersonSupport, 'id'>

/** Atalhos de intensidade do apoio. */
export const SUPPORT_PRESETS = [
  { label: 'Leve', percentage: 10 },
  { label: 'Médio', percentage: 25 },
  { label: 'Intenso', percentage: 50 },
]

const STORAGE_KEY = 'location-overview:person-supports'

export function loadPersonSupports(): PersonSupport[] {
  return readList<PersonSupport>(STORAGE_KEY)
}

export function savePersonSupports(supports: PersonSupport[]): void {
  writeJson(STORAGE_KEY, supports)
}

export interface SupportContext {
  allocations: PersonAllocation[]
  people: Person[]
  cargos: CargoConfig[]
}

const isAllocated = (allocations: PersonAllocation[], personId: string, sprintId: string) =>
  allocations.some((a) => a.personId === personId && a.sprintId === sprintId && a.percentage > 0)

/**
 * Por que um apoio guardado não vale (pessoa desalocada da sprint, QA × não-QA após troca de
 * cargo); null quando vale. Apoios com aviso ficam guardados, mas fora do cálculo.
 */
export function supportIssue(support: SupportDraft, context: SupportContext): string | null {
  const supporter = context.people.find((p) => p.id === support.supporterId)
  const supported = context.people.find((p) => p.id === support.supportedId)
  if (!supporter || !supported) return 'Pessoa não cadastrada.'
  for (const person of [supporter, supported]) {
    if (!isAllocated(context.allocations, person.id, support.sprintId)) return `${person.nome} não está alocado nesta sprint.`
  }
  if (isQaPerson(supporter, context.cargos) !== isQaPerson(supported, context.cargos)) {
    return 'Apoio entre QA e não-QA não é permitido.'
  }
  return null
}

/** Erro do cadastro de um apoio novo; null quando pode gravar. */
export function validateSupportDraft(draft: SupportDraft, supports: PersonSupport[], context: SupportContext): string | null {
  if (!draft.supporterId || !draft.supportedId) return 'Escolha quem apoia e quem é apoiado.'
  if (draft.supporterId === draft.supportedId) return 'Uma pessoa não pode apoiar a si mesma.'
  if (!(draft.percentage > 0 && draft.percentage <= 100)) return 'A % deve ser maior que 0 e no máximo 100.'
  const duplicate = supports.some(
    (s) => s.sprintId === draft.sprintId && s.supporterId === draft.supporterId && s.supportedId === draft.supportedId,
  )
  if (duplicate) return 'Esse apoio já está cadastrado nesta sprint.'
  return supportIssue(draft, context)
}

/** Grava um apoio novo (já validado). */
export function addPersonSupport(draft: SupportDraft): PersonSupport[] {
  const next = [...loadPersonSupports(), { ...draft, id: createId() }]
  savePersonSupports(next)
  return next
}

/** Remove vários apoios; devolve também os removidos, para o "Desfazer". */
export function deletePersonSupports(ids: string[]): { supports: PersonSupport[]; removed: PersonSupport[] } {
  const idSet = new Set(ids)
  const all = loadPersonSupports()
  const next = all.filter((s) => !idSet.has(s.id))
  savePersonSupports(next)
  return { supports: next, removed: all.filter((s) => idSet.has(s.id)) }
}

/** Devolve apoios removidos (o "Desfazer"), sem duplicar os que ainda existam. */
export function restorePersonSupports(entries: PersonSupport[]): PersonSupport[] {
  const supports = loadPersonSupports()
  const ids = new Set(supports.map((s) => s.id))
  const next = [...supports, ...entries.filter((entry) => !ids.has(entry.id))]
  savePersonSupports(next)
  return next
}

export function setSupportPercentage(id: string, percentage: number): PersonSupport[] {
  const next = loadPersonSupports().map((s) => (s.id === id ? { ...s, percentage } : s))
  savePersonSupports(next)
  return next
}

/**
 * Copia para `toSprintId` os apoios de `fromSprintId` que ainda não existem lá. Os que ficarem
 * inválidos (pessoa não alocada na nova sprint) são copiados mesmo assim e aparecem com aviso.
 */
export function copySupportsFromSprint(fromSprintId: string, toSprintId: string): { supports: PersonSupport[]; copied: number } {
  const supports = loadPersonSupports()
  const pairKey = (s: SupportDraft) => `${s.supporterId}|${s.supportedId}`
  const existing = new Set(supports.filter((s) => s.sprintId === toSprintId).map(pairKey))
  const copies = supports
    .filter((s) => s.sprintId === fromSprintId && !existing.has(pairKey(s)))
    .map((s) => ({ ...s, id: createId(), sprintId: toSprintId }))
  const next = [...supports, ...copies]
  savePersonSupports(next)
  return { supports: next, copied: copies.length }
}
