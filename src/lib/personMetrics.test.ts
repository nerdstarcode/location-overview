import { describe, expect, it } from 'vitest'
import type { LevelConfig } from './levelsStorage'
import type { Person } from './peopleStorage'
import type { PersonAllocation } from './personAllocationsStorage'
import {
  attributeDevPoints,
  computePeopleSummary,
  computePersonDevMetrics,
  computePersonQaMetrics,
  delayInfo,
  isPersonItem,
  peerAveragePerSprint,
  sizeDistribution,
} from './personMetrics'
import type { Sprint } from './sprintsStorage'
import type { TestExecution } from './testExecutionsStorage'
import { buildWorkItemRow, type WorkItemRow } from './workItems'

const POINT_TYPES = ['User Story', 'Bug', 'Enabler']

function row(raw: Record<string, unknown> & { parentId?: number; closedDate?: string }): WorkItemRow {
  const { parentId, closedDate, ...rest } = raw
  return {
    ...buildWorkItemRow({ iterationPath: 'Portal\\Sprint 08 - FY25-26', state: 'Closed', ...rest }),
    parentId,
    closedDate,
  }
}

const ada: Person = { id: 'p-ada', nome: 'Ada Lovelace', email: 'ada@example.com', cargo: 'Dev', nivel: 'SR', squadIds: ['sq1'] }
const alan: Person = { id: 'p-alan', nome: 'Alan Turing', email: 'alan@example.com', cargo: 'Dev', nivel: 'SR', squadIds: ['sq1'] }
const ADA = 'Ada Lovelace <ada@example.com>'
const ALAN = 'Alan Turing <alan@example.com>'

const s8: Sprint = { id: 's8', number: 8, fiscalYear: 'FY25-26', startDate: '2025-09-01', endDate: '2025-09-12', totalValidDays: 10 }
const s9: Sprint = { id: 's9', number: 9, fiscalYear: 'FY25-26', startDate: '2025-09-15', endDate: '2025-09-26', totalValidDays: 10 }
const sprintsByLabel = new Map([
  ['Sprint 08 - FY25-26', s8],
  ['Sprint 09 - FY25-26', s9],
])
const levels: LevelConfig[] = [{ nivel: 'SR', label: 'Sênior', capacityPointsDay: 1, maxPointsDay: 1.5 }]

describe('isPersonItem', () => {
  it('casa por email e, sem email, pelo nome', () => {
    expect(isPersonItem({ email: 'ADA@example.com ', assignedTo: 'Outro nome' }, ada)).toBe(true)
    expect(isPersonItem({ email: '', assignedTo: 'ada lovelace' }, ada)).toBe(true)
    expect(isPersonItem({ email: 'alan@example.com', assignedTo: 'Ada Lovelace' }, ada)).toBe(false)
  })
})

describe('delayInfo', () => {
  it('marca a tag Delayed e o fechamento depois do fim da sprint planejada', () => {
    // Planejado na sprint da tag (08) e entregue na do Iteration Path (09).
    const tagged = row({
      id: 1,
      iterationPath: 'Portal\\Sprint 09 - FY25-26',
      tags: 'Delayed; Sprint 08 - FY25-26',
      closedDate: '2025-09-18T10:00:00Z',
    })
    expect(delayInfo(tagged, sprintsByLabel)).toMatchObject({
      delayed: true,
      reason: 'tag',
      plannedSprint: 'Sprint 08 - FY25-26',
      deliverySprint: 'Sprint 09 - FY25-26',
      daysLate: 6,
    })
    const late = row({ id: 2, closedDate: '2025-09-15T10:00:00Z' })
    expect(delayInfo(late, sprintsByLabel)).toMatchObject({ delayed: true, reason: 'closedLate', daysLate: 3 })
    const onTime = row({ id: 3, closedDate: '2025-09-12T23:00:00Z' })
    expect(delayInfo(onTime, sprintsByLabel)).toMatchObject({ delayed: false, reason: null, daysLate: 0 })
  })
})

describe('attributeDevPoints', () => {
  const rows = [
    row({ id: 10, workItemType: 'User Story', assignedTo: ADA, storyPoints: 8 }),
    row({ id: 11, workItemType: 'Task', assignedTo: ADA, effort: 3, parentId: 10 }),
    row({ id: 12, workItemType: 'Task', assignedTo: ALAN, effort: 1, parentId: 10 }),
    row({ id: 20, workItemType: 'Bug', assignedTo: ALAN, storyPoints: 2 }),
    row({ id: 21, workItemType: 'Task', assignedTo: ADA, parentId: 20 }),
    row({ id: 22, workItemType: 'Task', assignedTo: ALAN, parentId: 20 }),
    row({ id: 30, workItemType: 'Enabler', assignedTo: ALAN, storyPoints: 3 }),
  ]

  it('Assigned To: pontos inteiros dos itens da pessoa', () => {
    expect(attributeDevPoints(rows, alan, 'assigned', POINT_TYPES, sprintsByLabel).map((i) => [i.row.id, i.points])).toEqual([
      [20, 2],
      [30, 3],
    ])
  })

  it('Tasks: rateio pelo Effort, por quantidade sem Effort e Assigned To sem Tasks', () => {
    expect(attributeDevPoints(rows, alan, 'tasks', POINT_TYPES, sprintsByLabel).map((i) => [i.row.id, i.points])).toEqual([
      [10, 2],
      [20, 1],
      [30, 3],
    ])
  })
})

