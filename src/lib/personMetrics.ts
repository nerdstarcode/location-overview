import { localDateKey, toDateKey } from './dates'
import { round1, percentOf } from './numbers'
import type { CargoConfig, CargoTipo } from './cargosStorage'
import type { LevelConfig } from './levelsStorage'
import type { Person } from './peopleStorage'
import { pointsForEntry, type PersonAllocation } from './personAllocationsStorage'
import { findSquadNameForIterationPath } from './squadMatching'
import { formatSprintLabel, type Sprint } from './sprintsStorage'
import type { Squad } from './squadsStorage'
import type { TestExecution } from './testExecutionsStorage'
import { DEFAULT_TEST_POINTS_RATIO, type TestReport } from './testReportsStorage'
import { normalizeKey } from './text'
import { CLOSED_STATES, parseSprintInfo, type WorkItemRow } from './workItems'

// Métricas do Dashboard por Pessoa: o que uma pessoa entregou como dev (story points)
// ou executou como QA (testes), sprint a sprint, com os atrasos explicados item a item.

/** De onde vêm os pontos de dev: Assigned To do item, ou rateio pelo Effort das Tasks filhas. */
export type DevAttribution = 'assigned' | 'tasks'

export const QA_ITEM_TYPES = ['Test Case', 'Test Plan']

/** Itens cujo Iteration Path não casa com nenhuma squad cadastrada. */
export const NO_SQUAD_LABEL = 'Sem squad'

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

/** Squad do item pelo Iteration Path; sem match, NO_SQUAD_LABEL. */
export function squadOfRow(squads: Squad[], row: Pick<WorkItemRow, 'iterationPath'>): string {
  return findSquadNameForIterationPath(squads, row.iterationPath) ?? NO_SQUAD_LABEL
}

function squadSelected(squadName: string, selectedSquads: string[] | undefined): boolean {
  return !selectedSquads || selectedSquads.length === 0 || selectedSquads.includes(squadName)
}

/**
 * A sprint tem 3 semanas, mas só 2 (os dias válidos) entram no previsto: a 3ª é tomada por
 * reuniões de planejamento, embora o time continue codando e testando. Essa "gordurinha" são
 * +3 dias úteis acima do Máximo, proporcionais à alocação, usáveis antes da próxima sprint.
 */
export const SPRINT_EXTENSION_DAYS = 3

/**
 * Previsto (capacity points/dia nos dias válidos), Máximo (carga cheia de 8h/dia — max points/dia
 * — nos dias válidos) e Máximo com a extensão (a carga cheia somando os dias de extensão).
 */
export interface SprintCapacity {
  capacity: number
  max: number
  maxExtended: number
}

