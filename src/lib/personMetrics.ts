import { toDateKey } from './dates'
import { round1, percentOf } from './numbers'
import type { LevelConfig } from './levelsStorage'
import type { Person } from './peopleStorage'
import { pointsForEntry, type PersonAllocation } from './personAllocationsStorage'
import { findSquadNameForIterationPath } from './squadMatching'
import { formatSprintLabel, type Sprint } from './sprintsStorage'
import type { Squad } from './squadsStorage'
import type { TestExecution } from './testExecutionsStorage'
import { normalizeKey } from './text'
import { CLOSED_STATES, parseSprintInfo, type WorkItemRow } from './workItems'

// Métricas do Dashboard por Pessoa: o que uma pessoa entregou como dev (story points)
// ou executou como QA (testes), sprint a sprint, com os atrasos explicados item a item.

/** De onde vêm os pontos de dev: Assigned To do item, ou rateio pelo Effort das Tasks filhas. */
export type DevAttribution = 'assigned' | 'tasks'

export const QA_ITEM_TYPES = ['Test Case', 'Test Plan']

/** Itens cujo Iteration Path não casa com nenhuma squad cadastrada. */
export const NO_SQUAD_LABEL = 'Sem squad'

/** 36 pontos de execução equivalem a 1 story point (mesma regra do Dashboard por Squad). */
const EXECUTION_POINTS_PER_STORY_POINT = 36

const MS_PER_DAY = 24 * 60 * 60 * 1000

type PersonRef = Pick<Person, 'nome' | 'email'>

const isClosed = (row: WorkItemRow) => CLOSED_STATES.has(row.state)
const isType = (row: WorkItemRow, types: string[]) => types.some((type) => normalizeKey(type) === normalizeKey(row.workItemType))

/** Casa pelo email; sem email em um dos lados, pelo nome. */
export function isPersonItem(row: Pick<WorkItemRow, 'email' | 'assignedTo'>, person: PersonRef): boolean {
  const email = normalizeKey(person.email)
  if (email && normalizeKey(row.email)) return normalizeKey(row.email) === email
  return normalizeKey(row.assignedTo) !== '' && normalizeKey(row.assignedTo) === normalizeKey(person.nome)
}

/**
 * "Sprint 08 - FY25-26" em que o item foi planejado. Com a tag "Delayed", `resolveSprint`
 * já trouxe para `sprint`/`fiscalYear` a sprint da tag (a original); sem ela, é a do Iteration Path.
 */
export function plannedSprintLabel(row: Pick<WorkItemRow, 'sprint' | 'fiscalYear'>): string {
  return row.sprint && row.fiscalYear ? `${row.sprint} - ${row.fiscalYear}` : ''
}

/** "Sprint 09 - FY25-26" em que o item foi entregue: a do Iteration Path, para onde foi movido. */
export function deliverySprintLabel(row: Pick<WorkItemRow, 'iterationPath'>): string {
  const { sprint, fiscalYear } = parseSprintInfo(row.iterationPath)
  return sprint && fiscalYear ? `${sprint} - ${fiscalYear}` : ''
}

/** Ordem cronológica de "Sprint NN - FYxx-yy": Fiscal Year e depois número. */
export function compareSprintLabels(a: string, b: string): number {
  const matchA = a.match(/Sprint (\d+) - (FY\d{2}-\d{2})/)
  const matchB = b.match(/Sprint (\d+) - (FY\d{2}-\d{2})/)
  if (!matchA || !matchB) return a.localeCompare(b)
  return matchA[2].localeCompare(matchB[2]) || Number(matchA[1]) - Number(matchB[1])
}

// ---------------------------------------------------------------------------
// Atraso

export type DelayReason = 'tag' | 'closedLate'

export interface DelayInfo {
  delayed: boolean
  reason: DelayReason | null
  /** Sprint em que o item foi planejado (a da tag Delayed, quando houver). */
  plannedSprint: string
  /** Sprint em que foi entregue (a do Iteration Path). */
  deliverySprint: string
  /** Dias corridos entre o fim da sprint planejada e o fechamento; null sem datas. */
  daysLate: number | null
}

