import { round1 } from './numbers'
import { plannedSprintLabel } from './personMetrics'
import { normalizeKey } from './text'
import { CLOSED_STATES, type StateChange, type WorkItemRow } from './workItems'

// Fluxo de estados dos work items, em dias úteis: quando entraram em Active e quanto levaram desde
// então até chegar em Testing QA, Testing Prod e Done/Closed; quanto ficaram em On Hold e quantas
// vezes foram para Fail. Usa o histórico de State gravado na sincronização (`stateHistory`).

export type FlowMilestone = 'testingQa' | 'testingProd' | 'done'

export const FLOW_MILESTONES: FlowMilestone[] = ['testingQa', 'testingProd', 'done']

const ACTIVE_STATES = new Set(['active', 'doing', 'in progress'])
const MILESTONE_STATES: Record<FlowMilestone, Set<string>> = {
  testingQa: new Set(['testing qa']),
  testingProd: new Set(['testing prod']),
  done: new Set([...CLOSED_STATES].map(normalizeKey)),
}
const ON_HOLD = 'on hold'
const FAIL = 'fail'

const isIn = (change: StateChange, states: Set<string>) => states.has(normalizeKey(change.state))

const DAY_MS = 24 * 60 * 60 * 1000

/** Data ISO ou "yyyy-mm-dd" (início do dia no fuso local) em timestamp. */
const toTime = (value: string) => (value.length === 10 ? new Date(`${value}T00:00:00`).getTime() : Date.parse(value))

/**
 * Tempo útil de `from` até `to`, em dias fracionados (24h por dia, sem sábados e domingos, no fuso
 * local): 3 horas numa terça = 0,125. Nunca negativo. Exibir com `formatDuration`.
 */
export function businessDaysBetween(from: string, to: string): number {
  const start = toTime(from)
  const end = toTime(to)
  if (!(end > start)) return 0
  let total = 0
  const day = new Date(start)
  day.setHours(0, 0, 0, 0)
  while (day.getTime() < end) {
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const weekday = day.getDay()
    if (weekday !== 0 && weekday !== 6) total += Math.max(0, Math.min(end, next.getTime()) - Math.max(start, day.getTime()))
    day.setTime(next.getTime())
  }
  return total / DAY_MS
}

/** Duração para a tela: menos de 1 dia em horas ("3.5 h"), a partir de 1 dia em dias ("2.3 dias"). */
export function formatDuration(days: number | null): string {
  if (days === null) return '—'
  if (days < 1) return `${round1(days * 24)} h`
  const value = round1(days)
  return `${value} ${value === 1 ? 'dia' : 'dias'}`
}

export interface ItemFlow {
  row: WorkItemRow
  /** Primeira entrada em Active (ou Doing / In Progress); null se nunca entrou. */
  activeAt: string | null
  /** Dias úteis do início da sprint até o Active (0 se já estava ativo antes). */
  sprintToActive: number | null
  /** Dias úteis desde o Active até a primeira chegada em cada marco; null se não chegou. */
  toMilestone: Record<FlowMilestone, number | null>
  /** Dias úteis somados em On Hold (a passagem atual conta até hoje). */
  onHoldDays: number
  /** Quantas vezes entrou em Fail. */
  fails: number
}

/** Fluxo de um item; null quando ele não tem histórico de estados (não foi sincronizado). */
export function itemFlow(row: WorkItemRow, sprintStart: string | undefined, today: Date = new Date()): ItemFlow | null {
  const history = row.stateHistory
  if (!history || history.length === 0) return null
  const activeIndex = history.findIndex((change) => isIn(change, ACTIVE_STATES))
  const activeAt = activeIndex >= 0 ? history[activeIndex].date : null
  const after = activeIndex >= 0 ? history.slice(activeIndex + 1) : []
  const toMilestone = Object.fromEntries(
    FLOW_MILESTONES.map((milestone) => {
      const reached = after.find((change) => isIn(change, MILESTONE_STATES[milestone]))
      return [milestone, activeAt && reached ? businessDaysBetween(activeAt, reached.date) : null]
    }),
  ) as Record<FlowMilestone, number | null>

  let onHoldDays = 0
  history.forEach((change, index) => {
    if (normalizeKey(change.state) !== ON_HOLD) return
    onHoldDays += businessDaysBetween(change.date, history[index + 1]?.date ?? today.toISOString())
  })

  return {
    row,
    activeAt,
    sprintToActive: activeAt && sprintStart ? businessDaysBetween(sprintStart, activeAt) : null,
    toMilestone,
    onHoldDays,
    fails: history.filter((change) => normalizeKey(change.state) === FAIL).length,
  }
}

/** Média sem arredondar: valores abaixo de 1 dia ainda viram horas na tela. */
function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

/**
 * Fluxo de cada item com histórico (para a tabela item a item). `sprintStartOf` dá o início da
 * sprint planejada do item ("Sprint NN - FYxx-yy"), base do "Início → Active".
 */
export function itemFlows(rows: WorkItemRow[], sprintStartOf: (label: string) => string | undefined, today: Date = new Date()): ItemFlow[] {
  return rows
    .map((row) => itemFlow(row, sprintStartOf(plannedSprintLabel(row)), today))
    .filter((flow): flow is ItemFlow => flow !== null)
}

// ---------------------------------------------------------------------------
// Linha do tempo por item: Active → Testing QA → Testing Prod → Done/Closed

export type FlowStage = 'active' | 'testingQa' | 'testingProd' | 'onHold' | 'fail' | 'other'

