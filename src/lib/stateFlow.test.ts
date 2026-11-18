import { describe, expect, it } from 'vitest'
import { businessDaysBetween, formatDuration, itemFlow, itemFlows, itemTimeline, itemTimelines, stageSummary } from './stateFlow'
import type { StateChange, WorkItemRow } from './workItems'

// Março/2026: dia 2 é segunda-feira.
const at = (day: number) => `2026-03-${String(day).padStart(2, '0')}T12:00:00Z`
const history = (...changes: [string, number][]): StateChange[] => changes.map(([state, day]) => ({ state, date: at(day) }))

const row = (id: number, stateHistory?: StateChange[], sprint = 'Sprint 01'): WorkItemRow => ({
  id,
  workItemType: 'User Story',
  title: `Item ${id}`,
  assignedTo: '',
  email: '',
  state: stateHistory?.at(-1)?.state ?? 'New',
  tags: '',
  iterationPath: `Proj\\${sprint} - FY25-26`,
  sprint,
  fiscalYear: 'FY25-26',
  storyPoints: 3,
  effort: 0,
  timeCriticality: 0,
  wsjf: 0,
  pontoExecucao: 0,
  runs: 0,
  isDelayed: false,
  stateHistory,
})

const SPRINT_START = '2026-03-02'
const TODAY = new Date(at(16))
// O início da sprint é meia-noite local: até o Active (quarta, 4) são 2 dias + as horas daquele dia.
const TO_ACTIVE_ON_4 = 2 + new Date(at(4)).getHours() / 24

// Active na quarta (4); vai e volta de Fail duas vezes; Testing Prod na sexta seguinte; Closed na segunda.
const WITH_FAILS = row(1, history(['New', 2], ['Active', 4], ['Testing QA', 9], ['Fail', 10], ['Active', 10], ['Testing QA', 11], ['Fail', 11], ['Testing QA', 12], ['Testing Prod', 13], ['Closed', 16]))
// "Doing" conta como Active; passa por On Hold e pula Testing QA/Prod.
const WITH_HOLD = row(2, history(['Doing', 3], ['On Hold', 5], ['Active', 9], ['Done', 10]))
const NEVER_ACTIVE = row(3, history(['New', 2]))
const NO_HISTORY = row(4)
// On Hold ainda aberto: conta até hoje.
const OPEN_HOLD = row(5, history(['Active', 2], ['On Hold', 12]), 'Sprint 02')

describe('businessDaysBetween / formatDuration', () => {
  it('conta o tempo útil exato, pulando o fim de semana, nunca negativo', () => {
    expect(businessDaysBetween(at(4), at(9))).toBe(3)
    expect(businessDaysBetween(at(6), at(9))).toBe(1)
    expect(businessDaysBetween(at(4), at(4))).toBe(0)
    expect(businessDaysBetween(at(9), at(4))).toBe(0)
    // Mesmo dia: 3 horas.
    expect(businessDaysBetween('2026-03-04T10:00:00Z', '2026-03-04T13:00:00Z')).toBeCloseTo(3 / 24)
  })

  it('menos de 1 dia em horas, a partir de 1 dia em dias', () => {
    expect(formatDuration(3 / 24)).toBe('3 h')
    expect(formatDuration(0)).toBe('0 h')
    expect(formatDuration(1)).toBe('1 dia')
    expect(formatDuration(2.25)).toBe('2.3 dias')
    expect(formatDuration(null)).toBe('—')
  })
})

describe('itemFlow', () => {
  it('mede desde a primeira entrada em Active até a primeira chegada em cada marco e conta os Fails', () => {
    expect(itemFlow(WITH_FAILS, SPRINT_START, TODAY)).toMatchObject({
      activeAt: at(4),
      sprintToActive: TO_ACTIVE_ON_4,
      toMilestone: { testingQa: 3, mrProd: null, testingProd: 7, done: 8 },
      onHoldDays: 0,
      fails: 2,
    })
  })

  it('aceita Doing como Active, soma On Hold e deixa null o marco não alcançado', () => {
    expect(itemFlow(WITH_HOLD, SPRINT_START, TODAY)).toMatchObject({
      activeAt: at(3),
      toMilestone: { testingQa: null, mrProd: null, testingProd: null, done: 5 },
      onHoldDays: 2,
      fails: 0,
    })
  })

  it('On Hold ainda aberto conta até hoje; sem Active não há tempos; sem histórico é null', () => {
    expect(itemFlow(OPEN_HOLD, SPRINT_START, TODAY)?.onHoldDays).toBe(2)
    expect(itemFlow(NEVER_ACTIVE, SPRINT_START, TODAY)).toMatchObject({
      activeAt: null,
      sprintToActive: null,
      toMilestone: { testingQa: null, mrProd: null, testingProd: null, done: null },
    })
    expect(itemFlow(NO_HISTORY, SPRINT_START, TODAY)).toBeNull()
  })
})

describe('itemFlows', () => {
  it('só os itens com histórico, com o início da sprint planejada de cada um', () => {
    const starts: Record<string, string> = { 'Sprint 01 - FY25-26': SPRINT_START, 'Sprint 02 - FY25-26': '2026-03-09' }
    const flows = itemFlows([OPEN_HOLD, WITH_FAILS, NEVER_ACTIVE, NO_HISTORY], (label) => starts[label], TODAY)
    expect(flows.map((flow) => [flow.row.id, flow.sprintToActive])).toEqual([
      [5, 0],
      [1, TO_ACTIVE_ON_4],
      [3, null],
    ])
  })
})

describe('itemTimeline', () => {
  it('quebra o item em segmentos por estado desde o Active até o Done, em dias úteis', () => {
    const timeline = itemTimeline(WITH_FAILS, TODAY)
    expect(timeline?.doneAt).toBe(at(16))
    expect(timeline?.segments.map((s) => [s.stage, s.days])).toEqual([
      ['active', 3],
      ['testingQa', 1],
      ['fail', 0],
      ['active', 1],
      ['testingQa', 0],
      ['fail', 1],
      ['testingQa', 1],
      ['testingProd', 1],
    ])
  })

  it('o segmento atual termina hoje; sem Active não há linha do tempo', () => {
    const timeline = itemTimeline(OPEN_HOLD, TODAY)
    expect(timeline?.segments.at(-1)).toMatchObject({ stage: 'onHold', days: 2, open: true, end: TODAY.toISOString() })
    expect(timeline?.doneAt).toBeNull()
    expect(itemTimeline(NEVER_ACTIVE, TODAY)).toBeNull()
  })
})

describe('stageSummary', () => {
  it('média por etapa sem o On Hold, ciclo até Done descontando o On Hold e On Hold à parte', () => {
    const timelines = itemTimelines([WITH_FAILS, WITH_HOLD, OPEN_HOLD, NEVER_ACTIVE, NO_HISTORY], TODAY)
    expect(timelines.map((t) => t.row.id)).toEqual([5, 2, 1])
    expect(stageSummary(timelines)).toEqual({
      items: 3,
      stages: {
        active: { avgDays: 5, items: 3 },
        testingQa: { avgDays: 2, items: 1 },
        mrProd: { avgDays: null, items: 0 },
        testingProd: { avgDays: 1, items: 1 },
      },
      cycle: { avgDays: 5.5, items: 2 },
      onHold: { totalDays: 4, avgDays: 2, items: 2 },
      fails: { total: 2, items: 1 },
    })
  })
})