function capacityBySprint(input: PersonMetricsInput): Map<string, SprintCapacity> {
  const { person, allocations, sprints, levels } = input
  const sprintsById = new Map(sprints.map((s) => [s.id, s]))
  const squadsById = new Map((input.squads ?? []).map((s) => [s.id, s.name]))
  const result = new Map<string, SprintCapacity>()
  for (const entry of allocations) {
    if (entry.personId !== person.id) continue
    if (!squadSelected(squadsById.get(entry.squadId) ?? NO_SQUAD_LABEL, input.selectedSquads)) continue
    const sprint = sprintsById.get(entry.sprintId)
    if (!sprint) continue
    const { capacity, max } = pointsForEntry(entry, sprint, person, levels)
    const extended = pointsForEntry(entry, { totalValidDays: sprint.totalValidDays + SPRINT_EXTENSION_DAYS }, person, levels)
    const label = formatSprintLabel(sprint)
    const acc = result.get(label) ?? { capacity: 0, max: 0, maxExtended: 0 }
    result.set(label, {
      capacity: acc.capacity + capacity,
      max: acc.max + max,
      maxExtended: acc.maxExtended + extended.max,
    })
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
 * Aderência conservadora, só nas sprints com alocação (sem alocação não há com o que comparar):
 * em cada sprint a carga conta no máximo até o Máximo com a extensão. O que passa disso não infla
 * a aderência; vira `overload`, sinal de sobrecarga ou de entrega acima do nível cadastrado.
 */
function allocationAdherence<T extends { label: string; capacity: number; max: number; maxExtended: number }>(
  sprints: T[],
  deliveredOf: (sprint: T) => number,
) {
  const allocated = sprints.filter((sprint) => sprint.capacity > 0)
  const sum = (pick: (sprint: T) => number) => allocated.reduce((total, sprint) => total + pick(sprint), 0)
  const capacity = sum((sprint) => sprint.capacity)
  const max = sum((sprint) => sprint.max)
  const maxExtended = sum((sprint) => sprint.maxExtended)
  const delivered = sum(deliveredOf)
  const counted = sum((sprint) => Math.min(deliveredOf(sprint), sprint.maxExtended))
  const overloaded = allocated.filter((sprint) => deliveredOf(sprint) > sprint.maxExtended)
  // Quanto da gordurinha foi usado: o que passou do Máximo, até o Máximo com a extensão.
  const extensionUsed = allocated.map((sprint) => Math.max(0, Math.min(deliveredOf(sprint), sprint.maxExtended) - sprint.max))
  const sprintStatusCounts: Record<LoadStatus, number> = { below: 0, within: 0, above: 0, extension: 0, overload: 0 }
  for (const sprint of allocated) {
    sprintStatusCounts[loadStatusOf(deliveredOf(sprint), sprint.capacity, sprint.max, sprint.maxExtended)] += 1
  }
  return {
    capacity: round1(capacity),
    maxCapacity: round1(max),
    maxExtendedCapacity: round1(maxExtended),
    extensionUsedPoints: round1(extensionUsed.reduce((total, value) => total + value, 0)),
    extensionUsedSprints: extensionUsed.filter((value) => value > 0).length,
    sprintStatusCounts,
    deliveredOnAllocatedSprintsRaw: round1(delivered),
    deliveredOnAllocatedSprints: round1(counted),
    allocatedSprints: allocated.length,
    capacityAdherence: capacity > 0 ? percentOf(counted, capacity) : null,
    loadStatus: capacity > 0 ? loadStatusOf(delivered, capacity, max, maxExtended) : null,
    overloadPoints: round1(overloaded.reduce((total, sprint) => total + deliveredOf(sprint) - sprint.maxExtended, 0)),
    overloadSprints: overloaded.map((sprint) => sprint.label),
  }
}

// ---------------------------------------------------------------------------
// Status da entrega em relação ao previsto (Alocação)

/** Situação da carga frente ao Previsto, ao Máximo e à extensão acima do Máximo. */
export type LoadStatus = 'below' | 'within' | 'above' | 'extension' | 'overload'

export const LOAD_STATUS_LABEL: Record<LoadStatus, string> = {
  below: 'Abaixo do previsto',
  within: 'Dentro do previsto',
  above: 'Acima do previsto',
  extension: 'Na extensão',
  overload: 'Sobrecarga',
}

/** Folga em torno do Capacity que ainda conta como "dentro do previsto" (±10%). */
const WITHIN_TOLERANCE = 0.1

/**
 * Abaixo: menos de 90% do previsto. Dentro: até 10% em volta do previsto. Acima: além disso,
 * até o Máximo. Na extensão: passou do Máximo, mas cabe nos +3 dias úteis de extensão (a
 * gordurinha). Sobrecarga: passou até da extensão — sobrecarga ou entrega acima do nível.
 */
export function loadStatusOf(delivered: number, capacity: number, max: number, maxExtended: number): LoadStatus {
  if (delivered > maxExtended) return 'overload'
  if (delivered < capacity * (1 - WITHIN_TOLERANCE)) return 'below'
  if (delivered <= capacity * (1 + WITHIN_TOLERANCE)) return 'within'
  if (delivered <= max) return 'above'
  return 'extension'
}

/** Sprints em andamento (hoje, no fuso local, entre o início e o fim) e as já encerradas. */
function sprintTimeline(input: PersonMetricsInput): { current: Set<string>; past: Set<string> } {
  const today = localDateKey(input.today ?? new Date())
  const current = new Set<string>()
  const past = new Set<string>()
  for (const sprint of input.sprints) {
    if (sprint.startDate <= today && today <= sprint.endDate) current.add(formatSprintLabel(sprint))
    else if (sprint.endDate && sprint.endDate < today) past.add(formatSprintLabel(sprint))
  }
  return { current, past }
}

function roundValues(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, round1(value)]))
}

/** "FY25-26" de "Sprint 08 - FY25-26". */
export function fiscalYearOfLabel(label: string): string {
  return label.match(/FY\d{2}-\d{2}/i)?.[0].toUpperCase() ?? ''
}

/**
 * Sprints consideradas: as escolhidas (vazio = todas), dos anos fiscais escolhidos (vazio =
 * todos) e, com `onlyAllocatedSprints`, só as que têm alocação da pessoa (`allocated`).
 */
