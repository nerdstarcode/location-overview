import { describe, expect, it } from 'vitest'
import type { WorkItemRow } from '../workItems'
import type { Person } from '../peopleStorage'
import { buildDaily, classifyQaTop, type DailyInput } from './dailyView'

const POINT_TYPES = ['User Story', 'Bug']

function item(partial: Partial<WorkItemRow> & Pick<WorkItemRow, 'id' | 'workItemType'>): WorkItemRow {
  return {
    title: `Item ${partial.id}`,
    assignedTo: '',
    email: '',
    state: 'Active',
    tags: '',
    iterationPath: 'Portal\\Sprint 08 - FY25-26',
    sprint: 'Sprint 08',
    fiscalYear: 'FY25-26',
    storyPoints: 0,
    effort: 0,
    timeCriticality: 0,
    wsjf: 0,
    pontoExecucao: 0,
    runs: 0,
    isDelayed: false,
    ...partial,
  }
}

const ada = { assignedTo: 'Ada', email: 'ada@x.com' }
const qa = { assignedTo: 'Quinn', email: 'quinn@x.com' }
const person = (id: string, nome: string, email: string, cargo = 'Dev'): Person => ({ id, nome, email, cargo, nivel: 'PL', squadIds: [] })

const SPRINT = { id: 's8', number: 8, fiscalYear: 'FY25-26', startDate: '', endDate: '', totalValidDays: 10 }
const PORTAL = { id: 'sq-portal', name: 'Portal' }
const BILLING = { id: 'sq-billing', name: 'Billing' }

const LIVE: WorkItemRow[] = [
  item({ id: 1, workItemType: 'User Story', ...ada, testCaseIds: [900] }),
  item({ id: 11, workItemType: 'Task', parentId: 1, ...ada, state: 'Closed' }),
  item({ id: 12, workItemType: 'Task', parentId: 1, ...qa, state: 'New' }),
  item({ id: 13, workItemType: 'Task', parentId: 1, state: 'New' }),
  item({ id: 2, workItemType: 'User Story', state: 'New' }),
  item({ id: 3, workItemType: 'User Story', ...ada, state: 'Closed' }),
  item({ id: 20, workItemType: 'Task', ...ada }),
]

function input(overrides: Partial<DailyInput['base']> = {}): DailyInput {
  return {
    liveItems: LIVE,
    liveSquadName: 'Portal',
    localSquad: PORTAL,
    localSprint: SPRINT,
    pointTypes: POINT_TYPES,
    qaMinPercent: 50,
    qaMaxPercent: 100,
    base: {
      workItems: [item({ id: 50, workItemType: 'User Story', iterationPath: 'Billing\\Sprint 08 - FY25-26', ...ada })],
      squads: [PORTAL, BILLING],
      sprints: [SPRINT],
      people: [person('p-ada', 'Ada', 'ada@x.com'), person('p-quinn', 'Quinn', 'quinn@x.com', 'QA'), person('p-bob', 'Bob', 'bob@x.com')],
      allocations: [
        { id: 'a1', personId: 'p-ada', squadId: 'sq-portal', sprintId: 's8', percentage: 60 },
        { id: 'a2', personId: 'p-ada', squadId: 'sq-billing', sprintId: 's8', percentage: 40 },
        { id: 'a3', personId: 'p-bob', squadId: 'sq-portal', sprintId: 's8', percentage: 100 },
      ],
      cargos: [],
      levels: [],
      testCaseExecutions: [{ squadId: 'sq-portal', sprintId: 's8', testCaseId: 900, email: 'quinn@x.com', name: 'Quinn', executed: 3, passed: 2, failed: 1 }],
      ...overrides,
    },
  }
}

describe('classifyQaTop', () => {
  it('uses the top of the QA range against capacity and max', () => {
    expect(classifyQaTop(17.4, 13.5, 18)).toBe('dentro')
    expect(classifyQaTop(12, 13.5, 18)).toBe('abaixo')
    expect(classifyQaTop(19, 13.5, 18)).toBe('acima')
  })
})