export const DELAY_REASON_LABEL: Record<DelayReason, string> = {
  tag: 'Tag Delayed (movido para outra sprint)',
  closedLate: 'Fechado após o fim da sprint',
}

/**
 * Atrasado quando tem a tag "Delayed" com outra sprint (`isDelayed`) ou quando foi
 * fechado depois do último dia da sprint planejada.
 */
export function delayInfo(row: WorkItemRow, sprintsByLabel: Map<string, Sprint>): DelayInfo {
  const plannedSprint = plannedSprintLabel(row)
  const plannedEnd = sprintsByLabel.get(plannedSprint)?.endDate
  const daysLate =
    isClosed(row) && row.closedDate && plannedEnd
      ? Math.max(0, Math.round((Date.parse(toDateKey(row.closedDate)) - Date.parse(plannedEnd)) / MS_PER_DAY))
      : null
  const reason: DelayReason | null = row.isDelayed ? 'tag' : daysLate !== null && daysLate > 0 ? 'closedLate' : null
  return { delayed: reason !== null, reason, plannedSprint, deliverySprint: deliverySprintLabel(row), daysLate }
}

// ---------------------------------------------------------------------------
// Pontos de dev

export interface PersonDevItem {
  row: WorkItemRow
  /** Parte dos story points do item que conta para a pessoa (1 = item inteiro). */
  share: number
  points: number
  delay: DelayInfo
}

function tasksByParent(rows: WorkItemRow[]): Map<number, WorkItemRow[]> {
  const byParent = new Map<number, WorkItemRow[]>()
  for (const row of rows) {
    if (row.parentId === undefined || normalizeKey(row.workItemType) !== 'task') continue
    byParent.set(row.parentId, [...(byParent.get(row.parentId) ?? []), row])
  }
  return byParent
}

/**
 * Fatia da pessoa num item de pontos. No rateio por Tasks, é o Effort das Tasks dela sobre
 * o Effort total das Tasks do item (sem Effort, pela quantidade de Tasks); item sem Tasks
 * cai no Assigned To.
 */
function devShare(row: WorkItemRow, person: PersonRef, mode: DevAttribution, tasks: WorkItemRow[] | undefined): number {
  if (mode === 'assigned' || !tasks || tasks.length === 0) return isPersonItem(row, person) ? 1 : 0
  const mine = tasks.filter((task) => isPersonItem(task, person))
  if (mine.length === 0) return 0
  const totalEffort = tasks.reduce((sum, task) => sum + task.effort, 0)
  if (totalEffort > 0) return mine.reduce((sum, task) => sum + task.effort, 0) / totalEffort
  return mine.length / tasks.length
}

export function attributeDevPoints(
  rows: WorkItemRow[],
  person: PersonRef,
  mode: DevAttribution,
  pointTypes: string[],
  sprintsByLabel: Map<string, Sprint>,
): PersonDevItem[] {
  const children = mode === 'tasks' ? tasksByParent(rows) : new Map<number, WorkItemRow[]>()
  const items: PersonDevItem[] = []
  for (const row of rows) {
    if (!isType(row, pointTypes)) continue
    const share = devShare(row, person, mode, children.get(row.id))
    if (share > 0) items.push({ row, share, points: row.storyPoints * share, delay: delayInfo(row, sprintsByLabel) })
  }
  return items
}

// ---------------------------------------------------------------------------
// Capacity da pessoa (Alocação)

