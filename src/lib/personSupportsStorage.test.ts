import { beforeEach, describe, expect, it } from 'vitest'
import type { CargoConfig } from './cargosStorage'
import type { Person } from './peopleStorage'
import type { PersonAllocation } from './personAllocationsStorage'
import {
  addPersonSupport,
  copySupportsFromSprint,
  deletePersonSupports,
  loadPersonSupports,
  restorePersonSupports,
  savePersonSupports,
  setSupportPercentage,
  supportIssue,
  validateSupportDraft,
  type PersonSupport,
} from './personSupportsStorage'

const person = (id: string, nome: string, cargo: string): Person => ({ id, nome, email: `${id}@x.com`, cargo, nivel: 'PL', squadIds: [] })

const people = [person('ana', 'Ana', 'Sr Dev'), person('bia', 'Bia', 'Dev'), person('caio', 'Caio', 'Tester')]
const cargos: CargoConfig[] = [
  { id: 'c1', cargo: 'Sr Dev', tipo: 'Dev', nivel: 'SR' },
  { id: 'c2', cargo: 'Dev', tipo: 'Dev', nivel: 'PL' },
  { id: 'c3', cargo: 'Tester', tipo: 'QA', nivel: 'PL' },
]
const allocation = (personId: string, squadId: string, sprintId = 's1'): PersonAllocation => ({ id: `${personId}-${squadId}-${sprintId}`, personId, squadId, sprintId, percentage: 100 })
const allocations = [allocation('ana', 'sqA'), allocation('bia', 'sqB'), allocation('caio', 'sqA')]
const context = { allocations, people, cargos }

const draft = { supporterId: 'ana', supportedId: 'bia', sprintId: 's1', percentage: 25 }

beforeEach(() => window.localStorage.clear())

describe('validateSupportDraft', () => {
  it('aceita apoio entre squads diferentes, com os dois alocados', () => {
    expect(validateSupportDraft(draft, [], context)).toBeNull()
  })

  it('recusa autoapoio, % fora de 1–100, par repetido, QA × não-QA e pessoa não alocada', () => {
    expect(validateSupportDraft({ ...draft, supportedId: 'ana' }, [], context)).toMatch(/a si mesma/)
    expect(validateSupportDraft({ ...draft, percentage: 0 }, [], context)).toMatch(/maior que 0/)
    expect(validateSupportDraft({ ...draft, percentage: 101 }, [], context)).toMatch(/no máximo 100/)
    expect(validateSupportDraft(draft, [{ ...draft, id: 'x' }], context)).toMatch(/já está cadastrado/)
    expect(validateSupportDraft({ ...draft, supportedId: 'caio' }, [], context)).toMatch(/QA e não-QA/)
    expect(validateSupportDraft({ ...draft, sprintId: 's2' }, [], context)).toMatch(/Ana não está alocado/)
  })
})

describe('supportIssue', () => {
  it('avisa quando alguém deixa de estar alocado, sem apagar o apoio', () => {
    expect(supportIssue(draft, context)).toBeNull()
    expect(supportIssue(draft, { ...context, allocations: allocations.filter((a) => a.personId !== 'bia') })).toBe(
      'Bia não está alocado nesta sprint.',
    )
  })
})

describe('storage', () => {
  it('adiciona, ajusta a %, remove e desfaz', () => {
    const [added] = addPersonSupport(draft)
    expect(loadPersonSupports()).toEqual([{ ...draft, id: added.id }])
    setSupportPercentage(added.id, 50)
    expect(loadPersonSupports()[0].percentage).toBe(50)

    const { supports, removed } = deletePersonSupports([added.id])
    expect(supports).toEqual([])
    restorePersonSupports(removed)
    restorePersonSupports(removed)
    expect(loadPersonSupports()).toEqual([{ ...draft, id: added.id, percentage: 50 }])
  })

  it('copia da sprint anterior só os pares que ainda não existem', () => {
    const existing: PersonSupport[] = [
      { ...draft, id: 'a' },
      { ...draft, id: 'b', supportedId: 'caio', percentage: 10 },
      { ...draft, id: 'c', sprintId: 's2', percentage: 50 },
    ]
    savePersonSupports(existing)
    const { supports, copied } = copySupportsFromSprint('s1', 's2')
    expect(copied).toBe(1)
    expect(supports.filter((s) => s.sprintId === 's2').map((s) => [s.supportedId, s.percentage])).toEqual([
      ['bia', 50],
      ['caio', 10],
    ])
  })
})
