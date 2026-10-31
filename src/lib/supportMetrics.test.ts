import { describe, expect, it } from 'vitest'
import type { CargoConfig } from './cargosStorage'
import type { Person } from './peopleStorage'
import type { PersonAllocation } from './personAllocationsStorage'
import type { PersonSupport } from './personSupportsStorage'
import type { Sprint } from './sprintsStorage'
import { devLoadBySprint, loadWithSupport, supportBySprint, supportersOf, supportTotalsByPerson, type LoadBySprint } from './supportMetrics'

const sprint = (id: string, number: number): Sprint => ({
  id,
  number,
  fiscalYear: 'FY25-26',
  startDate: '2026-01-01',
  endDate: '2026-01-21',
  totalValidDays: 10,
})
const sprints = [sprint('s1', 1), sprint('s2', 2)]
const S1 = 'Sprint 01 - FY25-26'
const S2 = 'Sprint 02 - FY25-26'

const person = (id: string, nome: string, cargo = 'Dev'): Person => ({ id, nome, email: `${id}@x.com`, cargo, nivel: 'PL', squadIds: [] })
const people = [person('ana', 'Ana'), person('bia', 'Bia'), person('caio', 'Caio'), person('duda', 'Duda', 'Tester')]
const cargos: CargoConfig[] = [
  { id: 'c1', cargo: 'Dev', tipo: 'Dev', nivel: 'PL' },
  { id: 'c2', cargo: 'Tester', tipo: 'QA', nivel: 'PL' },
]
const allocations: PersonAllocation[] = people.flatMap((p) =>
  sprints.map((s) => ({ id: `${p.id}-${s.id}`, personId: p.id, squadId: p.id === 'caio' ? 'sqB' : 'sqA', sprintId: s.id, percentage: 100 })),
)
const context = { allocations, people, cargos }

const supports: PersonSupport[] = [
  { id: '1', supporterId: 'ana', supportedId: 'bia', sprintId: 's1', percentage: 25 },
  { id: '2', supporterId: 'ana', supportedId: 'caio', sprintId: 's1', percentage: 10 },
  { id: '3', supporterId: 'ana', supportedId: 'bia', sprintId: 's2', percentage: 50 },
  // Inválido (QA × não-QA): fica fora do cálculo.
  { id: '4', supporterId: 'ana', supportedId: 'duda', sprintId: 's1', percentage: 50 },
  // De outra pessoa.
  { id: '5', supporterId: 'bia', supportedId: 'caio', sprintId: 's1', percentage: 50 },
]

const loads: Record<string, LoadBySprint> = {
  bia: new Map([
    [S1, 20],
    [S2, 8],
  ]),
  caio: new Map([[S1, 30]]),
  duda: new Map([[S1, 40]]),
}
const loadOf = (personId: string) => loads[personId] ?? new Map()

describe('supportBySprint', () => {
  it('converte a % em pontos sobre a carga de cada apoiado, só com apoios válidos', () => {
    const support = supportBySprint('ana', supports, sprints, context, loadOf)
    expect(support.get(S1)).toEqual({
      points: 8,
      detail: [
        { personId: 'bia', nome: 'Bia', percentage: 25, base: 20, points: 5 },
        { personId: 'caio', nome: 'Caio', percentage: 10, base: 30, points: 3 },
      ],
    })
    expect(support.get(S2)?.points).toBe(4)
    expect(supportTotalsByPerson(support)).toEqual([
      { personId: 'bia', nome: 'Bia', points: 9 },
      { personId: 'caio', nome: 'Caio', points: 3 },
    ])
  })

  it('ignora o apoio quando o apoiado deixa de estar alocado na sprint', () => {
    const withoutBia = { ...context, allocations: allocations.filter((a) => !(a.personId === 'bia' && a.sprintId === 's1')) }
    expect(supportBySprint('ana', supports, sprints, withoutBia, loadOf).get(S1)?.points).toBe(3)
  })
})

describe('loadWithSupport', () => {
  const base = { capacity: 30, max: 40, maxExtended: 52 }
  const xSprints = [
    { label: S1, ...base, load: 22 },
    { label: S2, ...base, load: 20 },
  ]
  const support = supportBySprint('ana', supports, sprints, context, loadOf)

  it('soma o apoio como crédito: abaixo do previsto vira dentro no total, com previsto e máximo intactos', () => {
    const real = loadWithSupport(xSprints, (s) => s.load, new Map())
    const withSupport = loadWithSupport(xSprints, (s) => s.load, support)
    expect(real.loadStatus).toBe('below')
    expect(real.sprintStatusCounts.below).toBe(2)
    expect(withSupport).toMatchObject({
      loadStatus: 'within',
      supportPoints: 12,
      deliveredOnAllocatedSprintsRaw: 54,
      capacity: 60,
      maxCapacity: 80,
    })
    // S1: 22 + 8 = 30 (dentro); S2: 20 + 4 = 24 (abaixo de 27).
    expect(withSupport.sprintStatusCounts).toMatchObject({ within: 1, below: 1 })
    expect(withSupport.capacityAdherence).toBe(90)
  })

  it('aplica a extensão e a sobrecarga sobre a carga com apoio', () => {
    const heavy = [{ label: S1, ...base, load: 48 }]
    const result = loadWithSupport(heavy, (s) => s.load, support)
    expect(result).toMatchObject({ loadStatus: 'overload', overloadPoints: 4, extensionUsedPoints: 12, overloadSprints: [S1] })
  })
})

describe('supportersOf / devLoadBySprint', () => {
  it('lista quem apoia a pessoa nas sprints do filtro', () => {
    expect(supportersOf('bia', supports, sprints, context, new Set([S2]))).toEqual([
      { personId: 'ana', nome: 'Ana', percentage: 50, sprintLabel: S2 },
    ])
  })

  it('carga de dev = entregue + em andamento', () => {
    const metrics = { sprints: [{ label: S1, onTime: 5, delayed: 2, inProgress: 3, inProgressDelayed: 1 }] }
    expect(devLoadBySprint(metrics as never).get(S1)).toBe(11)
  })
})
