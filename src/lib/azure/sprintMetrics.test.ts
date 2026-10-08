import { describe, expect, it } from 'vitest'
import { DEFAULT_LEVELS } from '../levelsStorage'
import type { WorkItemRow } from '../workItems'
import {
  FIXTURE_ALLOCATIONS,
  FIXTURE_ALLOCATION,
  FIXTURE_BURNUP,
  FIXTURE_BY_STATE,
  FIXTURE_BY_TYPE,
  FIXTURE_MEMBERS,
  FIXTURE_PEOPLE,
  FIXTURE_POINT_TYPES,
  FIXTURE_POINTS_BY_PERSON,
  FIXTURE_SPRINT,
  FIXTURE_TOTAL_POINTS,
  FIXTURE_USER_STORIES,
  FIXTURE_WORK_ITEMS,
} from './sprintFixtures'
import {
  allocationComparison,
  computeSprintMetrics,
  isQaPerson,
  classifyQaRange,
  sprintAllocation,
  totalEffort,
  totalStoryPoints,
  unassignedByType,
  UNASSIGNED_LABEL,
} from './sprintMetrics'

const statusOf = (name: string) => FIXTURE_ALLOCATION.find((row) => row.name === name)?.status

describe('totalStoryPoints', () => {
  it('soma só os tipos configurados (Tasks não entram)', () => {
    expect(FIXTURE_TOTAL_POINTS).toBe(33)
    expect(totalStoryPoints(FIXTURE_WORK_ITEMS, ['Task'])).toBe(0)
  })
})

describe('pointsByPerson', () => {
  it('agrupa por email e separa o bucket sem responsável', () => {
    const { people, unassigned } = FIXTURE_POINTS_BY_PERSON
    expect(people.map((p) => [p.name, p.storyPoints, p.deliveredPoints])).toEqual([
      ['Ada Lovelace', 10, 10],
      ['Alan Turing', 10, 5],
      ['Grace Hopper', 8, 5],
    ])
    expect(unassigned).toMatchObject({ name: UNASSIGNED_LABEL, storyPoints: 5, itemCount: 2 })
  })
})

describe('burnup', () => {
  it('tem um ponto por dia útil', () => {
    expect(FIXTURE_BURNUP).toHaveLength(10)
    expect(FIXTURE_BURNUP.at(-1)?.ideal).toBe(33)
  })

  it('joga fechamentos de fim de semana para o próximo dia útil', () => {
    // Bug 104 fechado no sábado 06/09 → entra na segunda 08/09.
    expect(FIXTURE_BURNUP.find((p) => p.day === '2025-09-08')?.delivered).toBe(2)
  })

  it('acumula até hoje e deixa dias futuros como null', () => {
    expect(FIXTURE_BURNUP.find((p) => p.day === '2025-09-10')?.cumulative).toBe(15)
    expect(FIXTURE_BURNUP.find((p) => p.day === '2025-09-11')?.cumulative).toBeNull()
  })
})

describe('agrupamentos', () => {
  it('ordena tipos pela configuração e states pela ordem do fluxo', () => {
    expect(FIXTURE_BY_TYPE.map((t) => [t.key, t.storyPoints, t.count])).toEqual([
      ['User Story', 23, 4],
      ['Bug', 5, 2],
      ['Enabler', 5, 2],
      ['Task', 0, 5],
    ])
    expect(FIXTURE_BY_STATE.map((s) => s.key)).toEqual(['New', 'Active', 'Testing QA', 'Closed'])
  })

  it('conta as tasks filhas de cada User Story, Bug e Enabler', () => {
    expect(FIXTURE_USER_STORIES.map((us) => [us.id, us.workItemType, us.tasks, us.tasksDone])).toEqual([
      [101, 'User Story', 2, 2],
      [103, 'User Story', 2, 0],
      [102, 'User Story', 1, 1],
      [104, 'Bug', 0, 0],
      [105, 'Bug', 0, 0],
      [106, 'Enabler', 0, 0],
      [107, 'Enabler', 0, 0],
      [108, 'User Story', 0, 0],
    ])
  })
})

