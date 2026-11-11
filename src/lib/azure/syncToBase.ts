import { createId } from '../createId'
import { toDateKey } from '../dates'
import { loadPeople, savePeople, type Person } from '../peopleStorage'
import { DEFAULT_TOTAL_VALID_DAYS, loadSprints, upsertSprint, type Sprint } from '../sprintsStorage'
import { loadSquads, upsertSquad, type Squad } from '../squadsStorage'
import { squadMatchesName } from '../squadMatching'
import { replaceTestCaseExecutions } from '../testCaseExecutionsStorage'
import { replaceTestExecutions } from '../testExecutionsStorage'
import { DEFAULT_TEST_POINTS_RATIO, loadTestReports, upsertTestReport } from '../testReportsStorage'
import { normalizeKey } from '../text'
import { QA_ITEM_TYPES } from '../personMetrics'
import type { StateChange, WorkItemRow } from '../workItems'
import { loadWorkItems, mergeWorkItems, saveWorkItems } from '../workItemsStorage'
import { getIterationWorkItems, getWorkItemsStateHistory, listTestRuns } from './api'
import { relevantTestRuns, testRunResultSummaries, type Dated } from './testRunResults'
import type { AzureConfig } from './azureConfigStorage'
import { isAbortError } from './client'
import { isPointItem } from './sprintMetrics'
import {
  azureWorkItemToRow,
  iterationSprintInfo,
  mergePersonTestSummaries,
  mergeTestCaseRunSummaries,
  summarizeTestRuns,
  testRunsToReportFields,
  type PersonTestSummary,
  type TestCaseRunSummary,
  type TestRunsSummary,
} from './mappers'
import type { AzureIteration, AzureTeamMember } from './types'

/** Resultado de uma sincronização: o que foi gravado, ou por que nada foi gravado. */
export type SyncOutcome<T> = { ok: true; result: T } | { ok: false; reason: string }

/** Squad cujo nome principal ou algum alias seja `name`. */
export function findSquadByName(squads: Squad[], name: string): Squad | undefined {
  return squads.find((squad) => squadMatchesName(squad, name))
}

export function findSprintForIteration(sprints: Sprint[], iteration: AzureIteration): Sprint | undefined {
  const info = iterationSprintInfo(iteration)
  if (!info) return undefined
  return sprints.find(
    (sprint) => sprint.number === info.number && normalizeKey(sprint.fiscalYear) === normalizeKey(info.fiscalYear),
  )
}

/** Team → Squad de mesmo nome ou alias (mantendo o id) ou uma nova. */
export function upsertSquadByName(name: string): { squad: Squad; created: boolean } {
  const existing = findSquadByName(loadSquads(), name)
  if (existing) return { squad: existing, created: false }
  const squad = { id: createId(), name: name.trim() }
  upsertSquad(squad)
  return { squad, created: true }
}

function newPersonFromMember({ identity }: AzureTeamMember, squadId: string): Person {
  return { id: createId(), nome: identity.displayName.trim(), email: identity.uniqueName.trim(), cargo: '', nivel: '', squadIds: [squadId] }
}

/**
 * Membros do Team → Pessoas, casando por email. Pessoas existentes só ganham o vínculo
 * com a squad (cargo/nível não mudam); as novas entram sem cargo/nível para completar depois.
 */
export function upsertPeopleFromTeam(squadId: string, members: AzureTeamMember[]): { created: number; linked: number } {
  const people = loadPeople()
  let created = 0
  let linked = 0
  for (const member of members) {
    const index = people.findIndex((p) => normalizeKey(p.email) === normalizeKey(member.identity.uniqueName))
    if (index < 0) {
      people.push(newPersonFromMember(member, squadId))
      created += 1
    } else if (!people[index].squadIds.includes(squadId)) {
      people[index] = { ...people[index], squadIds: [...people[index].squadIds, squadId] }
      linked += 1
    }
  }
  savePeople(people.sort((a, b) => a.nome.localeCompare(b.nome)))
  return { created, linked }
}