describe('computePersonDevMetrics', () => {
  const rows = [
    row({
      id: 1,
      workItemType: 'User Story',
      assignedTo: ADA,
      storyPoints: 5,
      iterationPath: 'Backoffice\\Sprint 08 - FY25-26',
      closedDate: '2025-09-10T00:00:00Z',
    }),
    row({
      id: 2,
      workItemType: 'User Story',
      assignedTo: ADA,
      storyPoints: 3,
      iterationPath: 'Portal\\Sprint 09 - FY25-26',
      tags: 'Delayed; Sprint 08 - FY25-26',
    }),
    row({ id: 3, workItemType: 'Bug', assignedTo: ADA, storyPoints: 2, iterationPath: 'Portal\\Sprint 09 - FY25-26', state: 'Active' }),
    row({ id: 4, workItemType: 'User Story', assignedTo: ALAN, storyPoints: 4, closedDate: '2025-09-10T00:00:00Z' }),
  ]
  const allocations: PersonAllocation[] = [
    { id: 'a1', personId: 'p-ada', squadId: 'sq1', sprintId: 's8', percentage: 100 },
    { id: 'a2', personId: 'p-ada', squadId: 'sq1', sprintId: 's9', percentage: 50 },
  ]
  // Só "Portal" está cadastrada: o item 1 (Backoffice) cai em "Sem squad".
  const squads = [{ id: 'sq1', name: 'Portal' }]
  const base = { rows, sprints: [s8, s9], allocations, levels, squads, selectedSprints: [], mode: 'assigned' as const, pointTypes: POINT_TYPES }

  it('agrupa pela sprint planejada (a da tag Delayed), separa no prazo × atrasado e por squad', () => {
    const metrics = computePersonDevMetrics({ ...base, person: ada })
    expect(metrics.sprints).toEqual([
      {
        label: 'Sprint 08 - FY25-26',
        onTime: 5,
        delayed: 3,
        capacity: 10,
        max: 15,
        bySquad: { 'Sem squad': 5, Portal: 3 },
        byType: { 'User Story': 8 },
      },
      { label: 'Sprint 09 - FY25-26', onTime: 0, delayed: 0, capacity: 5, max: 7.5, bySquad: {}, byType: {} },
    ])
    expect(metrics.squadNames).toEqual(['Sem squad', 'Portal'])
    expect(metrics).toMatchObject({
      delivered: 8,
      delayedPoints: 3,
      averagePerSprint: 8,
      averageDelayedPerSprint: 3,
      delayedPercent: 37.5,
      itemsDelivered: 2,
      itemsOpen: 1,
      openPoints: 2,
      capacity: 15,
      capacityAdherence: 53.3,
    })
  })

  it('aderência só compara as sprints com alocação', () => {
    const unallocated = row({
      id: 5,
      workItemType: 'User Story',
      assignedTo: ADA,
      storyPoints: 20,
      iterationPath: 'Portal\\Sprint 10 - FY25-26',
    })
    const metrics = computePersonDevMetrics({ ...base, rows: [...rows, unallocated], person: ada })
    expect(metrics).toMatchObject({
      delivered: 28,
      deliveredOnAllocatedSprints: 8,
      allocatedSprints: 2,
      capacity: 15,
      capacityAdherence: 53.3,
    })
  })

  it('filtro de squad vale para itens (Iteration Path) e capacity (squad da alocação)', () => {
    const backoffice = { id: 'sq2', name: 'Backoffice' }
    const metrics = computePersonDevMetrics({
      ...base,
      squads: [...squads, backoffice],
      allocations: [...allocations, { id: 'a3', personId: 'p-ada', squadId: 'sq2', sprintId: 's8', percentage: 20 }],
      person: ada,
      selectedSquads: ['Backoffice'],
    })
    expect(metrics.delivered).toBe(5)
    expect(metrics.squadNames).toEqual(['Backoffice'])
    // Só a alocação de 20% na Backoffice: 2 dias × 1 SP/dia.
    expect(metrics.capacity).toBe(2)
  })

  it('distribui os itens entregues por tamanho (SP do item inteiro)', () => {
    const metrics = computePersonDevMetrics({ ...base, person: ada })
    expect(sizeDistribution(metrics.items)).toEqual([
      { bucket: 'Sem SP', count: 0 },
      { bucket: '1', count: 0 },
      { bucket: '2', count: 0 },
      { bucket: '3', count: 1 },
      { bucket: '5', count: 1 },
      { bucket: '8', count: 0 },
      { bucket: '13', count: 0 },
      { bucket: '13+', count: 0 },
    ])
  })

  it('resumo traz quem tem atividade nos filtros, com o tipo do cargo', () => {
    const idle: Person = { ...alan, id: 'p-idle', nome: 'Zé', email: 'ze@example.com' }
    const summary = computePeopleSummary({
      ...base,
      people: [idle, ada, alan],
      cargos: [{ id: 'c1', cargo: 'Dev', tipo: 'Dev', nivel: 'SR' }],
      executions: [],
    })
    expect(summary.map((r) => [r.person.nome, r.tipo, r.dev.delivered])).toEqual([
      ['Ada Lovelace', 'Dev', 8],
      ['Alan Turing', 'Dev', 4],
    ])
  })

  it('aderência conta no máximo o Max por sprint e sinaliza o excedente como sobrecarga', () => {
    const heavy = row({
      id: 7,
      workItemType: 'User Story',
      assignedTo: ADA,
      storyPoints: 13,
      iterationPath: 'Portal\\Sprint 09 - FY25-26',
    })
    const metrics = computePersonDevMetrics({ ...base, rows: [...rows, heavy], person: ada })
    // Sprint 09: 50% de 10 dias × 1,5 SP/dia = Max 7,5; entregou 13 → conta 7,5 e sobram 5,5.
    expect(metrics).toMatchObject({
      delivered: 21,
      deliveredOnAllocatedSprints: 15.5,
      capacity: 15,
      capacityAdherence: 103.3,
      overloadPoints: 5.5,
      overloadSprints: ['Sprint 09 - FY25-26'],
    })
  })

  it('filtra por ano fiscal', () => {
    const otherYear = row({
      id: 6,
      workItemType: 'User Story',
      assignedTo: ADA,
      storyPoints: 13,
      iterationPath: 'Portal\\Sprint 01 - FY26-27',
    })
    const metrics = computePersonDevMetrics({ ...base, rows: [...rows, otherYear], person: ada, selectedFiscalYears: ['FY26-27'] })
    expect(metrics.sprints.map((s) => s.label)).toEqual(['Sprint 01 - FY26-27'])
    expect(metrics.delivered).toBe(13)
  })

  it('"só sprints com alocação" ignora entrega e itens de sprint sem alocação da pessoa', () => {
    const unallocated = row({
      id: 5,
      workItemType: 'User Story',
      assignedTo: ADA,
      storyPoints: 20,
      iterationPath: 'Portal\\Sprint 10 - FY25-26',
    })
    const metrics = computePersonDevMetrics({ ...base, rows: [...rows, unallocated], person: ada, onlyAllocatedSprints: true })
    expect(metrics.sprints.map((s) => s.label)).toEqual(['Sprint 08 - FY25-26', 'Sprint 09 - FY25-26'])
    expect(metrics.delivered).toBe(8)
    expect(metrics.averagePerSprint).toBe(8)
  })

  it('respeita as sprints selecionadas', () => {
    const metrics = computePersonDevMetrics({ ...base, person: ada, selectedSprints: ['Sprint 09 - FY25-26'] })
    expect(metrics.sprints.map((s) => s.label)).toEqual(['Sprint 09 - FY25-26'])
    // O item atrasado foi planejado na 08, então não entra na 09; o Bug aberto da 09 sim.
    expect(metrics.delivered).toBe(0)
    expect(metrics.itemsOpen).toBe(1)
  })

  it('média dos pares ignora quem não entregou nada', () => {
    const outsider: Person = { ...alan, id: 'p-x', nome: 'X', email: 'x@example.com' }
    expect(peerAveragePerSprint({ ...base, peers: [alan, outsider] })).toBe(4)
  })
})

