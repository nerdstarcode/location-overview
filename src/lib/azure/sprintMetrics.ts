import { toDateKey } from '../dates'
import { round1 } from '../numbers'
import { normalizeKey } from '../text'
import { CLOSED_STATES, type WorkItemRow } from '../workItems'
import { STATE_ORDER } from '../stateColors'
import { excludeHidden } from '../hiddenWorkItemsStorage'
import type { CargoConfig } from '../cargosStorage'
import type { LevelConfig } from '../levelsStorage'
import type { Person } from '../peopleStorage'
import { computeAllocatedDays, findLevelFor, pointsForEntry, type PersonAllocation } from '../personAllocationsStorage'
import type { Sprint } from '../sprintsStorage'
import { summarizeTestRuns, type TestRunsSummary } from './mappers'
import type { AzureTeamMember, AzureTestRun } from './types'

export const UNASSIGNED_LABEL = 'Sem responsável'


const QA_CARGO_PATTERN = /\b(qa|quality|test|tester|teste)\b/i

const isClosed = (item: WorkItemRow) => CLOSED_STATES.has(item.state)
const isType = (item: WorkItemRow, type: string) => normalizeKey(item.workItemType) === normalizeKey(type)
const sumPoints = (items: WorkItemRow[]) => items.reduce((sum, item) => sum + item.storyPoints, 0)

export function isPointItem(item: WorkItemRow, pointTypes: string[]): boolean {
  return pointTypes.some((type) => isType(item, type))
}

export function totalStoryPoints(items: WorkItemRow[], pointTypes: string[]): number {
  return round1(sumPoints(items.filter((item) => isPointItem(item, pointTypes))))
}

/** Soma do Effort nos mesmos tipos que somam Story Points (Tasks ficam de fora para não contar em dobro). */
export function totalEffort(items: WorkItemRow[], pointTypes: string[]): number {
  return round1(items.filter((item) => isPointItem(item, pointTypes)).reduce((sum, item) => sum + (item.effort ?? 0), 0))
}

// ---------------------------------------------------------------------------
// Pontos por pessoa

export interface PersonPoints {
  name: string
  email: string
  storyPoints: number
  deliveredPoints: number
  itemCount: number
}

function personPointsOf(name: string, email: string, items: WorkItemRow[]): PersonPoints {
  return {
    name,
    email,
    storyPoints: round1(sumPoints(items)),
    deliveredPoints: round1(sumPoints(items.filter(isClosed))),
    itemCount: items.length,
  }
}

export function pointsByPerson(items: WorkItemRow[], pointTypes: string[]): { people: PersonPoints[]; unassigned: PersonPoints } {
  const byPerson = new Map<string, WorkItemRow[]>()
  const unassigned: WorkItemRow[] = []
  for (const item of items.filter((i) => isPointItem(i, pointTypes))) {
    const key = normalizeKey(item.email) || item.assignedTo.trim()
    if (key) byPerson.set(key, [...(byPerson.get(key) ?? []), item])
    else unassigned.push(item)
  }

  const people = [...byPerson.values()]
    .map((personItems) => personPointsOf(personItems[0].assignedTo, personItems[0].email, personItems))
    .sort((a, b) => b.storyPoints - a.storyPoints || a.name.localeCompare(b.name))
  return { people, unassigned: personPointsOf(UNASSIGNED_LABEL, '', unassigned) }
}

const hasAssignee = (item: WorkItemRow) => Boolean(normalizeKey(item.email) || item.assignedTo.trim())

/** Itens sem responsável por tipo: os que somam pontos (User Story, Bug, Enabler…) e também as Tasks. */
export function unassignedByType(items: WorkItemRow[], pointTypes: string[]): GroupPoints[] {
  const types = [...pointTypes, 'Task']
  return groupPoints(
    items.filter((item) => !hasAssignee(item) && types.some((type) => isType(item, type))),
    (item) => item.workItemType,
    types,
  )
}

// ---------------------------------------------------------------------------
// Burnup diário

export interface BurnupPoint {
  day: string
  delivered: number
  /** null para dias futuros. */
  cumulative: number | null
  /** Entrega linear do escopo ao longo dos dias úteis. */
  ideal: number
  scope: number
}