describe('allocationComparison', () => {
  it('compara devs com capacity/max e a Faixa QA do QA com o capacity/max dele', () => {
    expect(statusOf('Ada Lovelace')).toBe('abaixo') // SR 100%: capacity 15, 10 SP
    expect(statusOf('Alan Turing')).toBe('acima') // PL 50%: max 7.5, 10 SP
    // SR 100%: capacity 15 / max 20; Faixa QA 6.6–9.9 começa abaixo do capacity.
    const grace = FIXTURE_ALLOCATION.find((row) => row.name === 'Grace Hopper')
    expect(grace).toMatchObject({ isQa: true, expectedMin: 6.6, expectedMax: 9.9, status: 'abaixo' })
  })

  it('divide a Faixa QA entre os QAs proporcionalmente ao Capacity', () => {
    // JR 100% (10 dias × 0.5) = 5 · SR 100% (10 dias × 1.5) = 15 → 25% e 75% da faixa 20–30 SP.
    const people = [
      { ...FIXTURE_PEOPLE[2], id: 'q1', nome: 'QA Jr', email: 'qa1@example.com', nivel: 'JR' },
      { ...FIXTURE_PEOPLE[2], id: 'q2', nome: 'QA Sr', email: 'qa2@example.com', nivel: 'SR' },
    ]
    const rows = allocationComparison({
      members: [],
      personPoints: [],
      totalPoints: 100,
      people,
      allocations: [
        { id: 'x1', personId: 'q1', squadId: 'sq1', sprintId: 's8', percentage: 100 },
        { id: 'x2', personId: 'q2', squadId: 'sq1', sprintId: 's8', percentage: 100 },
      ],
      levels: DEFAULT_LEVELS,
      cargos: [],
      squadId: 'sq1',
      sprint: FIXTURE_SPRINT,
      qaMinPercent: 20,
      qaMaxPercent: 30,
    })
    expect(rows.find((r) => r.name === 'QA Jr')).toMatchObject({ capacity: 5, expectedMin: 5, expectedMax: 7.5 })
    expect(rows.find((r) => r.name === 'QA Sr')).toMatchObject({ capacity: 15, expectedMin: 15, expectedMax: 22.5 })
  })

  it('QA sem alocação fica "sem alocação", mantendo a Faixa QA', () => {
    const rows = allocationComparison({
      members: FIXTURE_MEMBERS,
      personPoints: FIXTURE_POINTS_BY_PERSON.people,
      totalPoints: 33,
      people: FIXTURE_PEOPLE,
      allocations: FIXTURE_ALLOCATIONS.filter((a) => a.personId !== 'p3'),
      levels: DEFAULT_LEVELS,
      cargos: [],
      squadId: 'sq1',
      sprint: FIXTURE_SPRINT,
      qaMinPercent: 20,
      qaMaxPercent: 30,
    })
    expect(rows.find((r) => r.name === 'Grace Hopper')).toMatchObject({ status: 'sem-alocacao', expectedMin: 6.6, expectedMax: 9.9 })
  })

  it('marca quem não está cadastrado ou não tem alocação', () => {
    const outsider: WorkItemRow = { ...FIXTURE_WORK_ITEMS[0], id: 999, assignedTo: 'Linus', email: 'linus@example.com' }
    const rows = allocationComparison({
      members: FIXTURE_MEMBERS,
      personPoints: [{ name: 'Linus', email: outsider.email, storyPoints: 3, deliveredPoints: 0, itemCount: 1 }],
      totalPoints: 33,
      people: FIXTURE_PEOPLE,
      allocations: FIXTURE_ALLOCATIONS.filter((a) => a.personId !== 'p1'),
      levels: DEFAULT_LEVELS,
      cargos: [],
      squadId: 'sq1',
      sprint: FIXTURE_SPRINT,
      qaMinPercent: 20,
      qaMaxPercent: 30,
    })
    expect(rows.find((r) => r.name === 'Linus')).toMatchObject({ isMember: false, status: 'sem-cadastro' })
    expect(rows.find((r) => r.name === 'Ada Lovelace')?.status).toBe('sem-alocacao')
  })

  it('inclui quem está alocado na squad/sprint mesmo fora do team e sem SP', () => {
    const rows = allocationComparison({
      members: FIXTURE_MEMBERS.slice(0, 2),
      personPoints: [],
      totalPoints: 33,
      people: FIXTURE_PEOPLE,
      allocations: FIXTURE_ALLOCATIONS,
      levels: DEFAULT_LEVELS,
      cargos: [],
      squadId: 'sq1',
      sprint: FIXTURE_SPRINT,
      qaMinPercent: 20,
      qaMaxPercent: 30,
    })
    expect(rows.find((r) => r.name === 'Grace Hopper')).toMatchObject({ isMember: false, percentage: 100, assigned: 0 })
  })
})

describe('unassignedByType', () => {
  it('conta os itens sem responsável por tipo, incluindo Tasks', () => {
    const items = [...FIXTURE_WORK_ITEMS, { ...FIXTURE_WORK_ITEMS[8], id: 299, assignedTo: '', email: '' }]
    expect(unassignedByType(items, FIXTURE_POINT_TYPES).map((g) => [g.key, g.count, g.storyPoints])).toEqual([
      ['Bug', 1, 3],
      ['Enabler', 1, 2],
      ['Task', 1, 0],
    ])
  })
})

describe('totalEffort', () => {
  it('soma o Effort só dos tipos que somam Story Points', () => {
    const items = [
      { ...FIXTURE_WORK_ITEMS[0], effort: 5 },
      { ...FIXTURE_WORK_ITEMS[3], effort: 2.5 },
      { ...FIXTURE_WORK_ITEMS[8], effort: 100 }, // Task: fica de fora
    ]
    expect(totalEffort(items, FIXTURE_POINT_TYPES)).toBe(7.5)
  })
})