/** Etapas da evolução, na ordem; On Hold, Fail e outros estados ficam fora das médias por etapa. */
export const EVOLUTION_STAGES = ['active', 'testingQa', 'testingProd'] as const
export type EvolutionStage = (typeof EVOLUTION_STAGES)[number]

export const FLOW_STAGE_LABEL: Record<FlowStage, string> = {
  active: 'Active',
  testingQa: 'Testing QA',
  testingProd: 'Testing Prod',
  onHold: 'On Hold',
  fail: 'Fail',
  other: 'Outros estados',
}

/** Estado representante de cada etapa, para a cor padrão (lib/stateColors). */
export const FLOW_STAGE_STATE: Record<FlowStage, string> = {
  active: 'Active',
  testingQa: 'Testing QA',
  testingProd: 'Testing Prod',
  onHold: 'On Hold',
  fail: 'Fail',
  other: 'MR Prod',
}

const BEFORE_ACTIVE_STATES = new Set(['new', 'proposed', 'ready'])

function stageOf(state: string): FlowStage | 'done' | 'skip' {
  const key = normalizeKey(state)
  if (ACTIVE_STATES.has(key)) return 'active'
  if (MILESTONE_STATES.testingQa.has(key)) return 'testingQa'
  if (MILESTONE_STATES.testingProd.has(key)) return 'testingProd'
  if (MILESTONE_STATES.done.has(key)) return 'done'
  if (key === ON_HOLD) return 'onHold'
  if (key === FAIL) return 'fail'
  return BEFORE_ACTIVE_STATES.has(key) ? 'skip' : 'other'
}

export interface StageSegment {
  stage: FlowStage
  /** Estado real (ex.: "MR Prod" na etapa "other"). */
  state: string
  start: string
  end: string
  /** Dias úteis no estado. */
  days: number
  /** Ainda no estado (termina hoje). */
  open: boolean
}

export interface ItemTimeline {
  row: WorkItemRow
  activeAt: string
  segments: StageSegment[]
  /** Primeira chegada em Done/Closed depois do Active; null se ainda não terminou. */
  doneAt: string | null
}

/** Segmentos de cada estado desde o primeiro Active até Done/Closed (ou hoje); null sem Active. */
export function itemTimeline(row: WorkItemRow, today: Date = new Date()): ItemTimeline | null {
  const history = row.stateHistory ?? []
  const activeIndex = history.findIndex((change) => isIn(change, ACTIVE_STATES))
  if (activeIndex < 0) return null
  const segments: StageSegment[] = []
  let doneAt: string | null = null
  for (let index = activeIndex; index < history.length; index++) {
    const change = history[index]
    const stage = stageOf(change.state)
    if (stage === 'done') {
      doneAt = change.date
      break
    }
    if (stage === 'skip') continue
    const next = history[index + 1]
    const end = next?.date ?? today.toISOString()
    segments.push({ stage, state: change.state, start: change.date, end, days: businessDaysBetween(change.date, end), open: !next })
  }
  return { row, activeAt: history[activeIndex].date, segments, doneAt }
}

/** Linhas do tempo dos itens com histórico, do que entrou em Active primeiro ao último. */
export function itemTimelines(rows: WorkItemRow[], today: Date = new Date()): ItemTimeline[] {
  return rows
    .map((row) => itemTimeline(row, today))
    .filter((timeline): timeline is ItemTimeline => timeline !== null)
    .sort((a, b) => a.activeAt.localeCompare(b.activeAt) || a.row.id - b.row.id)
}

const daysIn = (timeline: ItemTimeline, stage: FlowStage) =>
  timeline.segments.filter((s) => s.stage === stage).reduce((sum, s) => sum + s.days, 0)
const passedBy = (timeline: ItemTimeline, stage: FlowStage) => timeline.segments.some((s) => s.stage === stage)

export interface StageSummary {
  items: number
  /** Média de dias úteis em cada etapa, só dos itens que passaram por ela (On Hold não entra). */
  stages: Record<EvolutionStage, { avgDays: number | null; items: number }>
  /** Active → Done/Closed descontando o On Hold, nos itens que terminaram. */
  cycle: { avgDays: number | null; items: number }
  onHold: { totalDays: number; avgDays: number | null; items: number }
  fails: { total: number; items: number }
}

export function stageSummary(timelines: ItemTimeline[]): StageSummary {
  const stageStats = (stage: FlowStage) => {
    const passed = timelines.filter((t) => passedBy(t, stage))
    return { avgDays: average(passed.map((t) => daysIn(t, stage))), items: passed.length }
  }
  const done = timelines.filter((t) => t.doneAt !== null)
  const onHold = timelines.filter((t) => passedBy(t, 'onHold'))
  const onHoldDays = onHold.map((t) => daysIn(t, 'onHold'))
  const failsOf = (t: ItemTimeline) => t.segments.filter((s) => s.stage === 'fail').length
  return {
    items: timelines.length,
    stages: Object.fromEntries(EVOLUTION_STAGES.map((stage) => [stage, stageStats(stage)])) as StageSummary['stages'],
    cycle: {
      avgDays: average(done.map((t) => Math.max(0, businessDaysBetween(t.activeAt, t.doneAt!) - daysIn(t, 'onHold')))),
      items: done.length,
    },
    onHold: { totalDays: onHoldDays.reduce((sum, days) => sum + days, 0), avgDays: average(onHoldDays), items: onHold.length },
    fails: { total: timelines.reduce((sum, t) => sum + failsOf(t), 0), items: timelines.filter((t) => failsOf(t) > 0).length },
  }
}