/**
 * SP fechados por dia útil. Fechamentos em fim de semana/day off entram no próximo
 * dia útil e os anteriores à sprint (ou sem data) no primeiro.
 */
function closedPointsByDay(items: WorkItemRow[], workingDays: string[]): number[] {
  const perDay = workingDays.map(() => 0)
  for (const item of items.filter(isClosed)) {
    const closedOn = item.closedDate ? toDateKey(item.closedDate) : workingDays[0]
    const index = workingDays.findIndex((day) => closedOn <= day)
    if (index >= 0) perDay[index] += item.storyPoints
  }
  return perDay
}

export function burnup(items: WorkItemRow[], pointTypes: string[], workingDays: string[], today = new Date()): BurnupPoint[] {
  const pointItems = items.filter((item) => isPointItem(item, pointTypes))
  const scope = round1(sumPoints(pointItems))
  const todayKey = toDateKey(today.toISOString())
  const perDay = closedPointsByDay(pointItems, workingDays)

  let cumulative = 0
  return workingDays.map((day, index) => {
    cumulative += perDay[index]
    return {
      day,
      delivered: round1(perDay[index]),
      cumulative: day > todayKey ? null : round1(cumulative),
      ideal: round1((scope * (index + 1)) / workingDays.length),
      scope,
    }
  })
}

// ---------------------------------------------------------------------------
// Agrupamentos por tipo e state

export interface GroupPoints {
  key: string
  storyPoints: number
  count: number
}