/**
 * Iteration → Sprint (por número + Fiscal Year). Sprint nova entra com
 * DEFAULT_TOTAL_VALID_DAYS; uma existente mantém o totalValidDays, que é editado
 * à mão (Sprints ou Análise da Sprint) — o calendário do Azure não o sobrescreve.
 * null quando o nome da iteration não segue "Sprint N - FYxx-yy" ou ela não tem datas.
 */
export function upsertSprintFromIteration(iteration: AzureIteration): { sprint: Sprint; created: boolean } | null {
  const info = iterationSprintInfo(iteration)
  const { startDate, finishDate } = iteration.attributes
  if (!info || !startDate || !finishDate) return null

  const existing = findSprintForIteration(loadSprints(), iteration)
  const sprint: Sprint = {
    id: existing?.id ?? createId(),
    number: info.number,
    fiscalYear: info.fiscalYear,
    startDate: toDateKey(startDate),
    endDate: toDateKey(finishDate),
    totalValidDays: existing?.totalValidDays ?? DEFAULT_TOTAL_VALID_DAYS,
  }
  upsertSprint(sprint)
  return { sprint, created: !existing }
}

/** Upsert por ID sobre a base de Work Items (mesma regra da importação por planilha). */
export function upsertWorkItems(rows: WorkItemRow[]): number {
  saveWorkItems(mergeWorkItems(loadWorkItems(), rows))
  return rows.length
}

/** Relatório de Testes da squad/sprint a partir dos runs, preservando o pointsRatio já ajustado. */
export function upsertTestReportFromRuns(squadId: string, sprintId: string, summary: TestRunsSummary): void {
  const existing = loadTestReports().find((r) => r.squadId === squadId && r.sprintId === sprintId)
  upsertTestReport({
    id: existing?.id ?? createId(),
    squadId,
    sprintId,
    pointsRatio: existing?.pointsRatio ?? DEFAULT_TEST_POINTS_RATIO,
    ...testRunsToReportFields(summary),
  })
}

export interface TeamSyncInput {
  teamName: string
  members: AzureTeamMember[]
  iterations: AzureIteration[]
}

export interface TeamSyncResult {
  squadCreated: boolean
  peopleCreated: number
  peopleLinked: number
  sprintsSynced: number
}

export function syncTeamToBase(input: TeamSyncInput): TeamSyncResult {
  const { squad, created } = upsertSquadByName(input.teamName)
  const people = upsertPeopleFromTeam(squad.id, input.members)
  const sprintsSynced = input.iterations.filter((iteration) => upsertSprintFromIteration(iteration) !== null).length
  return { squadCreated: created, peopleCreated: people.created, peopleLinked: people.linked, sprintsSynced }
}

export interface SprintSyncInput {
  teamName: string
  members: AzureTeamMember[]
  iteration: AzureIteration
  workItems: WorkItemRow[]
  testRuns: TestRunsSummary | null
  /** Testes executados por pessoa e dia; undefined quando os test results não foram buscados. */
  testExecutions?: Dated<PersonTestSummary>[]
  /** Execuções por Test Case, pessoa e dia (base das execuções por story point); idem. */
  testCaseExecutions?: Dated<TestCaseRunSummary>[]
}

export interface SprintSyncResult {
  squadCreated: boolean
  peopleCreated: number
  peopleLinked: number
  /** null quando a iteration não pôde virar Sprint (nome fora do padrão ou sem datas). */
  sprintCreated: boolean | null
  workItems: number
  testReport: boolean
  /** Pessoas com testes executados gravadas para a sprint. */
  testExecutions: number
  /** Test Cases com execução gravados para a sprint. */
  testCases: number
  /** Motivo de o histórico de estados não ter vindo (os itens foram gravados sem ele). */
  stateHistoryError?: string
}

/** Tipos com evolução por item: os de pontos e os de QA (Test Case / Test Plan). Tasks ficam de fora. */
export function needsStateHistory(row: WorkItemRow, config: AzureConfig): boolean {
  return isPointItem(row, config.pointTypes) || QA_ITEM_TYPES.some((type) => normalizeKey(type) === normalizeKey(row.workItemType))
}