function capacityBySprint(
  person: Person,
  allocations: PersonAllocation[],
  sprints: Sprint[],
  levels: LevelConfig[],
): Map<string, { capacity: number; max: number }> {
  const sprintsById = new Map(sprints.map((s) => [s.id, s]))
  const result = new Map<string, { capacity: number; max: number }>()
  for (const entry of allocations) {
    if (entry.personId !== person.id) continue
    const sprint = sprintsById.get(entry.sprintId)
    if (!sprint) continue
    const { capacity, max } = pointsForEntry(entry, sprint, person, levels)
    const label = formatSprintLabel(sprint)
    const acc = result.get(label) ?? { capacity: 0, max: 0 }
    result.set(label, { capacity: acc.capacity + capacity, max: acc.max + max })
  }
  return result
}

function average(values: number[]): number {
  return values.length > 0 ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
}

/** Média só das sprints com valor > 0 (sprint sem entrega nem alocação não puxa a média para baixo). */
function averageOfActive(values: number[]): number {
  return average(values.filter((value) => value > 0))
}

/**
 * Entrega ÷ capacity só nas sprints com alocação: numa sprint sem alocação não há com o que
 * comparar, e somar a entrega dela inflaria a aderência.
 */
function allocationAdherence<T extends { capacity: number }>(sprints: T[], deliveredOf: (sprint: T) => number) {
  const allocated = sprints.filter((sprint) => sprint.capacity > 0)
  const capacity = allocated.reduce((total, sprint) => total + sprint.capacity, 0)
  const delivered = allocated.reduce((total, sprint) => total + deliveredOf(sprint), 0)
  return {
    capacity: round1(capacity),
    deliveredOnAllocatedSprints: round1(delivered),
    allocatedSprints: allocated.length,
    capacityAdherence: capacity > 0 ? percentOf(delivered, capacity) : null,
  }
}

function inSelection(label: string, selectedSprints: string[]): boolean {
  return selectedSprints.length === 0 || selectedSprints.includes(label)
}

export interface PersonMetricsInput {
  person: Person
  rows: WorkItemRow[]
  sprints: Sprint[]
  allocations: PersonAllocation[]
  levels: LevelConfig[]
  /** Sprints ("Sprint NN - FYxx-yy") consideradas; vazio = todas. */
  selectedSprints: string[]
  /** Squads da base, para separar as entregas por squad (pelo Iteration Path). */
  squads?: Squad[]
}

// ---------------------------------------------------------------------------
// Dashboard Dev
//
// As sprints seguem a coluna Sprint (a planejada), como o "Story Points Closed por Sprint"
// do Dashboard por Squad: item com tag Delayed conta como atrasado na sprint da tag.

export interface PersonDevSprint {
  label: string
  onTime: number
  delayed: number
  capacity: number
  max: number
  /** SP entregues por squad nesta sprint. */
  bySquad: Record<string, number>
}

export interface PersonDevMetrics {
  sprints: PersonDevSprint[]
  /** Squads com entrega, da que mais recebeu SP para a que menos recebeu. */
  squadNames: string[]
  items: PersonDevItem[]
  delivered: number
  delayedPoints: number
  averagePerSprint: number
  averageDelayedPerSprint: number
  delayedPercent: number
  itemsDelivered: number
  itemsOpen: number
  openPoints: number
  /** Capacity da Alocação somada nas sprints do filtro. */
  capacity: number
  /** SP entregues só nas sprints com alocação (o numerador da aderência). */
  deliveredOnAllocatedSprints: number
  allocatedSprints: number
  /** Entregue ÷ capacity nas sprints com alocação, em %; null sem alocação. */
  capacityAdherence: number | null
  byType: { type: string; points: number }[]
}

