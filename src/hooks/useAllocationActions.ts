import { useState } from 'react'
import { addPeopleToSquad, loadPeople, type Person } from '../lib/peopleStorage'
import {
  addPersonAllocations,
  deletePersonAllocations,
  loadPersonAllocations,
  moveAllocationsToSquad,
  restorePersonAllocations,
  setAllocationsPercentage,
  sumPercentageForPersonInSprint,
  upsertPersonAllocation,
  type PersonAllocation,
} from '../lib/personAllocationsStorage'

// Estado de alocações + pessoas e as ações rápidas (lote, remover/desfazer, % e mover),
// compartilhados pela aba Sprints e pela aba Alocação. Cada ação devolve a mensagem de
// erro, ou null quando gravou.
export function useAllocationActions() {
  const [allocations, setAllocations] = useState<PersonAllocation[]>(loadPersonAllocations)
  const [people, setPeople] = useState<Person[]>(loadPeople)
  const nameOf = (personId: string) => people.find((p) => p.id === personId)?.nome ?? '—'

  /** Grava um lote de alocações (todas da mesma squad/sprint). */
  function addEntries(entries: Omit<PersonAllocation, 'id'>[]): string | null {
    if (entries.length === 0) return null
    for (const entry of entries) {
      if (!(entry.percentage > 0 && entry.percentage <= 100)) return `${nameOf(entry.personId)}: a % deve ser maior que 0 e no máximo 100.`
      const used = sumPercentageForPersonInSprint(allocations, entry.personId, entry.sprintId)
      if (used + entry.percentage > 100) return `${nameOf(entry.personId)} já tem ${used}% nesta sprint; o total passaria de 100%.`
    }
    const { allocations: next, duplicates } = addPersonAllocations(entries)
    if (duplicates.length > 0) return `Já alocados nesta squad e sprint: ${duplicates.map((d) => nameOf(d.personId)).join(', ')}.`
    // Quem veio de fora da squad passa a ser membro dela.
    setPeople(addPeopleToSquad(entries[0].squadId, entries.map((e) => e.personId)))
    setAllocations(next)
    return null
  }

  /** Remove e devolve as removidas, para o "Desfazer". */
  function removeEntries(ids: string[]): PersonAllocation[] {
    const { allocations: next, removed } = deletePersonAllocations(ids)
    setAllocations(next)
    return removed
  }

  function restoreEntries(entries: PersonAllocation[]) {
    setAllocations(restorePersonAllocations(entries))
  }

  function setPercentage(ids: string[], percentage: number): string | null {
    const { allocations: next, errors } = setAllocationsPercentage(ids, percentage)
    if (errors.size > 0) return [...errors].map(([personId, message]) => `${nameOf(personId)}: ${message}`).join(' ')
    setAllocations(next)
    return null
  }

  function moveEntries(ids: string[], squadId: string): string | null {
    const { allocations: next, conflicts } = moveAllocationsToSquad(ids, squadId)
    if (conflicts.length > 0) {
      return `Já alocados na squad destino nessa sprint: ${conflicts.map((c) => nameOf(c.personId)).join(', ')}. Remova ou ajuste essas alocações antes.`
    }
    setPeople(addPeopleToSquad(squadId, allocations.filter((a) => ids.includes(a.id)).map((a) => a.personId)))
    setAllocations(next)
    return null
  }

  /** Salva a edição de uma alocação (squad, sprint e %). */
  function saveEdit(entry: PersonAllocation): string | null {
    if (!entry.squadId || !entry.sprintId) return 'Squad e Sprint são obrigatórios.'
    if (entry.percentage <= 0 || entry.percentage > 100) return 'Porcentagem deve ser maior que 0 e no máximo 100.'
    const duplicate = allocations.some(
      (a) => a.id !== entry.id && a.personId === entry.personId && a.squadId === entry.squadId && a.sprintId === entry.sprintId,
    )
    if (duplicate) return 'Essa pessoa já está alocada nessa squad e sprint.'
    const otherPercentage = sumPercentageForPersonInSprint(allocations, entry.personId, entry.sprintId, entry.id)
    if (otherPercentage + entry.percentage > 100) {
      return `Essa pessoa já tem ${otherPercentage}% alocados em outras squads nessa sprint — o total passaria de 100%.`
    }
    setAllocations(upsertPersonAllocation(entry))
    setPeople(addPeopleToSquad(entry.squadId, [entry.personId]))
    return null
  }

  return { allocations, people, addEntries, removeEntries, restoreEntries, setPercentage, moveEntries, saveEdit }
}