/**
 * Histórico de State de cada item que precisa dele (`needsStateHistory`), com o mínimo de pedidos ao
 * Azure: o histórico já salvo é reaproveitado quando a revisão do item não mudou desde a última
 * sincronização, e só os demais são buscados (um pedido por item).
 */
export async function stateHistoriesFor(
  config: AzureConfig,
  rows: WorkItemRow[],
  signal?: AbortSignal,
  saved: WorkItemRow[] = loadWorkItems(),
): Promise<Map<number, StateChange[]>> {
  const savedById = new Map(saved.map((row) => [row.id, row]))
  const history = new Map<number, StateChange[]>()
  const toFetch: number[] = []
  for (const row of rows) {
    if (!needsStateHistory(row, config)) continue
    const previous = savedById.get(row.id)
    if (previous?.stateHistory && row.rev !== undefined && previous.rev === row.rev) history.set(row.id, previous.stateHistory)
    else toFetch.push(row.id)
  }
  for (const [id, changes] of await getWorkItemsStateHistory(config, toFetch, signal)) history.set(id, changes)
  return history
}

/**
 * Junta a cada item o histórico de State (para a evolução Active → Testing → Done). Se a busca falhar,
 * devolve os itens sem histórico e o motivo, para a sincronização seguir; o cancelamento propaga.
 */
export async function withStateHistory(
  config: AzureConfig,
  rows: WorkItemRow[],
  signal?: AbortSignal,
): Promise<{ rows: WorkItemRow[]; error?: string }> {
  try {
    const history = await stateHistoriesFor(config, rows, signal)
    return { rows: rows.map((row) => ({ ...row, stateHistory: history.get(row.id) ?? row.stateHistory })) }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error
    return { rows, error: error instanceof Error ? error.message : String(error) }
  }
}

function syncTestReport(squadId: string, sprint: Sprint | undefined, testRuns: TestRunsSummary | null): boolean {
  if (!sprint || !testRuns || testRuns.runCount === 0) return false
  upsertTestReportFromRuns(squadId, sprint.id, testRuns)
  return true
}

/**
 * Sprint cadastrada que contém o dia ("yyyy-mm-dd") da execução; a sincronizada quando o dia cai nela,
 * não tem data ou não cai em nenhuma sprint cadastrada.
 */
export function sprintForDay(day: string | undefined, sprints: Sprint[], synced: Sprint): Sprint {
  const contains = (sprint: Sprint) => !!sprint.startDate && !!sprint.endDate && sprint.startDate <= day! && day! <= sprint.endDate
  if (!day || contains(synced)) return synced
  return sprints.find(contains) ?? synced
}

/** Agrupa os resumos pela sprint da data de execução e soma cada grupo com `merge`. */
function bySprintOfDay<T>(summaries: Dated<T>[], synced: Sprint, merge: (list: T[]) => T[]): (T & { sprintId: string })[] {
  const sprints = loadSprints()
  const groups = new Map<string, T[]>()
  for (const { day, ...summary } of summaries) {
    const sprintId = sprintForDay(day, sprints, synced).id
    groups.set(sprintId, [...(groups.get(sprintId) ?? []), summary as T])
  }
  return [...groups.entries()].flatMap(([sprintId, list]) => merge(list).map((summary) => ({ ...summary, sprintId })))
}

function syncTestExecutions(squadId: string, sprint: Sprint | undefined, executions: Dated<PersonTestSummary>[] | undefined): number {
  if (!sprint || !executions) return 0
  const entries = bySprintOfDay(executions, sprint, mergePersonTestSummaries)
  replaceTestExecutions(squadId, sprint.id, entries)
  return new Set(entries.map((e) => e.email.toLowerCase())).size
}

function syncTestCaseExecutions(squadId: string, sprint: Sprint | undefined, executions: Dated<TestCaseRunSummary>[] | undefined): number {
  if (!sprint || !executions) return 0
  replaceTestCaseExecutions(squadId, sprint.id, bySprintOfDay(executions, sprint, mergeTestCaseRunSummaries))
  return new Set(executions.map((e) => e.testCaseId)).size
}

