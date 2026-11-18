import { matchingWorkItems } from '../allocationWorkItems'
import type { CargoConfig } from '../cargosStorage'
import type { Person } from '../peopleStorage'
import { pointsForEntry, type PersonAllocation } from '../personAllocationsStorage'
import type { LevelConfig } from '../levelsStorage'
import { round1 } from '../numbers'
import { squadMatchesName } from '../squadMatching'
import type { Sprint } from '../sprintsStorage'
import type { Squad } from '../squadsStorage'
import { stateRank } from '../stateColors'
import type { TestCaseExecution } from '../testCaseExecutionsStorage'
import { normalizeKey } from '../text'
import { CLOSED_STATES, type WorkItemRow } from '../workItems'
import { isPointItem, isQaPerson, type AllocationStatus } from './sprintMetrics'

// Visão de Daily da Análise da Sprint: pessoa a pessoa (Pessoa → Squad → US → tasks por State),
// com a alocação entre squads e, no fim, o que está sem responsável.

export interface DailyTestCase {
  id: number
  title: string
  state: string
  /** Responsável pelo Test Case (Assigned To); vazio se o Test Case não foi carregado. */
  assignedTo: string
  email: string
  executed: number
  passed: number
  failed: number
}

export interface DailyStateColumn {
  state: string
  tasks: WorkItemRow[]
}

export interface DailyStory {
  /** A US/Bug/Enabler; null no grupo "Sem US" (tasks sem item de pontos pai). */
  row: WorkItemRow | null
  /** Todas as tasks da US (não só as da pessoa). */
  tasks: WorkItemRow[]
  done: number
  total: number
  columns: DailyStateColumn[]
  /** Test Cases ligados (Tested By) à US e às tasks dela; só na passagem de QAs. */
  testCases?: DailyTestCase[]
}

export interface DailySquad {
  key: string
  name: string
  /** % alocado nesta squad/sprint na base local; null quando a pessoa não está alocada nela. */
  percentage: number | null
  /** Squad atual (dados ao vivo do Azure) ou outra squad (base local sincronizada). */
  live: boolean
  /** false quando a base local não tem work items desta squad/sprint. */
  hasData: boolean
  openTasks: number
  totalTasks: number
  stories: DailyStory[]
  /** Pontos pela alocação nesta squad (dias alocados × pontos/dia do nível). */
  capacity: number
  max: number
  /** Dev: SP das USs atribuídas à pessoa. QA: SP das USs com Test Case que aparecem para ela. */
  assigned: number
  /** Só QA: faixa qaMin%–qaMax% sobre os SP das USs com testes dela. */
  expectedMin: number | null
  expectedMax: number | null
  /** null quando a pessoa não está alocada nesta squad. */
  status: AllocationStatus | null
  /** Só QA: testes que a pessoa executou na sprint nesta squad (base local sincronizada). */
  executed: TestCounts | null
}

export interface TestCounts {
  executed: number
  passed: number
  failed: number
}

export interface DailyPerson {
  key: string
  name: string
  email: string
  isQa: boolean
  squads: DailySquad[]
  /** Somas de todas as squads. */
  totals: Pick<DailySquad, 'capacity' | 'max' | 'assigned' | 'expectedMin' | 'expectedMax' | 'executed' | 'status'>
}

export interface DailyView {
  people: DailyPerson[]
  /** USs e tasks abertas sem responsável no team atual. */
  unassigned: DailyStory[]
  /** SP dos itens de pontos do team atual por responsável e State. */
  pointsByPerson: PersonStatePoints[]
  /** States presentes em pointsByPerson, na ordem de STATE_ORDER. */
  states: string[]
  /** Execuções de teste por US (Test Cases ligados à US e às tasks), por quem executou. */
  testsByStory: StoryTests[]
}

export interface PersonStatePoints {
  name: string
  byState: Record<string, number>
  total: number
  /** Capacity/Max da pessoa na squad atual (alocação da base local). */
  capacity?: number
  max?: number
}

export interface StoryTests {
  row: WorkItemRow
  byTester: (TestCounts & { name: string; email: string })[]
  total: TestCounts
}