describe('classifyQaRange', () => {
  it('compara a Faixa QA com capacity 7.5 / max 10', () => {
    expect(classifyQaRange(7.5, 10, 7.5, 10)).toBe('dentro')
    expect(classifyQaRange(7, 9, 7.5, 10)).toBe('abaixo')
    expect(classifyQaRange(8, 12, 7.5, 10)).toBe('acima')
    expect(classifyQaRange(6, 12, 7.5, 10)).toBe('acima')
  })
})

describe('sprintAllocation', () => {
  const input = { people: FIXTURE_PEOPLE, allocations: FIXTURE_ALLOCATIONS, levels: DEFAULT_LEVELS, squadId: 'sq1', sprint: FIXTURE_SPRINT }

  it('soma capacity/max de quem está alocado na squad/sprint', () => {
    const summary = sprintAllocation(input, FIXTURE_POINTS_BY_PERSON.people)
    // Ada SR 100% (10 dias): 15/20 · Alan PL 50% (5 dias): 5/7.5 · Grace SR 100%: 15/20
    expect(summary).toMatchObject({ capacity: 35, max: 47.5 })
    expect(summary.entries.find((e) => e.name === 'Alan Turing')).toMatchObject({ percentage: 50, days: 5, assigned: 10 })
  })

  it('fica vazio sem squad ou sprint local', () => {
    expect(sprintAllocation({ ...input, squadId: undefined }, [])).toEqual({ entries: [], capacity: 0, max: 0, missingLevel: 0 })
  })

  it('soma alocações repetidas da mesma pessoa, casa nível sem diferenciar maiúsculas e sinaliza quem fica sem nível', () => {
    const summary = sprintAllocation(
      {
        ...input,
        people: [{ ...FIXTURE_PEOPLE[0], nivel: 'sr ' }, { ...FIXTURE_PEOPLE[1], nivel: '' }],
        allocations: [
          { id: 'x1', personId: 'p1', squadId: 'sq1', sprintId: 's8', percentage: 50 },
          { id: 'x2', personId: 'p1', squadId: 'sq1', sprintId: 's8', percentage: 50 },
          { id: 'x3', personId: 'p2', squadId: 'sq1', sprintId: 's8', percentage: 100 },
        ],
      },
      [],
    )
    expect(summary).toMatchObject({ capacity: 15, max: 20, missingLevel: 1 })
    expect(summary.entries.find((e) => e.personId === 'p1')).toMatchObject({ percentage: 100, missingLevel: false })
  })
})

describe('isQaPerson', () => {
  const person = FIXTURE_PEOPLE[0]

  it('usa o Tipo do cargo cadastrado quando existe', () => {
    expect(isQaPerson(person, [{ id: 'c', cargo: person.cargo, tipo: 'QA', nivel: 'SR' }])).toBe(true)
  })

  it('cai para o nome do cargo quando não há cadastro', () => {
    expect(isQaPerson({ ...person, cargo: 'Software Tester' }, [])).toBe(true)
    expect(isQaPerson(person, [])).toBe(false)
  })
})

describe('computeSprintMetrics', () => {
  it('soma os entregues de todo mundo, inclusive sem responsável', () => {
    const metrics = computeSprintMetrics({
      items: FIXTURE_WORK_ITEMS,
      pointTypes: FIXTURE_POINT_TYPES,
      workingDays: [],
      testRuns: undefined,
      members: FIXTURE_MEMBERS,
      people: FIXTURE_PEOPLE,
      allocations: FIXTURE_ALLOCATIONS,
      levels: DEFAULT_LEVELS,
      cargos: [],
      qaMinPercent: 20,
      qaMaxPercent: 30,
    })
    expect(metrics.totalPoints).toBe(33)
    expect(metrics.deliveredPoints).toBe(20)
    expect(metrics.testRuns).toBeNull()
  })

  it('tira os itens ocultos (e as Tasks filhas) dos números, mas mantém na tabela marcados', () => {
    const items = FIXTURE_WORK_ITEMS.map((item) => (item.id === 101 ? { ...item, effort: 4 } : item))
    const metrics = computeSprintMetrics({
      items,
      pointTypes: FIXTURE_POINT_TYPES,
      workingDays: [],
      testRuns: undefined,
      members: FIXTURE_MEMBERS,
      people: FIXTURE_PEOPLE,
      allocations: FIXTURE_ALLOCATIONS,
      levels: DEFAULT_LEVELS,
      cargos: [],
      qaMinPercent: 20,
      qaMaxPercent: 30,
      hiddenIds: new Set([101]),
    })
    expect(metrics.totalPoints).toBe(25) // 33 - 8 da 101
    expect(metrics.totalEffort).toBe(0)
    expect(metrics.byPerson.find((p) => p.name === 'Ada Lovelace')?.storyPoints).toBe(2)
    expect(metrics.userStories.find((us) => us.id === 101)).toMatchObject({ hidden: true, tasks: 2 })
    expect(metrics.userStories.filter((us) => us.hidden)).toHaveLength(1)
  })
})