export function syncSprintToBase(input: SprintSyncInput): SprintSyncResult {
  const { squad, created: squadCreated } = upsertSquadByName(input.teamName)
  const people = upsertPeopleFromTeam(squad.id, input.members)
  const sprintResult = upsertSprintFromIteration(input.iteration)
  return {
    squadCreated,
    peopleCreated: people.created,
    peopleLinked: people.linked,
    sprintCreated: sprintResult ? sprintResult.created : null,
    workItems: upsertWorkItems(input.workItems),
    testReport: syncTestReport(squad.id, sprintResult?.sprint, input.testRuns),
    testExecutions: syncTestExecutions(squad.id, sprintResult?.sprint, input.testExecutions),
    testCases: syncTestCaseExecutions(squad.id, sprintResult?.sprint, input.testCaseExecutions),
  }
}

export type IterationSyncStatus =
  | { status: 'pending' | 'running' }
  | { status: 'done'; result: SprintSyncResult }
  | { status: 'error'; reason: string }

/** Status de cada sprint do lote, por id da iteration. */
export type IterationSyncProgress = Record<string, IterationSyncStatus>

export interface IterationsSyncInput {
  config: AzureConfig
  project: string
  teamName: string
  members: AzureTeamMember[]
  iterations: AzureIteration[]
  signal?: AbortSignal
  onProgress?: (progress: IterationSyncProgress) => void
}

/** Resumo dos runs da sprint e os testes executados por pessoa (um pedido de results por run). */
async function fetchIterationTests(
  config: AzureConfig,
  project: string,
  iteration: AzureIteration,
  signal?: AbortSignal,
): Promise<{ testRuns: TestRunsSummary | null; testExecutions?: Dated<PersonTestSummary>[]; testCaseExecutions?: Dated<TestCaseRunSummary>[] }> {
  const { startDate, finishDate } = iteration.attributes
  if (!startDate || !finishDate) return { testRuns: null }
  const runs = await listTestRuns(config, project, startDate, finishDate, signal)
  // O resumo da sprint conta todos os runs; os resultados (um pedido por run) só dos que a configuração inclui.
  const results = await testRunResultSummaries(config, project, relevantTestRuns(runs, iteration.path, config), signal)
  return { testRuns: summarizeTestRuns(runs), testExecutions: results.persons, testCaseExecutions: results.testCases }
}

/**
 * Busca no Azure e grava na base, uma sprint por vez, o mesmo que o "Salvar na base" da
 * análise de cada sprint. Uma sprint com erro não interrompe as demais; o cancelamento
 * (signal) interrompe o lote e propaga o AbortError.
 */
export async function syncIterationsToBase(input: IterationsSyncInput): Promise<IterationSyncProgress> {
  const { config, project, signal, onProgress } = input
  let progress: IterationSyncProgress = Object.fromEntries(input.iterations.map((it) => [it.id, { status: 'pending' }]))
  const update = (id: string, status: IterationSyncStatus) => {
    progress = { ...progress, [id]: status }
    onProgress?.(progress)
  }
  onProgress?.(progress)

  for (const iteration of input.iterations) {
    signal?.throwIfAborted()
    update(iteration.id, { status: 'running' })
    try {
      const items = await getIterationWorkItems(config, project, iteration.path, signal)
      const tests = await fetchIterationTests(config, project, iteration, signal)
      const withHistory = await withStateHistory(config, items.map((item) => azureWorkItemToRow(item, config)), signal)
      const result = syncSprintToBase({
        teamName: input.teamName,
        members: input.members,
        iteration,
        workItems: withHistory.rows,
        ...tests,
      })
      update(iteration.id, { status: 'done', result: { ...result, stateHistoryError: withHistory.error } })
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error
      update(iteration.id, { status: 'error', reason: error instanceof Error ? error.message : String(error) })
    }
  }
  return progress
}