function groupPoints(items: WorkItemRow[], getKey: (item: WorkItemRow) => string, order: string[]): GroupPoints[] {
  const groups = new Map<string, WorkItemRow[]>()
  for (const item of items) {
    const key = getKey(item) || '(vazio)'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const normalizedOrder = order.map(normalizeKey)
  const rank = (key: string) => {
    const index = normalizedOrder.indexOf(normalizeKey(key))
    return index >= 0 ? index : order.length
  }
  return [...groups.entries()]
    .map(([key, groupItems]) => ({ key, storyPoints: round1(sumPoints(groupItems)), count: groupItems.length }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
}

/** Todos os tipos da sprint — os que somam pontos primeiro, na ordem configurada. */
export function pointsByType(items: WorkItemRow[], pointTypes: string[]): GroupPoints[] {
  return groupPoints(items, (item) => item.workItemType, pointTypes)
}

export function pointsByState(items: WorkItemRow[], pointTypes: string[]): GroupPoints[] {
  return groupPoints(
    items.filter((item) => isPointItem(item, pointTypes)),
    (item) => item.state,
    STATE_ORDER,
  )
}

// ---------------------------------------------------------------------------
// Tasks por item (User Story, Bug, Enabler — os tipos que somam pontos)

export interface UserStoryTasks {
  id: number
  workItemType: string
  title: string
  state: string
  assignedTo: string
  storyPoints: number
  effort: number
  timeCriticality: number
  wsjf: number
  tasks: number
  tasksDone: number
  /** Oculto na Análise da Sprint: aparece apagado na tabela e fica fora dos KPIs e gráficos. */
  hidden: boolean
}

/** Itens dos tipos que somam pontos (`pointTypes`) com as Tasks filhas de cada um. */
export function tasksPerUserStory(
  items: WorkItemRow[],
  pointTypes: string[],
  hiddenIds: ReadonlySet<number> = new Set(),
): UserStoryTasks[] {
  const tasks = items.filter((item) => isType(item, 'Task'))
  return items
    .filter((item) => isPointItem(item, pointTypes))
    .map((story) => {
      const children = tasks.filter((task) => task.parentId === story.id)
      return {
        id: story.id,
        workItemType: story.workItemType,
        title: story.title,
        state: story.state,
        assignedTo: story.assignedTo,
        storyPoints: story.storyPoints,
        effort: story.effort ?? 0,
        timeCriticality: story.timeCriticality ?? 0,
        wsjf: story.wsjf ?? 0,
        tasks: children.length,
        tasksDone: children.filter(isClosed).length,
        hidden: hiddenIds.has(story.id),
      }
    })
    .sort((a, b) => b.tasks - a.tasks || a.id - b.id)
}

// ---------------------------------------------------------------------------
// Story points × alocação

export type AllocationStatus = 'sem-cadastro' | 'sem-alocacao' | 'abaixo' | 'dentro' | 'acima'

export interface AllocationComparisonRow {
  name: string
  email: string
  person?: Person
  isMember: boolean
  isQa: boolean
  percentage: number | null
  capacity: number
  max: number
  assigned: number
  delivered: number
  /** Só para QA: faixa qaMin%–qaMax% do total da sprint, dividida entre os QAs proporcionalmente ao Capacity. */
  expectedMin: number | null
  expectedMax: number | null
  status: AllocationStatus
}

export interface AllocationComparisonInput {
  members: AzureTeamMember[]
  personPoints: PersonPoints[]
  totalPoints: number
  people: Person[]
  allocations: PersonAllocation[]
  levels: LevelConfig[]
  cargos: CargoConfig[]
  squadId?: string
  sprint?: Sprint
  qaMinPercent: number
  qaMaxPercent: number
}

type Participant = Pick<AllocationComparisonRow, 'name' | 'email' | 'isMember'>
type ResolvedParticipant = Omit<AllocationComparisonRow, 'expectedMin' | 'expectedMax' | 'status'>

/** QA pelo Tipo do cargo cadastrado; sem cadastro do cargo, pelo nome dele. */
export function isQaPerson(person: Person | undefined, cargos: CargoConfig[]): boolean {
  if (!person?.cargo) return false
  const cargo = cargos.find((c) => normalizeKey(c.cargo) === normalizeKey(person.cargo))
  return cargo ? cargo.tipo === 'QA' : QA_CARGO_PATTERN.test(person.cargo)
}

/** Pessoas alocadas (ferramenta de Alocação) na squad/sprint local. */
function allocatedPeople(input: Pick<AllocationComparisonInput, 'people' | 'allocations' | 'squadId' | 'sprint'>): Person[] {
  if (!input.squadId || !input.sprint) return []
  const personIds = new Set(
    input.allocations.filter((a) => a.squadId === input.squadId && a.sprintId === input.sprint?.id).map((a) => a.personId),
  )
  return input.people.filter((p) => personIds.has(p.id))
}

/** Membros do team + quem tem SP na sprint ou está alocado na squad/sprint sem ser membro. */
function collectParticipants(members: AzureTeamMember[], personPoints: PersonPoints[], allocated: Person[]): Participant[] {
  const byEmail = new Map<string, Participant>()
  for (const { identity } of members) {
    byEmail.set(normalizeKey(identity.uniqueName), { name: identity.displayName, email: identity.uniqueName, isMember: true })
  }
  for (const p of personPoints) {
    const key = normalizeKey(p.email)
    if (key && !byEmail.has(key)) byEmail.set(key, { name: p.name, email: p.email, isMember: false })
  }
  for (const person of allocated) {
    const key = normalizeKey(person.email)
    if (key && !byEmail.has(key)) byEmail.set(key, { name: person.nome, email: person.email, isMember: false })
  }
  return [...byEmail.values()]
}

/** Pessoa (por email) → alocação na squad/sprint → capacity/max pelo nível. */
function resolveCapacity(participant: Participant, input: AllocationComparisonInput): ResolvedParticipant {
  const key = normalizeKey(participant.email)
  const person = input.people.find((p) => normalizeKey(p.email) === key)
  const matches = person
    ? input.allocations.filter((a) => a.personId === person.id && a.squadId === input.squadId && a.sprintId === input.sprint?.id)
    : []
  const allocation = matches.length > 0 ? { percentage: matches.reduce((sum, a) => sum + a.percentage, 0) } : undefined
  const points = allocation && input.sprint ? pointsForEntry(allocation, input.sprint, person, input.levels) : { capacity: 0, max: 0 }
  const assigned = input.personPoints.find((p) => normalizeKey(p.email) === key)
  return {
    ...participant,
    person,
    isQa: isQaPerson(person, input.cargos),
    percentage: allocation?.percentage ?? null,
    capacity: round1(points.capacity),
    max: round1(points.max),
    assigned: assigned?.storyPoints ?? 0,
    delivered: assigned?.deliveredPoints ?? 0,
  }
}

function classifyStatus(assigned: number, min: number, max: number): AllocationStatus {
  if (assigned < min) return 'abaixo'
  if (max > 0 && assigned > max) return 'acima'
  return 'dentro'
}

/**
 * Parcela do QA na faixa da sprint: proporcional ao Capacity (ex.: 5 e 10 → 33,33% e 66,67%).
 * Sem Capacity em nenhum QA (sem nível/alocação), cai para a % de alocação e, por fim, divide igualmente.
 */
function qaShare(row: ResolvedParticipant, qaRows: ResolvedParticipant[]): number {
  const totalCapacity = qaRows.reduce((sum, qa) => sum + qa.capacity, 0)
  if (totalCapacity > 0) return row.capacity / totalCapacity
  const totalPercentage = qaRows.reduce((sum, qa) => sum + (qa.percentage ?? 0), 0)
  return totalPercentage > 0 ? (row.percentage ?? 0) / totalPercentage : 1 / qaRows.length
}

/** Faixa esperada de cada QA: qaMin%–qaMax% do total, dividida entre os QAs proporcionalmente ao Capacity (ver qaShare). */
function qaRangeFor(row: ResolvedParticipant, qaRows: ResolvedParticipant[], input: AllocationComparisonInput) {
  const share = qaShare(row, qaRows)
  return {
    expectedMin: round1(((input.totalPoints * input.qaMinPercent) / 100) * share),
    expectedMax: round1(((input.totalPoints * input.qaMaxPercent) / 100) * share),
  }
}

/**
 * Status do QA: a Faixa QA precisa caber em capacity–max. Passar do max tem prioridade
 * (inclusive quando a faixa passa dos dois lados); começar abaixo do capacity é "abaixo".
 */
export function classifyQaRange(expectedMin: number, expectedMax: number, capacity: number, max: number): AllocationStatus {
  if (expectedMax > max) return 'acima'
  if (expectedMin < capacity) return 'abaixo'
  return 'dentro'
}

function applyReference(row: ResolvedParticipant, qaRows: ResolvedParticipant[], input: AllocationComparisonInput): AllocationComparisonRow {
  if (!row.person) return { ...row, expectedMin: null, expectedMax: null, status: 'sem-cadastro' }
  if (row.isQa) {
    const range = qaRangeFor(row, qaRows, input)
    if (row.percentage === null) return { ...row, ...range, status: 'sem-alocacao' }
    return { ...row, ...range, status: classifyQaRange(range.expectedMin, range.expectedMax, row.capacity, row.max) }
  }
  if (row.percentage === null) return { ...row, expectedMin: null, expectedMax: null, status: 'sem-alocacao' }
  return { ...row, expectedMin: null, expectedMax: null, status: classifyStatus(row.assigned, row.capacity, row.max) }
}

/**
 * Cruza os SP atribuídos na sprint com a base local. Devs: SP atribuídos × capacity/max
 * (dias alocados × pontos/dia do nível). QAs: a faixa qaMin%–qaMax% dos SP totais (dividida
 * entre os QAs proporcionalmente ao capacity) × o capacity/max dele (ver classifyQaRange).
 */
export function allocationComparison(input: AllocationComparisonInput): AllocationComparisonRow[] {
  const rows = collectParticipants(input.members, input.personPoints, allocatedPeople(input)).map((p) => resolveCapacity(p, input))
  const qaRows = rows.filter((row) => row.isQa)
  return rows
    .map((row) => applyReference(row, qaRows, input))
    .sort((a, b) => Number(b.isMember) - Number(a.isMember) || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Alocação da squad/sprint na base local

export interface SprintAllocationEntry {
  personId: string
  name: string
  email: string
  cargo: string
  nivel: string
  percentage: number
  days: number
  capacity: number
  max: number
  assigned: number
  delivered: number
  /** Sem cadastro na base ou sem nível cadastrado — conta 0 em Capacity/Max. */
  missingLevel: boolean
}

export interface SprintAllocationSummary {
  entries: SprintAllocationEntry[]
  capacity: number
  max: number
  /** Quantas pessoas alocadas contam 0 por falta de nível (ou de cadastro). */
  missingLevel: number
}

type SprintAllocationInput = Pick<AllocationComparisonInput, 'people' | 'allocations' | 'levels' | 'squadId' | 'sprint'>

/** Pessoas alocadas (ferramenta de Alocação) na squad/sprint local, com capacity/max e os SP delas na sprint. */
export function sprintAllocation(input: SprintAllocationInput, personPoints: PersonPoints[]): SprintAllocationSummary {
  const { sprint, squadId } = input
  if (!sprint || !squadId) return { entries: [], capacity: 0, max: 0, missingLevel: 0 }

  // Uma pessoa pode ter mais de uma alocação na squad/sprint (registros duplicados somados
  // pelo provider): soma as porcentagens numa linha só.
  const percentageByPerson = new Map<string, number>()
  for (const a of input.allocations) {
    if (a.squadId !== squadId || a.sprintId !== sprint.id) continue
    percentageByPerson.set(a.personId, (percentageByPerson.get(a.personId) ?? 0) + a.percentage)
  }

  const entries = [...percentageByPerson.entries()]
    .map(([personId, percentage]) => {
      const person = input.people.find((p) => p.id === personId)
      const points = pointsForEntry({ percentage }, sprint, person, input.levels)
      const email = person?.email.trim() ?? ''
      const assigned = email ? personPoints.find((p) => normalizeKey(p.email) === normalizeKey(email)) : undefined
      return {
        personId,
        name: person?.nome ?? '(pessoa não cadastrada)',
        email,
        cargo: person?.cargo ?? '',
        nivel: person?.nivel ?? '',
        percentage,
        days: computeAllocatedDays(percentage, sprint.totalValidDays),
        capacity: round1(points.capacity),
        max: round1(points.max),
        assigned: assigned?.storyPoints ?? 0,
        delivered: assigned?.deliveredPoints ?? 0,
        missingLevel: !findLevelFor(person, input.levels),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    entries,
    capacity: round1(entries.reduce((sum, e) => sum + e.capacity, 0)),
    max: round1(entries.reduce((sum, e) => sum + e.max, 0)),
    missingLevel: entries.filter((e) => e.missingLevel).length,
  }
}

// ---------------------------------------------------------------------------
// Tudo junto para a página de análise

export interface SprintMetrics {
  totalPoints: number
  totalEffort: number
  deliveredPoints: number
  byPerson: PersonPoints[]
  unassigned: PersonPoints
  /** Contagem de itens sem responsável por tipo, incluindo Tasks. */
  unassignedByType: GroupPoints[]
  burnup: BurnupPoint[]
  byType: GroupPoints[]
  byState: GroupPoints[]
  userStories: UserStoryTasks[]
  allocation: AllocationComparisonRow[]
  /** Alocação cadastrada da squad/sprint local — vazia quando squad ou sprint não existem na base. */
  sprintAllocation: SprintAllocationSummary
  testRuns: TestRunsSummary | null
}

export interface SprintMetricsInput extends Omit<AllocationComparisonInput, 'personPoints' | 'totalPoints'> {
  items: WorkItemRow[]
  pointTypes: string[]
  workingDays: string[]
  testRuns: AzureTestRun[] | undefined
  /** Work items ocultos: saem de todas as métricas (com as Tasks filhas), menos da tabela `userStories`. */
  hiddenIds?: ReadonlySet<number>
}

export function computeSprintMetrics({
  items: allItems,
  pointTypes,
  workingDays,
  testRuns,
  hiddenIds = new Set(),
  ...allocationInput
}: SprintMetricsInput): SprintMetrics {
  const items = excludeHidden(allItems, hiddenIds)
  const totalPoints = totalStoryPoints(items, pointTypes)
  const { people, unassigned } = pointsByPerson(items, pointTypes)
  return {
    totalPoints,
    totalEffort: totalEffort(items, pointTypes),
    deliveredPoints: round1(people.reduce((sum, p) => sum + p.deliveredPoints, unassigned.deliveredPoints)),
    byPerson: people,
    unassigned,
    unassignedByType: unassignedByType(items, pointTypes),
    burnup: burnup(items, pointTypes, workingDays),
    byType: pointsByType(items, pointTypes),
    byState: pointsByState(items, pointTypes),
    userStories: tasksPerUserStory(allItems, pointTypes, hiddenIds),
    allocation: allocationComparison({ ...allocationInput, personPoints: people, totalPoints }),
    sprintAllocation: sprintAllocation(allocationInput, people),
    testRuns: testRuns ? summarizeTestRuns(testRuns) : null,
  }
}