export function computePersonDevMetrics(
  input: PersonMetricsInput & { mode: DevAttribution; pointTypes: string[] },
): PersonDevMetrics {
  const sprintsByLabel = new Map(input.sprints.map((s) => [formatSprintLabel(s), s]))
  const items = attributeDevPoints(input.rows, input.person, input.mode, input.pointTypes, sprintsByLabel).filter((item) =>
    inSelection(plannedSprintLabel(item.row), input.selectedSprints),
  )
  const capacity = capacityBySprint(input.person, input.allocations, input.sprints, input.levels)

  const bySprint = new Map<string, PersonDevSprint>()
  const sprintEntry = (label: string) => {
    const entry = bySprint.get(label) ?? { label, onTime: 0, delayed: 0, capacity: 0, max: 0, bySquad: {} }
    bySprint.set(label, entry)
    return entry
  }
  for (const [label, { capacity: cap, max }] of capacity) {
    if (!inSelection(label, input.selectedSprints)) continue
    Object.assign(sprintEntry(label), { capacity: cap, max })
  }
  const closed = items.filter((item) => isClosed(item.row))
  const totalBySquad = new Map<string, number>()
  for (const item of closed) {
    const label = plannedSprintLabel(item.row)
    if (!label) continue
    const entry = sprintEntry(label)
    if (item.delay.delayed) entry.delayed += item.points
    else entry.onTime += item.points
    const squad = findSquadNameForIterationPath(input.squads ?? [], item.row.iterationPath) ?? NO_SQUAD_LABEL
    entry.bySquad[squad] = (entry.bySquad[squad] ?? 0) + item.points
    totalBySquad.set(squad, (totalBySquad.get(squad) ?? 0) + item.points)
  }
  const sprints = [...bySprint.values()]
    .map((s) => ({
      ...s,
      onTime: round1(s.onTime),
      delayed: round1(s.delayed),
      capacity: round1(s.capacity),
      max: round1(s.max),
      bySquad: Object.fromEntries(Object.entries(s.bySquad).map(([squad, points]) => [squad, round1(points)])),
    }))
    .sort((a, b) => compareSprintLabels(a.label, b.label))

  const delivered = closed.reduce((sum, item) => sum + item.points, 0)
  const delayedPoints = closed.filter((item) => item.delay.delayed).reduce((sum, item) => sum + item.points, 0)
  const open = items.filter((item) => !isClosed(item.row))

  const byType = new Map<string, number>()
  for (const item of closed) byType.set(item.row.workItemType, (byType.get(item.row.workItemType) ?? 0) + item.points)

  return {
    sprints,
    squadNames: [...totalBySquad.entries()].sort((a, b) => b[1] - a[1]).map(([squad]) => squad),
    items,
    delivered: round1(delivered),
    delayedPoints: round1(delayedPoints),
    averagePerSprint: averageOfActive(sprints.map((s) => s.onTime + s.delayed)),
    // Sobre as sprints com entrega: sprint sem atraso conta como 0.
    averageDelayedPerSprint: average(sprints.filter((s) => s.onTime + s.delayed > 0).map((s) => s.delayed)),
    delayedPercent: percentOf(delayedPoints, delivered),
    itemsDelivered: closed.length,
    itemsOpen: open.length,
    openPoints: round1(open.reduce((sum, item) => sum + item.points, 0)),
    ...allocationAdherence(sprints, (s) => s.onTime + s.delayed),
    byType: [...byType.entries()].map(([type, points]) => ({ type, points: round1(points) })).sort((a, b) => b.points - a.points),
  }
}

/** Média de SP/sprint das outras pessoas (`peers`), para comparar a pessoa com o time. */
export function peerAveragePerSprint(
  input: Omit<PersonMetricsInput, 'person'> & { peers: Person[]; mode: DevAttribution; pointTypes: string[] },
): number {
  const averages = input.peers
    .map((peer) => computePersonDevMetrics({ ...input, person: peer }).averagePerSprint)
    .filter((average) => average > 0)
  return averages.length > 0 ? round1(averages.reduce((sum, value) => sum + value, 0) / averages.length) : 0
}

// ---------------------------------------------------------------------------
// Dashboard QA

export interface PersonQaSprint {
  label: string
  executed: number
  passed: number
  failed: number
  other: number
  /** Pontos de Execução dos Test Cases atribuídos, já na escala de story points (÷36). */
  executionPoints: number
  capacity: number
  max: number
}

export interface PersonQaItem {
  row: WorkItemRow
  executionPoints: number
  delay: DelayInfo
}