function sprintFilter(input: PersonMetricsInput, allocated: Map<string, unknown>): (label: string) => boolean {
  const { selectedSprints, selectedFiscalYears = [], onlyAllocatedSprints = false } = input
  return (label) =>
    (selectedSprints.length === 0 || selectedSprints.includes(label)) &&
    (selectedFiscalYears.length === 0 || selectedFiscalYears.includes(fiscalYearOfLabel(label))) &&
    (!onlyAllocatedSprints || allocated.has(label))
}

export interface PersonMetricsInput {
  person: Person
  rows: WorkItemRow[]
  sprints: Sprint[]
  allocations: PersonAllocation[]
  levels: LevelConfig[]
  /** Sprints ("Sprint NN - FYxx-yy") consideradas; vazio = todas. */
  selectedSprints: string[]
  /** Anos fiscais ("FY25-26") considerados; vazio = todos. */
  selectedFiscalYears?: string[]
  /** Só as sprints em que a pessoa tem alocação (respeitando o filtro de squad). */
  onlyAllocatedSprints?: boolean
  /** "Hoje", para saber qual é a sprint atual (padrão: agora). */
  today?: Date
  /** Squads da base, para separar as entregas por squad (pelo Iteration Path). */
  squads?: Squad[]
  /**
   * Nomes de squad considerados; vazio = todas. Filtra os itens (squad do Iteration Path),
   * a capacity (squad da alocação) e os testes executados (squad da sincronização).
   */
  selectedSquads?: string[]
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
  /** Carga cheia (max points/dia) nos dias válidos. */
  max: number
  /** Carga cheia somando os SPRINT_EXTENSION_DAYS dias úteis de extensão (acima do Máximo). */
  maxExtended: number
  /** SP entregues por squad nesta sprint. */
  bySquad: Record<string, number>
  /** SP entregues por Work Item Type nesta sprint. */
  byType: Record<string, number>
  /** Sprint em andamento (hoje entre o início e o fim). */
  isCurrent: boolean
  /** Sprint atual: SP dos itens ainda abertos (comprometidos frente ao previsto). */
  inProgress: number
  /** Sprint já encerrada: SP dos itens que continuam abertos (em andamento atrasado). */
  inProgressDelayed: number
}

export interface PersonDevMetrics {
  sprints: PersonDevSprint[]
  /** Squads com entrega, da que mais recebeu SP para a que menos recebeu. */
  squadNames: string[]
  items: PersonDevItem[]
  delivered: number
  delayedPoints: number
  /** SP em aberto na sprint atual (somados à entrega na comparação com o previsto). */
  inProgressPoints: number
  /** Parte de inProgressPoints nas sprints com alocação (incluída em deliveredOnAllocatedSprintsRaw). */
  inProgressOnAllocatedSprints: number
  /** SP ainda abertos em sprints já encerradas (em andamento atrasado). */
  inProgressDelayedPoints: number
  /** Parte de inProgressDelayedPoints nas sprints com alocação (incluída em deliveredOnAllocatedSprintsRaw). */
  inProgressDelayedOnAllocatedSprints: number
  averagePerSprint: number
  averageDelayedPerSprint: number
  delayedPercent: number
  itemsDelivered: number
  itemsOpen: number
  openPoints: number
  /** Capacity da Alocação somada nas sprints do filtro. */
  capacity: number
  /** SP entregues nas sprints com alocação, cada sprint limitada ao Max (o numerador da aderência). */
  deliveredOnAllocatedSprints: number
  allocatedSprints: number
  /** Entregue (limitado ao Max) ÷ capacity nas sprints com alocação, em %; null sem alocação. */
  capacityAdherence: number | null
  /** SP entregues acima do Max nas sprints com alocação: sobrecarga ou acima do nível atual. */
  overloadPoints: number
  overloadSprints: string[]
  /** Soma do Máximo (carga cheia nos dias válidos) nas sprints com alocação. */
  maxCapacity: number
  /** Soma do Máximo com a extensão (+3 dias úteis) nas sprints com alocação. */
  maxExtendedCapacity: number
  /** Carga acima do Máximo que coube na extensão (gordurinha usada) e em quantas sprints. */
  extensionUsedPoints: number
  extensionUsedSprints: number
  /** Quantas sprints com alocação caíram em cada situação. */
  sprintStatusCounts: Record<LoadStatus, number>
  /** Entrega real (sem limite) nas sprints com alocação, para comparar com Capacity e Max. */
  deliveredOnAllocatedSprintsRaw: number
  /** Situação da entrega nas sprints com alocação; null sem alocação. */
  loadStatus: LoadStatus | null
  byType: { type: string; points: number }[]
}

