import { describe, expect, it } from 'vitest'
import { DEFAULT_LEVELS } from './levelsStorage'
import { sprintPhase } from './sprintsStorage'
import { sprintPlanSummary, sprintSquadPlans, squadSprintPlan, type PlanBase } from './sprintPlanning'
import { FIXTURE_ALLOCATIONS, FIXTURE_PEOPLE, FIXTURE_SPRINT, FIXTURE_WORK_ITEMS } from './azure/sprintFixtures'

const portal = { id: 'sq1', name: 'Portal' }
const renewals = { id: 'sq2', name: 'Renewals' }

// Ada (SR) e Grace (SR) a 100% e Alan (PL) a 50% numa sprint de 10 dias válidos:
// previsto 15 + 5 + 15 = 35, máximo 20 + 7,5 + 20 = 47,5 e, com +3 dias úteis, 61,8.
const base: PlanBase = { allocations: FIXTURE_ALLOCATIONS, people: FIXTURE_PEOPLE, levels: DEFAULT_LEVELS, workItems: FIXTURE_WORK_ITEMS }

describe('sprintPhase', () => {
  const sprint = { startDate: '2025-09-01', endDate: '2025-09-12' }
  it('é atual do primeiro ao último dia, fechada depois e aberta antes', () => {
    expect(sprintPhase(sprint, new Date(2025, 7, 31))).toBe('open')
    expect(sprintPhase(sprint, new Date(2025, 8, 1))).toBe('current')
    expect(sprintPhase(sprint, new Date(2025, 8, 12, 23, 0))).toBe('current')
    expect(sprintPhase(sprint, new Date(2025, 8, 13))).toBe('closed')
  })
})

describe('squadSprintPlan', () => {
  it('compara os SP planejados (qualquer estado) com o previsto da alocação', () => {
    expect(squadSprintPlan(portal, FIXTURE_SPRINT, base)).toMatchObject({
      people: 3,
      percentage: 250,
      capacity: 35,
      max: 47.5,
      maxExtended: 61.8,
      // 8 + 5 + 5 + 2 + 3 + 3 + 2 + 5: Closed, Active, New e Testing QA contam igual.
      plannedPoints: 33,
      status: 'within',
    })
  })

  it('classifica abaixo, acima, na extensão e sobrecarga pela mesma régua das métricas individuais', () => {
    const withPoints = (storyPoints: number) => ({ ...base, workItems: [{ ...FIXTURE_WORK_ITEMS[0], storyPoints }] })
    expect(squadSprintPlan(portal, FIXTURE_SPRINT, withPoints(20)).status).toBe('below')
    expect(squadSprintPlan(portal, FIXTURE_SPRINT, withPoints(45)).status).toBe('above')
    expect(squadSprintPlan(portal, FIXTURE_SPRINT, withPoints(55)).status).toBe('extension')
    expect(squadSprintPlan(portal, FIXTURE_SPRINT, withPoints(70)).status).toBe('overload')
  })

  it('sem alocação não tem status', () => {
    expect(squadSprintPlan(renewals, FIXTURE_SPRINT, base)).toMatchObject({ people: 0, capacity: 0, plannedPoints: 0, status: null })
  })
})

describe('sprintSquadPlans e sprintPlanSummary', () => {
  it('coloca as squads com alocação antes das vazias e soma só as alocadas', () => {
    const plans = sprintSquadPlans(FIXTURE_SPRINT, [renewals, portal], base)
    expect(plans.map((p) => p.squad.name)).toEqual(['Portal', 'Renewals'])
    expect(sprintPlanSummary(plans)).toMatchObject({ squads: 1, people: 3, capacity: 35, plannedPoints: 33, status: 'within' })
  })
})
