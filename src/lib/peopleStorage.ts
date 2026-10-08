import { readList, writeJson } from './localStore'

export interface Person {
  id: string
  nome: string
  email: string
  cargo: string
  nivel: string
  squadIds: string[]
}

const STORAGE_KEY = 'location-overview:people'

// Cargos vistos em "Alocação Sprint (1) - Copy (1).xlsx", usados como sugestão
// padrão (datalist) ao preencher o Cargo de uma pessoa — não é uma lista fechada.
export const CARGO_SUGGESTIONS = [
  'Administrative Auxiliar',
  'Associate SRE Analyst',
  'Associate Software Developer',
  'Associate Software Tester Quality',
  'Data Governance Analyst',
  'Estagiario',
  'Intern',
  'Learner',
  'Software Developer',
  'Sr Data Scientist',
  'Sr Software Developer',
  'Sr Software Tester Quality',
]

export function loadPeople(): Person[] {
  return readList<Person>(STORAGE_KEY)
}

export function savePeople(people: Person[]): void {
  writeJson(STORAGE_KEY, people)
}

/** Cria (sem id) ou atualiza (com id existente) uma pessoa, mantendo a lista ordenada por nome. */
export function upsertPerson(person: Person): Person[] {
  const people = loadPeople()
  const index = people.findIndex((p) => p.id === person.id)
  const next = index >= 0 ? people.map((p, i) => (i === index ? person : p)) : [...people, person]
  next.sort((a, b) => a.nome.localeCompare(b.nome))
  savePeople(next)
  return next
}

export function deletePerson(id: string): Person[] {
  const next = loadPeople().filter((p) => p.id !== id)
  savePeople(next)
  return next
}

/**
 * Sincroniza os membros de uma squad: garante que `personIds` (e só eles)
 * tenham `squadId` em `squadIds`. Fonte de verdade do vínculo pessoa↔squad é
 * sempre `Person.squadIds` — a tela de Squads só edita esse mesmo campo.
 */
export function setSquadMembers(squadId: string, personIds: string[]): Person[] {
  const memberSet = new Set(personIds)
  const next = loadPeople().map((person) => {
    const isMember = memberSet.has(person.id)
    const hasSquad = person.squadIds.includes(squadId)
    if (isMember === hasSquad) return person
    return {
      ...person,
      squadIds: isMember ? [...person.squadIds, squadId] : person.squadIds.filter((id) => id !== squadId),
    }
  })
  savePeople(next)
  return next
}

/** Vincula `squadId` a cada pessoa de `personIds` que ainda não o tenha, sem remover vínculos existentes. */
export function addPeopleToSquad(squadId: string, personIds: string[]): Person[] {
  const idSet = new Set(personIds)
  const next = loadPeople().map((person) =>
    idSet.has(person.id) && !person.squadIds.includes(squadId)
      ? { ...person, squadIds: [...person.squadIds, squadId] }
      : person,
  )
  savePeople(next)
  return next
}