export interface PersonQaMetrics {
  sprints: PersonQaSprint[]
  items: PersonQaItem[]
  executed: number
  passed: number
  failed: number
  averageExecutedPerSprint: number
  passedPercent: number
  failedPercent: number
  executionPoints: number
  averageExecutionPointsPerSprint: number
  testCases: number
  /** Capacity da Alocação somada nas sprints do filtro. */
  capacity: number
  /** Pontos de Execução só nas sprints com alocação (o numerador da aderência). */
  deliveredOnAllocatedSprints: number
  allocatedSprints: number
  /** Pontos de Execução ÷ capacity nas sprints com alocação, em %; null sem alocação. */
  capacityAdherence: number | null
  /** false quando nenhuma sincronização trouxe test results desta pessoa. */
  hasExecutions: boolean
}

export function computePersonQaMetrics(input: PersonMetricsInput & { executions: TestExecution[] }): PersonQaMetrics {
  const sprintsByLabel = new Map(input.sprints.map((s) => [formatSprintLabel(s), s]))
  const sprintsById = new Map(input.sprints.map((s) => [s.id, s]))
  const capacity = capacityBySprint(input.person, input.allocations, input.sprints, input.levels)

  const bySprint = new Map<string, PersonQaSprint>()
  const sprintEntry = (label: string) => {
    const entry =
      bySprint.get(label) ?? { label, executed: 0, passed: 0, failed: 0, other: 0, executionPoints: 0, capacity: 0, max: 0 }
    bySprint.set(label, entry)
    return entry
  }
  for (const [label, { capacity: cap, max }] of capacity) {
    if (inSelection(label, input.selectedSprints)) Object.assign(sprintEntry(label), { capacity: cap, max })
  }

  const executions = input.executions.filter((e) => isPersonItem({ email: e.email, assignedTo: e.name }, input.person))
  for (const execution of executions) {
    const sprint = sprintsById.get(execution.sprintId)
    if (!sprint) continue
    const label = formatSprintLabel(sprint)
    if (!inSelection(label, input.selectedSprints)) continue
    const entry = sprintEntry(label)
    entry.executed += execution.executed
    entry.passed += execution.passed
    entry.failed += execution.failed
    entry.other += execution.other
  }

  const items: PersonQaItem[] = input.rows
    .filter((row) => isType(row, QA_ITEM_TYPES) && isPersonItem(row, input.person))
    .filter((row) => inSelection(plannedSprintLabel(row), input.selectedSprints))
    .map((row) => ({
      row,
      executionPoints: (row.pontoExecucao * row.runs) / EXECUTION_POINTS_PER_STORY_POINT,
      delay: delayInfo(row, sprintsByLabel),
    }))
  for (const item of items) {
    const label = plannedSprintLabel(item.row)
    if (label) sprintEntry(label).executionPoints += item.executionPoints
  }

  const sprints = [...bySprint.values()]
    .map((s) => ({ ...s, executionPoints: round1(s.executionPoints), capacity: round1(s.capacity), max: round1(s.max) }))
    .sort((a, b) => compareSprintLabels(a.label, b.label))
  const sum = (pick: (s: PersonQaSprint) => number) => sprints.reduce((total, s) => total + pick(s), 0)
  const executed = sum((s) => s.executed)
  const executionPoints = sum((s) => s.executionPoints)

  return {
    sprints,
    items,
    executed,
    passed: sum((s) => s.passed),
    failed: sum((s) => s.failed),
    averageExecutedPerSprint: averageOfActive(sprints.map((s) => s.executed)),
    passedPercent: percentOf(sum((s) => s.passed), executed),
    failedPercent: percentOf(sum((s) => s.failed), executed),
    executionPoints: round1(executionPoints),
    averageExecutionPointsPerSprint: averageOfActive(sprints.map((s) => s.executionPoints)),
    testCases: items.length,
    ...allocationAdherence(sprints, (s) => s.executionPoints),
    hasExecutions: executions.length > 0,
  }
}