export interface DailyInput {
  /** Work items ao vivo do team/iteration atual. */
  liveItems: WorkItemRow[]
  /** Nome exibido para a squad atual (squad local ou nome do team). */
  liveSquadName: string
  localSquad: Squad | undefined
  localSprint: Sprint | undefined
  pointTypes: string[]
  hiddenIds?: ReadonlySet<number>
  /** Test Cases ligados, buscados no Azure (dão o responsável de cada Test Case). */
  testCases?: WorkItemRow[]
  qaMinPercent: number
  qaMaxPercent: number
  base: {
    levels: LevelConfig[]
    workItems: WorkItemRow[]
    squads: Squad[]
    sprints: Sprint[]
    people: Person[]
    allocations: PersonAllocation[]
    cargos: CargoConfig[]
    testCaseExecutions: TestCaseExecution[]
  }
}

const isTask = (item: WorkItemRow) => normalizeKey(item.workItemType) === 'task'
const isClosed = (item: WorkItemRow) => CLOSED_STATES.has(item.state)
const isRemoved = (item: WorkItemRow) => normalizeKey(item.state) === 'removed'
const emailKey = (email: string | undefined) => (email ?? '').trim().toLowerCase()

function columnsOf(tasks: WorkItemRow[]): DailyStateColumn[] {
  const byState = new Map<string, WorkItemRow[]>()
  for (const task of tasks) byState.set(task.state || '(vazio)', [...(byState.get(task.state || '(vazio)') ?? []), task])
  return [...byState.entries()]
    .sort(([a], [b]) => stateRank(a) - stateRank(b) || a.localeCompare(b))
    .map(([state, list]) => ({ state, tasks: list.sort((a, b) => a.id - b.id) }))
}

function story(row: WorkItemRow | null, tasks: WorkItemRow[]): DailyStory {
  return { row, tasks, done: tasks.filter(isClosed).length, total: tasks.length, columns: columnsOf(tasks) }
}

// Abertas primeiro, depois por id; "Sem US" por último.
function sortStories(stories: DailyStory[]): DailyStory[] {
  return stories.sort((a, b) => {
    if (!a.row || !b.row) return a.row ? -1 : b.row ? 1 : 0
    return Number(isClosed(a.row)) - Number(isClosed(b.row)) || a.row.id - b.row.id
  })
}

interface SquadItems {
  stories: WorkItemRow[]
  tasksByParent: Map<number, WorkItemRow[]>
  orphanTasks: WorkItemRow[]
}

function indexItems(items: WorkItemRow[], pointTypes: string[]): SquadItems {
  const visible = items.filter((item) => !isRemoved(item))
  const stories = visible.filter((item) => isPointItem(item, pointTypes))
  const storyIds = new Set(stories.map((s) => s.id))
  const tasksByParent = new Map<number, WorkItemRow[]>()
  const orphanTasks: WorkItemRow[] = []
  for (const task of visible.filter(isTask)) {
    if (task.parentId && storyIds.has(task.parentId)) tasksByParent.set(task.parentId, [...(tasksByParent.get(task.parentId) ?? []), task])
    else orphanTasks.push(task)
  }
  return { stories, tasksByParent, orphanTasks }
}

/**
 * USs atribuídas à pessoa ou com task dela + tasks soltas dela ("Sem US"). QAs (`withTestCases`)
 * normalmente não têm tasks: veem também as USs com algum Test Case ligado (Tested By) que executaram.
 */
function personStories(index: SquadItems, email: string, testedBy?: (testCaseId: number) => boolean): { stories: DailyStory[]; own: WorkItemRow[] } {
  const mine = (item: WorkItemRow) => emailKey(item.email) === email
  const stories: DailyStory[] = []
  const own: WorkItemRow[] = []
  for (const row of index.stories) {
    const tasks = index.tasksByParent.get(row.id) ?? []
    const tested = testedBy !== undefined && [row, ...tasks].some((item) => (item.testCaseIds ?? []).some(testedBy))
    if (!mine(row) && !tasks.some(mine) && !tested) continue
    stories.push(story(row, tasks))
    own.push(...tasks.filter(mine))
  }
  const orphans = index.orphanTasks.filter(mine)
  if (orphans.length > 0) stories.push(story(null, orphans))
  own.push(...orphans)
  return { stories: sortStories(stories), own }
}