describe('computePersonQaMetrics', () => {
  const grace: Person = { id: 'p-grace', nome: 'Grace Hopper', email: 'grace@example.com', cargo: 'QA', nivel: 'SR', squadIds: [] }
  const executions: TestExecution[] = [
    { id: 'e1', squadId: 'sq1', sprintId: 's8', email: 'GRACE@example.com', name: 'Grace Hopper', executed: 10, passed: 8, failed: 1, other: 1 },
    { id: 'e2', squadId: 'sq1', sprintId: 's9', email: 'grace@example.com', name: 'Grace Hopper', executed: 6, passed: 6, failed: 0, other: 0 },
    { id: 'e3', squadId: 'sq1', sprintId: 's9', email: 'ada@example.com', name: 'Ada', executed: 99, passed: 99, failed: 0, other: 0 },
  ]
  const rows = [
    row({ id: 50, workItemType: 'Test Case', assignedTo: 'Grace Hopper <grace@example.com>', pontoExecucao: 18, runs: 2 }),
    row({ id: 51, workItemType: 'User Story', assignedTo: 'Grace Hopper <grace@example.com>', storyPoints: 5 }),
  ]

  it('soma execuções da pessoa por sprint e os Pontos de Execução dos Test Cases', () => {
    const metrics = computePersonQaMetrics({ person: grace, rows, sprints: [s8, s9], allocations: [], levels, selectedSprints: [], executions })
    expect(metrics).toMatchObject({
      executed: 16,
      passed: 14,
      failed: 1,
      averageExecutedPerSprint: 8,
      passedPercent: 87.5,
      executionPoints: 1,
      testCases: 1,
      capacityAdherence: null,
      hasExecutions: true,
    })
  })
})
