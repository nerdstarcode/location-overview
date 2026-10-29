import { beforeEach, describe, expect, it } from 'vitest'
import type { Person } from './peopleStorage'
import {
  addPersonAllocations,
  buildDefaultAllocation,
  deletePersonAllocations,
  loadPersonAllocations,
  remainingPercentage,
  restorePersonAllocations,
  savePersonAllocations,
  setAllocationsPercentage,
  validateAllocationPercentages,
  type PersonAllocation,
} from './personAllocationsStorage'

const person = (id: string, nome: string, squadIds: string[]): Person => ({ id, nome, email: `${id}@x.com`, cargo: '', nivel: 'PL', squadIds })

const people = [person('p-bia', 'Bia', ['sqA']), person('p-ana', 'Ana', ['sqA', 'sqB']), person('p-caio', 'Caio', ['sqA']), person('p-davi', 'Davi', ['sqB'])]

const allocations: PersonAllocation[] = [
  { id: 'a1', personId: 'p-ana', squadId: 'sqB', sprintId: 's1', percentage: 60 },
  { id: 'a2', personId: 'p-caio', squadId: 'sqB', sprintId: 's1', percentage: 100 },
]

beforeEach(() => window.localStorage.clear())

describe('remainingPercentage', () => {
  it('é 100% menos o que a pessoa já tem na sprint, nunca negativo', () => {
    expect(remainingPercentage(allocations, 'p-ana', 's1')).toBe(40)
    expect(remainingPercentage(allocations, 'p-ana', 's2')).toBe(100)
    expect(remainingPercentage(allocations, 'p-ana', 's1', 'a1')).toBe(100)
    expect(remainingPercentage([...allocations, { ...allocations[1], id: 'a3', percentage: 20 }], 'p-caio', 's1')).toBe(0)
  })
})

describe('buildDefaultAllocation', () => {
  it('traz os membros da squad com o que sobra, e desmarca quem já está em 100%', () => {
    expect(buildDefaultAllocation(people, allocations, 'sqA', 's1')).toEqual([
      { personId: 'p-ana', percentage: 40, used: 60, selected: true },
      { personId: 'p-bia', percentage: 100, used: 0, selected: true },
      { personId: 'p-caio', percentage: 0, used: 100, selected: false },
    ])
  })

  it('deixa de fora quem já está no grupo', () => {
    const inGroup = [...allocations, { id: 'a3', personId: 'p-bia', squadId: 'sqA', sprintId: 's1', percentage: 50 }]
    expect(buildDefaultAllocation(people, inGroup, 'sqA', 's1').map((d) => d.personId)).toEqual(['p-ana', 'p-caio'])
  })
})

describe('validateAllocationPercentages', () => {
  it('recusa % fora de 0-100 e total acima de 100% na sprint', () => {
    const errors = validateAllocationPercentages(allocations, [
      { id: '', personId: 'p-ana', sprintId: 's1', percentage: 50 },
      { id: '', personId: 'p-bia', sprintId: 's1', percentage: 0 },
      { id: '', personId: 'p-davi', sprintId: 's1', percentage: 100 },
    ])
    expect(errors.get('p-ana')).toMatch(/60%/)
    expect(errors.get('p-bia')).toMatch(/maior que 0/)
    expect(errors.has('p-davi')).toBe(false)
  })

  it('ao editar, ignora o valor antigo do próprio registro', () => {
    expect(validateAllocationPercentages(allocations, [{ ...allocations[0], percentage: 100 }]).size).toBe(0)
  })
})

describe('lote, remoção e desfazer', () => {
  it('adiciona várias e recusa pessoa já alocada na mesma squad/sprint', () => {
    savePersonAllocations(allocations)
    const ok = addPersonAllocations([
      { personId: 'p-bia', squadId: 'sqA', sprintId: 's1', percentage: 100 },
      { personId: 'p-ana', squadId: 'sqA', sprintId: 's1', percentage: 40 },
    ])
    expect(ok.added).toHaveLength(2)
    expect(loadPersonAllocations()).toHaveLength(4)

    const dup = addPersonAllocations([{ personId: 'p-bia', squadId: 'sqA', sprintId: 's1', percentage: 10 }])
    expect(dup.duplicates).toHaveLength(1)
    expect(loadPersonAllocations()).toHaveLength(4)
  })

  it('remove e devolve as removidas para o desfazer', () => {
    savePersonAllocations(allocations)
    const { removed } = deletePersonAllocations(['a1', 'a2'])
    expect(loadPersonAllocations()).toEqual([])
    restorePersonAllocations(removed)
    expect(loadPersonAllocations()).toEqual(allocations)
    restorePersonAllocations(removed)
    expect(loadPersonAllocations()).toHaveLength(2)
  })

  it('define a mesma % para várias, sem gravar se alguém passar de 100%', () => {
    savePersonAllocations([...allocations, { id: 'a3', personId: 'p-ana', squadId: 'sqA', sprintId: 's1', percentage: 40 }])
    expect(setAllocationsPercentage(['a3'], 70).errors.get('p-ana')).toMatch(/60%/)
    expect(loadPersonAllocations().find((a) => a.id === 'a3')?.percentage).toBe(40)
    expect(setAllocationsPercentage(['a1', 'a3'], 50).errors.size).toBe(0)
    expect(loadPersonAllocations().filter((a) => a.personId === 'p-ana').map((a) => a.percentage)).toEqual([50, 50])
  })
})