function testCasesFor(
  entry: DailyStory,
  titles: Map<number, WorkItemRow>,
  executions: Map<number, { executed: number; passed: number; failed: number }>,
): DailyTestCase[] {
  const ids = [...new Set([...(entry.row?.testCaseIds ?? []), ...entry.tasks.flatMap((task) => task.testCaseIds ?? [])])].sort((a, b) => a - b)
  return ids.map((id) => {
    const row = titles.get(id)
    const counts = executions.get(id) ?? { executed: 0, passed: 0, failed: 0 }
    return { id, title: row?.title ?? '', state: row?.state ?? '', assignedTo: row?.assignedTo ?? '', email: row?.email ?? '', ...counts }
  })
}

/** QA na Daily: vale o ponto mais alto da faixa — dentro se ficar entre capacity e max. */
export function classifyQaTop(expectedMax: number, capacity: number, max: number): AllocationStatus {
  if (expectedMax > max) return 'acima'
  if (expectedMax < capacity) return 'abaixo'
  return 'dentro'
}

export function buildDaily(input: DailyInput): DailyView {
  const { localSquad, localSprint, pointTypes, base } = input
  const hidden = input.hiddenIds ?? new Set<number>()
  const liveItems = input.liveItems.filter((item) => !hidden.has(item.id))
  const liveIndex = indexItems(liveItems, pointTypes)

  // A mesma sprint/squad pode ter registros duplicados na base: compara por número/FY e por nome.
  const sprintIds = new Set(
    localSprint
      ? base.sprints
          .filter((s) => s.number === localSprint.number && normalizeKey(s.fiscalYear) === normalizeKey(localSprint.fiscalYear))
          .map((s) => s.id)
      : [],
  )
  const isLiveSquad = (squadId: string) => {
    if (!localSquad) return false
    const squad = base.squads.find((s) => s.id === squadId)
    return squadId === localSquad.id || (squad ? squadMatchesName(squad, localSquad.name) : false)
  }
  const sprintAllocations = base.allocations.filter((a) => sprintIds.has(a.sprintId))

  // Pessoas: alocadas na squad atual nesta sprint ∪ quem tem item atribuído no team.
  const peopleByEmail = new Map(base.people.filter((p) => p.email.trim()).map((p) => [emailKey(p.email), p]))
  const participants = new Map<string, { name: string; email: string; person?: Person }>()
  for (const allocation of sprintAllocations.filter((a) => isLiveSquad(a.squadId))) {
    const person = base.people.find((p) => p.id === allocation.personId)
    if (!person) continue
    const key = emailKey(person.email) || `id:${person.id}`
    participants.set(key, { name: person.nome, email: person.email, person })
  }
  for (const item of liveItems) {
    const key = emailKey(item.email)
    if (!key || participants.has(key)) continue
    const person = peopleByEmail.get(key)
    participants.set(key, { name: person?.nome ?? item.assignedTo, email: item.email, person })
  }

  const titles = new Map([...base.workItems, ...liveItems, ...(input.testCases ?? [])].map((row) => [row.id, row]))
  const executions = new Map<number, { executed: number; passed: number; failed: number }>()
  for (const run of base.testCaseExecutions) {
    if (!sprintIds.has(run.sprintId)) continue
    const entry = executions.get(run.testCaseId) ?? { executed: 0, passed: 0, failed: 0 }
    entry.executed += run.executed
    entry.passed += run.passed
    entry.failed += run.failed
    executions.set(run.testCaseId, entry)
  }

  const sprintForMatch = localSprint
  const people: DailyPerson[] = [...participants.entries()].map(([key, { name, email, person }]) => {
    const isQa = isQaPerson(person, base.cargos)
    const qaExecutions = new Map<number, TestCounts>()
    if (isQa) {
      for (const run of base.testCaseExecutions) {
        if (!sprintIds.has(run.sprintId) || emailKey(run.email) !== key) continue
        const counts = qaExecutions.get(run.testCaseId) ?? { executed: 0, passed: 0, failed: 0 }
        counts.executed += run.executed
        counts.passed += run.passed
        counts.failed += run.failed
        qaExecutions.set(run.testCaseId, counts)
      }
    }
    const mineAllocations = person ? sprintAllocations.filter((a) => a.personId === person.id) : []
    const livePercentage = mineAllocations.filter((a) => isLiveSquad(a.squadId)).reduce((sum, a) => sum + a.percentage, 0)

    const toSquad = (squadKey: string, squadName: string, live: boolean, index: SquadItems | null, percentage: number | null): DailySquad => {
      const { stories, own } = index ? personStories(index, key, isQa ? (id) => qaExecutions.has(id) : undefined) : { stories: [], own: [] }
      // QA: só os Test Cases que ele executou na sprint, com as execuções dele.
      if (isQa) for (const entry of stories) entry.testCases = testCasesFor(entry, titles, qaExecutions).filter((tc) => tc.executed > 0)
      const points =
        percentage !== null && localSprint ? pointsForEntry({ percentage }, localSprint, person, base.levels) : { capacity: 0, max: 0 }
      const capacity = round1(points.capacity)
      const max = round1(points.max)
      const ownedSp = (rows: WorkItemRow[]) => round1(rows.reduce((sum, row) => sum + row.storyPoints, 0))
      const storyRows = stories.flatMap((entry) => (entry.row ? [entry.row] : []))
      let assigned: number
      let expectedMin: number | null = null
      let expectedMax: number | null = null
      let status: AllocationStatus | null = null
      if (isQa) {
        // Faixa QA: SP das USs em que a pessoa é responsável por algum Test Case ligado.
        // Faixa QA: SP das USs em que a pessoa é responsável por algum Test Case ligado (executado ou não).
        const ownsTestCase = (row: WorkItemRow) =>
          [row, ...(index?.tasksByParent.get(row.id) ?? [])].some((item) => (item.testCaseIds ?? []).some((id) => emailKey(titles.get(id)?.email) === key))
        assigned = ownedSp((index?.stories ?? []).filter(ownsTestCase))
        expectedMin = round1((assigned * input.qaMinPercent) / 100)
        expectedMax = round1((assigned * input.qaMaxPercent) / 100)
        if (percentage !== null) status = classifyQaTop(expectedMax, capacity, max)
      } else {
        assigned = ownedSp(storyRows.filter((row) => emailKey(row.email) === key))
        if (percentage !== null) status = assigned < capacity ? 'abaixo' : max > 0 && assigned > max ? 'acima' : 'dentro'
      }
      // Execuções da própria pessoa nesta squad, na sprint (pela data de execução).
      const runs = isQa
        ? base.testCaseExecutions.filter(
            (run) => sprintIds.has(run.sprintId) && emailKey(run.email) === key && (live ? isLiveSquad(run.squadId) : run.squadId === squadKey),
          )
        : []
      const executed = isQa
        ? runs.reduce((acc, run) => ({ executed: acc.executed + run.executed, passed: acc.passed + run.passed, failed: acc.failed + run.failed }), { executed: 0, passed: 0, failed: 0 })
        : null
      return {
        executed,
        capacity,
        max,
        assigned,
        expectedMin,
        expectedMax,
        status,
        key: squadKey,
        name: squadName,
        percentage,
        live,
        hasData: live || (index !== null && (index.stories.length > 0 || index.orphanTasks.length > 0)),
        openTasks: own.filter((task) => !isClosed(task)).length,
        totalTasks: own.length,
        stories,
      }
    }

    const squads: DailySquad[] = [
      toSquad('live', input.liveSquadName, true, liveIndex, livePercentage > 0 ? livePercentage : null),
    ]
    // Outras squads em que a pessoa está alocada nesta sprint: work items da base local.
    const otherSquadIds = [...new Set(mineAllocations.filter((a) => !isLiveSquad(a.squadId)).map((a) => a.squadId))]
    for (const squadId of otherSquadIds) {
      const squad = base.squads.find((s) => s.id === squadId)
      if (!squad) continue
      const percentage = mineAllocations.filter((a) => a.squadId === squadId).reduce((sum, a) => sum + a.percentage, 0)
      const items = sprintForMatch ? matchingWorkItems(base.workItems, squad, sprintForMatch) : []
      squads.push(toSquad(squadId, squad.name, false, items.length > 0 ? indexItems(items, pointTypes) : null, percentage))
    }
    const sum = (pick: (s: DailySquad) => number | null) => round1(squads.reduce((total, s) => total + (pick(s) ?? 0), 0))
    const totals = {
      capacity: sum((s) => s.capacity),
      max: sum((s) => s.max),
      assigned: sum((s) => s.assigned),
      expectedMin: isQa ? sum((s) => s.expectedMin) : null,
      expectedMax: isQa ? sum((s) => s.expectedMax) : null,
      executed: isQa
        ? { executed: sum((s) => s.executed?.executed ?? 0), passed: sum((s) => s.executed?.passed ?? 0), failed: sum((s) => s.executed?.failed ?? 0) }
        : null,
    }
    const allocated = squads.some((s) => s.percentage !== null)
    const status: AllocationStatus | null = !allocated
      ? null
      : isQa
        ? classifyQaTop(totals.expectedMax ?? 0, totals.capacity, totals.max)
        : totals.assigned < totals.capacity
          ? 'abaixo'
          : totals.max > 0 && totals.assigned > totals.max
            ? 'acima'
            : 'dentro'
    return { key, name, email, isQa, squads, totals: { ...totals, status } }
  })
  people.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  // Sem responsável (team atual): USs abertas sem responsável e USs com task aberta sem responsável.
  const unowned = (item: WorkItemRow) => !emailKey(item.email) && !isClosed(item)
  const unassigned: DailyStory[] = []
  for (const row of liveIndex.stories) {
    const tasks = liveIndex.tasksByParent.get(row.id) ?? []
    if (unowned(row) || tasks.some(unowned)) unassigned.push(story(row, tasks))
  }
  const orphanUnowned = liveIndex.orphanTasks.filter(unowned)
  if (orphanUnowned.length > 0) unassigned.push(story(null, orphanUnowned))

  // SP por pessoa × State (team atual).
  const pointsMap = new Map<string, PersonStatePoints>()
  const stateSet = new Set<string>()
  for (const row of liveIndex.stories) {
    const name = row.assignedTo || 'Sem responsável'
    const entry = pointsMap.get(name) ?? { name, byState: {}, total: 0 }
    entry.byState[row.state] = round1((entry.byState[row.state] ?? 0) + row.storyPoints)
    entry.total = round1(entry.total + row.storyPoints)
    stateSet.add(row.state)
    pointsMap.set(name, entry)
  }
  const pointsByPerson = [...pointsMap.values()].sort(
    (a, b) => Number(a.name === 'Sem responsável') - Number(b.name === 'Sem responsável') || b.total - a.total,
  )
  for (const entry of pointsByPerson) {
    const person = people.find((p) => normalizeKey(p.name) === normalizeKey(entry.name))
    const squad = person?.squads.find((sq) => sq.live)
    if (squad && squad.max > 0) Object.assign(entry, { capacity: squad.capacity, max: squad.max })
  }
  const states = [...stateSet].sort((a, b) => stateRank(a) - stateRank(b) || a.localeCompare(b))

  // Testes executados por US, por quem executou (execuções da sprint na base local).
  const testsByStory: StoryTests[] = []
  for (const row of liveIndex.stories) {
    const tasks = liveIndex.tasksByParent.get(row.id) ?? []
    const ids = new Set([...(row.testCaseIds ?? []), ...tasks.flatMap((task) => task.testCaseIds ?? [])])
    if (ids.size === 0) continue
    const byEmail = new Map<string, TestCounts & { name: string; email: string }>()
    for (const run of base.testCaseExecutions) {
      if (!sprintIds.has(run.sprintId) || !ids.has(run.testCaseId)) continue
      const k = emailKey(run.email) || '(automatizado)'
      const entry = byEmail.get(k) ?? { name: run.name || peopleByEmail.get(k)?.nome || '(automatizado)', email: run.email, executed: 0, passed: 0, failed: 0 }
      entry.executed += run.executed
      entry.passed += run.passed
      entry.failed += run.failed
      byEmail.set(k, entry)
    }
    const byTester = [...byEmail.values()].sort((a, b) => b.executed - a.executed)
    const total = byTester.reduce((acc, t) => ({ executed: acc.executed + t.executed, passed: acc.passed + t.passed, failed: acc.failed + t.failed }), { executed: 0, passed: 0, failed: 0 })
    testsByStory.push({ row, byTester, total })
  }
  testsByStory.sort((a, b) => b.total.executed - a.total.executed || a.row.id - b.row.id)

  return { people, unassigned: sortStories(unassigned), pointsByPerson, states, testsByStory }
}