describe('buildDaily', () => {
  const view = buildDaily(input())

  it('lists allocated people and anyone with items, alphabetically', () => {
    expect(view.people.map((p) => p.name)).toEqual(['Ada', 'Bob', 'Quinn'])
  })

  it('shows allocation across squads with the other squad from the local base', () => {
    const ada = view.people.find((p) => p.name === 'Ada')!
    expect(ada.squads.map((s) => [s.name, s.percentage, s.hasData])).toEqual([
      ['Portal', 60, true],
      ['Billing', 40, true],
    ])
    expect(ada.squads[1].stories.map((s) => s.row?.id)).toEqual([50])
  })

  it('groups by story with all its tasks in state columns, closed stories and "Sem US" last', () => {
    const portal = view.people.find((p) => p.name === 'Ada')!.squads[0]
    expect(portal.stories.map((s) => s.row?.id ?? null)).toEqual([1, 3, null])
    expect(portal.stories[0].columns.map((c) => c.state)).toEqual(['New', 'Closed'])
    expect(portal.stories[0]).toMatchObject({ done: 1, total: 3 })
    expect(portal).toMatchObject({ openTasks: 1, totalTasks: 2 })
  })

  it('includes stories where the person only has a task, with test cases for QAs', () => {
    const quinn = view.people.find((p) => p.name === 'Quinn')!
    expect(quinn.isQa).toBe(true)
    expect(quinn.squads[0].stories[0].testCases).toEqual([{ id: 900, title: '', state: '', assignedTo: '', email: '', executed: 3, passed: 2, failed: 1 }])
    expect(view.people.find((p) => p.name === 'Ada')!.squads[0].stories[0].testCases).toBeUndefined()
  })

  it('shows QAs every story of the squad with linked test cases, even without their tasks', () => {
    const view = buildDaily({ ...input(), liveItems: LIVE.filter((row) => row.id !== 12) })
    const quinn = view.people.find((p) => p.name === 'Quinn')
    expect(quinn).toBeUndefined()
    const allocated = buildDaily({
      ...input({
        allocations: [{ id: 'q', personId: 'p-quinn', squadId: 'sq-portal', sprintId: 's8', percentage: 100 }],
      }),
      liveItems: LIVE.filter((row) => row.id !== 12),
    })
    expect(allocated.people.find((p) => p.name === 'Quinn')!.squads[0].stories.map((s) => s.row?.id)).toEqual([1])
  })

  it('bases the QA range on stories whose linked test cases are assigned to the QA', () => {
    const base = input({ allocations: [{ id: 'q', personId: 'p-quinn', squadId: 'sq-portal', sprintId: 's8', percentage: 100 }] })
    const withoutTc = buildDaily(base).people.find((p) => p.name === 'Quinn')!.squads[0]
    expect(withoutTc.assigned).toBe(0)
    const view = buildDaily({ ...base, testCases: [item({ id: 900, workItemType: 'Test Case', ...qa })] })
    const squad = view.people.find((p) => p.name === 'Quinn')!.squads[0]
    expect(squad).toMatchObject({ assigned: 0 })
    const withPoints = buildDaily({
      ...base,
      liveItems: LIVE.map((row) => (row.id === 1 ? { ...row, storyPoints: 8 } : row)),
      testCases: [item({ id: 900, workItemType: 'Test Case', ...qa })],
    })
    expect(withPoints.people.find((p) => p.name === 'Quinn')!.squads[0]).toMatchObject({
      assigned: 8,
      expectedMin: 4,
      expectedMax: 8,
      executed: { executed: 3, passed: 2, failed: 1 },
    })
    expect(withPoints.people.find((p) => p.name === 'Ada')!.squads[0].executed).toBeNull()
  })

  it('collects open unassigned stories and stories with unassigned open tasks', () => {
    expect(view.unassigned.map((s) => s.row?.id)).toEqual([1, 2])
  })
})