export function computePersonDevMetrics(
  input: PersonMetricsInput & { mode: DevAttribution; pointTypes: string[] },
): PersonDevMetrics {
  const sprintsByLabel = new Map(input.sprints.map((s) => [formatSprintLabel(s), s]))
  const capacity = capacityBySprint(input)
  const inSprint = sprintFilter(input, capacity)
  const items = attributeDevPoints(input.rows, input.person, input.mode, input.pointTypes, sprintsByLabel).filter(
    (item) =>
      inSprint(plannedSprintLabel(item.row)) && squadSelected(squadOfRow(input.squads ?? [], item.row), input.selectedSquads),
  )

  const bySprint = new Map<string, PersonDevSprint>()
  const sprintEntry = (label: string) => {
    const entry = bySprint.get(label) ?? { label, onTime: 0, delayed: 0, capacity: 0, max: 0, maxExtended: 0, bySquad: {}, byType: {}, isCurrent: false, inProgress: 0, inProgressDelayed: 0 }
    bySprint.set(label, entry)
    return entry
  }
  for (const [label, sprintCapacity] of capacity) {
    if (!inSprint(label)) continue
    Object.assign(sprintEntry(label), sprintCapacity)
  }
  const closed = items.filter((item) => isClosed(item.row))
  // Na sprint atual o que está em aberto ainda vai ser entregue: conta como comprometido.
  const { current: currentSprints, past: pastSprints } = sprintTimeline(input)
  for (const item of items) {
    const label = plannedSprintLabel(item.row)
    if (isClosed(item.row)) continue
    // Em sprint futura o item ainda não começou: não entra.
    if (currentSprints.has(label)) sprintEntry(label).inProgress += item.points
    else if (pastSprints.has(label)) sprintEntry(label).inProgressDelayed += item.points
  }
  const totalBySquad = new Map<string, number>()
  for (const item of closed) {
    const label = plannedSprintLabel(item.row)
    if (!label) continue
    const entry = sprintEntry(label)
    if (item.delay.delayed) entry.delayed += item.points
    else entry.onTime += item.points
    const squad = squadOfRow(input.squads ?? [], item.row)
    entry.bySquad[squad] = (entry.bySquad[squad] ?? 0) + item.points
    entry.byType[item.row.workItemType] = (entry.byType[item.row.workItemType] ?? 0) + item.points
    totalBySquad.set(squad, (totalBySquad.get(squad) ?? 0) + item.points)
  }
  const sprints = [...bySprint.values()]
    .map((s) => ({
      ...s,
      onTime: round1(s.onTime),
      delayed: round1(s.delayed),
      capacity: round1(s.capacity),
      max: round1(s.max),
      maxExtended: round1(s.maxExtended),
      isCurrent: currentSprints.has(s.label),
      inProgress: round1(s.inProgress),
      inProgressDelayed: round1(s.inProgressDelayed),
      bySquad: roundValues(s.bySquad),
      byType: roundValues(s.byType),
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
    inProgressPoints: round1(sprints.reduce((sum, s) => sum + s.inProgress, 0)),
    inProgressOnAllocatedSprints: round1(sprints.filter((s) => s.capacity > 0).reduce((sum, s) => sum + s.inProgress, 0)),
    inProgressDelayedPoints: round1(sprints.reduce((sum, s) => sum + s.inProgressDelayed, 0)),
    inProgressDelayedOnAllocatedSprints: round1(
      sprints.filter((s) => s.capacity > 0).reduce((sum, s) => sum + s.inProgressDelayed, 0),
    ),
    // Carga comprometida: entregue + em andamento (atual e atrasado), sempre exibidos separados.
    ...allocationAdherence(sprints, (s) => s.onTime + s.delayed + s.inProgress + s.inProgressDelayed),
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
  /**
   * Test Points executados pela pessoa já na escala de story points: cada resultado executado é
   * um Test Point, dividido pela proporção do relatório de teste da squad/sprint (padrão 3,5).
   */
  testPoints: number
  capacity: number
  /** Carga cheia (max points/dia) nos dias válidos. */
  max: number
  /** Carga cheia somando os SPRINT_EXTENSION_DAYS dias úteis de extensão (acima do Máximo). */
  maxExtended: number
  /** Testes executados por squad nesta sprint. */
  bySquad: Record<string, number>
}

export interface PersonQaItem {
  row: WorkItemRow
  delay: DelayInfo
}

export interface PersonQaMetrics {
  sprints: PersonQaSprint[]
  /** Squads com testes executados, da que mais teve para a que menos teve. */
  squadNames: string[]
  items: PersonQaItem[]
  executed: number
  passed: number
  failed: number
  averageExecutedPerSprint: number
  passedPercent: number
  failedPercent: number
  /** Test Points executados convertidos em SP (o parâmetro da aderência). */
  testPoints: number
  averageTestPointsPerSprint: number
  testCases: number
  /** Capacity da Alocação somada nas sprints do filtro. */
  capacity: number
  /** Test Points (SP) nas sprints com alocação, cada sprint limitada ao Max com extensão (o numerador da aderência). */
  deliveredOnAllocatedSprints: number
  allocatedSprints: number
  /** Test Points (limitados ao Max com extensão) ÷ capacity nas sprints com alocação, em %; null sem alocação. */
  capacityAdherence: number | null
  /** Test Points acima do Max com extensão nas sprints com alocação: sobrecarga ou acima do nível atual. */
  overloadPoints: number
  overloadSprints: string[]
  /** Soma do Máximo (carga cheia nos dias válidos) nas sprints com alocação. */
  maxCapacity: number
  /** Soma do Máximo com a extensão (+3 dias úteis) nas sprints com alocação. */
  maxExtendedCapacity: number
  /** Carga acima do Máximo que coube na extensão (gordurinha usada) e em quantas sprints. */
  extensionUsedPoints: number
  extensionUsedSprints: number
  /** Quantas sprints com alocação caíram em cada situação. */
  sprintStatusCounts: Record<LoadStatus, number>
  /** Test Points reais (sem limite) nas sprints com alocação. */
  deliveredOnAllocatedSprintsRaw: number
  /** Situação da entrega nas sprints com alocação; null sem alocação. */
  loadStatus: LoadStatus | null
  /** false quando nenhuma sincronização trouxe test results desta pessoa. */
  hasExecutions: boolean
}

export interface PersonQaInput extends PersonMetricsInput {
  executions: TestExecution[]
  /** Relatórios de teste por squad/sprint: dão a proporção Test Points : Story Point. */
  testReports?: TestReport[]
}

export function computePersonQaMetrics(input: PersonQaInput): PersonQaMetrics {
  const sprintsByLabel = new Map(input.sprints.map((s) => [formatSprintLabel(s), s]))
  const sprintsById = new Map(input.sprints.map((s) => [s.id, s]))
  const squadNamesById = new Map((input.squads ?? []).map((s) => [s.id, s.name]))
  const ratioByReport = new Map((input.testReports ?? []).map((r) => [`${r.squadId}|${r.sprintId}`, r.pointsRatio]))
  const capacity = capacityBySprint(input)
  const inSprint = sprintFilter(input, capacity)

  const bySprint = new Map<string, PersonQaSprint>()
  const sprintEntry = (label: string) => {
    const entry =
      bySprint.get(label) ?? { label, executed: 0, passed: 0, failed: 0, other: 0, testPoints: 0, capacity: 0, max: 0, maxExtended: 0, bySquad: {} }
    bySprint.set(label, entry)
    return entry
  }
  for (const [label, sprintCapacity] of capacity) {
    if (inSprint(label)) Object.assign(sprintEntry(label), sprintCapacity)
  }

  const executions = input.executions.filter(
    (e) =>
      isPersonItem({ email: e.email, assignedTo: e.name }, input.person) &&
      squadSelected(squadNamesById.get(e.squadId) ?? NO_SQUAD_LABEL, input.selectedSquads),
  )
  const executedBySquad = new Map<string, number>()
  for (const execution of executions) {
    const sprint = sprintsById.get(execution.sprintId)
    if (!sprint) continue
    const label = formatSprintLabel(sprint)
    if (!inSprint(label)) continue
    const entry = sprintEntry(label)
    entry.executed += execution.executed
    entry.passed += execution.passed
    entry.failed += execution.failed
    entry.other += execution.other
    // Mesma conversão do "Test Points" do Overview Squads: Test Points ÷ proporção do relatório.
    const ratio = ratioByReport.get(`${execution.squadId}|${execution.sprintId}`) ?? 0
    entry.testPoints += execution.executed / (ratio > 0 ? ratio : DEFAULT_TEST_POINTS_RATIO)
    const squad = squadNamesById.get(execution.squadId) ?? NO_SQUAD_LABEL
    entry.bySquad[squad] = (entry.bySquad[squad] ?? 0) + execution.executed
    executedBySquad.set(squad, (executedBySquad.get(squad) ?? 0) + execution.executed)
  }

  const items: PersonQaItem[] = input.rows
    .filter((row) => isType(row, QA_ITEM_TYPES) && isPersonItem(row, input.person))
    .filter((row) => inSprint(plannedSprintLabel(row)))
    .filter((row) => squadSelected(squadOfRow(input.squads ?? [], row), input.selectedSquads))
    .map((row) => ({ row, delay: delayInfo(row, sprintsByLabel) }))

  const sprints = [...bySprint.values()]
    .map((s) => ({ ...s, testPoints: round1(s.testPoints), capacity: round1(s.capacity), max: round1(s.max), maxExtended: round1(s.maxExtended) }))
    .sort((a, b) => compareSprintLabels(a.label, b.label))
  const sum = (pick: (s: PersonQaSprint) => number) => sprints.reduce((total, s) => total + pick(s), 0)
  const executed = sum((s) => s.executed)
  const testPoints = sum((s) => s.testPoints)

  return {
    sprints,
    squadNames: [...executedBySquad.entries()].sort((a, b) => b[1] - a[1]).map(([squad]) => squad),
    items,
    executed,
    passed: sum((s) => s.passed),
    failed: sum((s) => s.failed),
    averageExecutedPerSprint: averageOfActive(sprints.map((s) => s.executed)),
    passedPercent: percentOf(sum((s) => s.passed), executed),
    failedPercent: percentOf(sum((s) => s.failed), executed),
    testPoints: round1(testPoints),
    averageTestPointsPerSprint: averageOfActive(sprints.map((s) => s.testPoints)),
    testCases: items.length,
    ...allocationAdherence(sprints, (s) => s.testPoints),
    hasExecutions: executions.length > 0,
  }
}

// ---------------------------------------------------------------------------
// Tamanho dos itens

/** Faixas de story points (Fibonacci); cada item cai na menor faixa que o comporta. */
const SIZE_BUCKETS = [
  { label: '1', upTo: 1 },
  { label: '2', upTo: 2 },
  { label: '3', upTo: 3 },
  { label: '5', upTo: 5 },
  { label: '8', upTo: 8 },
  { label: '13', upTo: 13 },
  { label: '13+', upTo: Infinity },
]
export const UNSIZED_LABEL = 'Sem SP'

/** Itens fechados por tamanho (SP do item inteiro, não da fatia), para ver o perfil de entrega. */
export function sizeDistribution(items: PersonDevItem[]): { bucket: string; count: number }[] {
  const counts = new Map<string, number>([[UNSIZED_LABEL, 0], ...SIZE_BUCKETS.map(({ label }) => [label, 0] as const)])
  for (const { row } of items) {
    if (!isClosed(row)) continue
    const bucket =
      row.storyPoints > 0 ? (SIZE_BUCKETS.find(({ upTo }) => row.storyPoints <= upTo)?.label ?? '13+') : UNSIZED_LABEL
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }
  return [...counts.entries()].map(([bucket, count]) => ({ bucket, count }))
}

// ---------------------------------------------------------------------------
// Resumo de todas as pessoas

export interface PersonSummaryRow {
  person: Person
  tipo?: CargoTipo
  dev: PersonDevMetrics
  qa: PersonQaMetrics
}

export interface PeopleSummaryInput extends Omit<PersonMetricsInput, 'person'> {
  people: Person[]
  cargos: CargoConfig[]
  executions: TestExecution[]
  testReports?: TestReport[]
  mode: DevAttribution
  pointTypes: string[]
}

/**
 * Métricas de Dev e QA de cada pessoa com os mesmos filtros (sprint/squad). Fica só quem
 * tem algo nos filtros: item, teste executado ou alocação.
 */
export function computePeopleSummary(input: PeopleSummaryInput): PersonSummaryRow[] {
  const tipoByCargo = new Map(input.cargos.map((c) => [c.cargo, c.tipo]))
  return input.people
    .map((person) => ({
      person,
      tipo: tipoByCargo.get(person.cargo),
      dev: computePersonDevMetrics({ ...input, person }),
      qa: computePersonQaMetrics({ ...input, person }),
    }))
    .filter(
      ({ dev, qa }) => dev.items.length > 0 || dev.capacity > 0 || qa.executed > 0 || qa.testCases > 0 || qa.capacity > 0,
    )
    .sort((a, b) => a.person.nome.localeCompare(b.person.nome))
}
