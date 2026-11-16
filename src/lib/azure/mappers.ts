import { toDateKey } from '../dates'
import { percentOf } from '../numbers'
import { buildWorkItemRow, CLOSED_STATES, parseSprintInfo, type StateChange, type WorkItemRow } from '../workItems'
import type { AzureConfig } from './azureConfigStorage'
import type {
  AzureIdentity,
  AzureIteration,
  AzureTestResult,
  AzureTestRun,
  AzureWorkItem,
  AzureWorkItemComment,
  AzureWorkItemUpdate,
} from './types'

const FALLBACK_STORY_POINTS_FIELD = 'Microsoft.VSTS.Scheduling.StoryPoints'
const TIME_CRITICALITY_FIELD = 'Microsoft.VSTS.Common.TimeCriticality'

/**
 * Valor do campo `name`; sem ele, o primeiro campo cujo reference name termine em
 * ".{suffix}" (ex.: "Custom.WSJF", "MyOrg.WSJF") — campos customizados variam por organização.
 */
function fieldOrSuffix(item: AzureWorkItem, name: string, suffix: string): unknown {
  if (item.fields[name] != null) return item.fields[name]
  const ending = `.${suffix.toLowerCase()}`
  const key = Object.keys(item.fields).find((field) => field.toLowerCase().endsWith(ending))
  return key ? item.fields[key] : 0
}

function stringField(item: AzureWorkItem, name: string): string {
  const value = item.fields[name]
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

/** Identidade do Azure → "Nome <email>", o formato que `splitAssignedTo` já entende. */
function formatIdentity(value: unknown): string {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : ''
  const identity = value as Partial<AzureIdentity>
  const name = identity.displayName ?? ''
  return identity.uniqueName ? `${name} <${identity.uniqueName}>` : name
}

// ClosedDate não existe em todos os processos (o Scrum fecha em "Done" sem ele):
// para itens fechados cai para ResolvedDate e, por último, StateChangeDate.
function resolveClosedDate(item: AzureWorkItem, state: string): string | undefined {
  if (!CLOSED_STATES.has(state)) return undefined
  return (
    stringField(item, 'Microsoft.VSTS.Common.ClosedDate') ||
    stringField(item, 'Microsoft.VSTS.Common.ResolvedDate') ||
    stringField(item, 'Microsoft.VSTS.Common.StateChangeDate') ||
    undefined
  )
}

/** Campo customizado "Prioridade" (ex.: "Custom.Prioridade"): o reference name varia por organização. */
function prioridade(item: AzureWorkItem): string {
  const key = Object.keys(item.fields).find((field) => field.toLowerCase() === 'prioridade' || field.toLowerCase().endsWith('.prioridade'))
  const value = key ? item.fields[key] : undefined
  return value == null ? '' : String(value).trim()
}

const TESTED_BY = 'Microsoft.VSTS.Common.TestedBy-Forward'

/** Ids dos Test Cases ligados ao item pelo link "Tested By". */
export function testedByIds(item: AzureWorkItem): number[] {
  return (item.relations ?? [])
    .filter((relation) => relation.rel === TESTED_BY)
    .map((relation) => Number(relation.url.match(/workItems\/(\d+)$/i)?.[1]))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export function azureWorkItemToRow(item: AzureWorkItem, config: AzureConfig): WorkItemRow {
  const row = buildWorkItemRow({
    id: item.id,
    workItemType: stringField(item, 'System.WorkItemType'),
    title: stringField(item, 'System.Title'),
    assignedTo: formatIdentity(item.fields['System.AssignedTo']),
    state: stringField(item, 'System.State'),
    tags: stringField(item, 'System.Tags'),
    iterationPath: stringField(item, 'System.IterationPath'),
    storyPoints: item.fields[config.storyPointsField] ?? item.fields[FALLBACK_STORY_POINTS_FIELD] ?? 0,
    effort: item.fields['Microsoft.VSTS.Scheduling.Effort'] ?? 0,
    timeCriticality: fieldOrSuffix(item, TIME_CRITICALITY_FIELD, 'TimeCriticality'),
    wsjf: fieldOrSuffix(item, config.wsjfField, 'WSJF'),
  })
  const parent = item.fields['System.Parent']
  const priority = prioridade(item)
  const description = htmlToText(stringField(item, 'System.Description'))
  const stateChangedDate = stringField(item, 'Microsoft.VSTS.Common.StateChangeDate')
  const testCaseIds = testedByIds(item)
  return {
    ...row,
    parentId: typeof parent === 'number' ? parent : undefined,
    ...(priority && { priority }),
    ...(description && { description }),
    ...(stateChangedDate && { stateChangedDate }),
    closedDate: resolveClosedDate(item, row.state),
    rev: item.rev,
    ...(testCaseIds.length > 0 && { testCaseIds }),
  }
}

/** Número/Fiscal Year da sprint pelo nome da iteration ("Sprint 08 - FY25-26"), com o path como fallback. */
export function iterationSprintInfo(iteration: AzureIteration): { number: number; fiscalYear: string } | null {
  const fromName = parseSprintInfo(iteration.name)
  const info = fromName.sprint ? fromName : parseSprintInfo(iteration.path)
  if (!info.sprint) return null
  return { number: Number(info.sprint.replace(/\D/g, '')), fiscalYear: info.fiscalYear }
}

export interface TestRunsSummary {
  runCount: number
  automatedRuns: number
  manualRuns: number
  totalTests: number
  passed: number
  failed: number
  notRun: number
  notApplicable: number
  /** Runs iniciados por dia ("yyyy-mm-dd" → quantidade). */
  runsByDay: Record<string, number>
}

export function summarizeTestRuns(runs: AzureTestRun[]): TestRunsSummary {
  const summary: TestRunsSummary = {
    runCount: runs.length,
    automatedRuns: 0,
    manualRuns: 0,
    totalTests: 0,
    passed: 0,
    failed: 0,
    notRun: 0,
    notApplicable: 0,
    runsByDay: {},
  }
  for (const run of runs) {
    if (run.isAutomated) summary.automatedRuns += 1
    else summary.manualRuns += 1
    summary.totalTests += run.totalTests ?? 0
    summary.passed += run.passedTests ?? 0
    // O run não expõe "failedTests": unanalyzedTests são justamente as falhas ainda não analisadas.
    summary.failed += run.unanalyzedTests ?? 0
    summary.notRun += run.incompleteTests ?? 0
    summary.notApplicable += run.notApplicableTests ?? 0
    if (run.startedDate) {
      const day = toDateKey(run.startedDate)
      summary.runsByDay[day] = (summary.runsByDay[day] ?? 0) + 1
    }
  }
  return summary
}

/** Campos de `TestReport` (percentuais 0-100, como em TestReportsTable) a partir do resumo dos runs. */
export function testRunsToReportFields(summary: TestRunsSummary) {
  return {
    testPoints: summary.totalTests,
    runsPercent: percentOf(summary.totalTests - summary.notRun, summary.totalTests),
    passedPercent: percentOf(summary.passed, summary.totalTests),
    failedPercent: percentOf(summary.failed, summary.totalTests),
    notRunCount: summary.notRun,
  }
}

// ---------------------------------------------------------------------------
// Test results por pessoa

/** Testes executados por uma pessoa (quem rodou o test case: `runBy`, ou o `owner` do resultado). */
export interface PersonTestSummary {
  email: string
  name: string
  executed: number
  passed: number
  failed: number
  /** Executados que não passaram nem falharam (Blocked, Inconclusive, Warning…). */
  other: number
}

const NOT_EXECUTED_OUTCOMES = new Set(['', 'none', 'unspecified', 'notexecuted', 'inprogress', 'notapplicable', 'paused'])
const FAILED_OUTCOMES = new Set(['failed', 'error', 'timeout', 'aborted'])

export function summarizeResultsByPerson(results: AzureTestResult[]): PersonTestSummary[] {
  const byEmail = new Map<string, PersonTestSummary>()
  for (const result of results) {
    const outcome = (result.outcome ?? '').toLowerCase()
    const identity = result.runBy ?? result.owner
    if (NOT_EXECUTED_OUTCOMES.has(outcome) || !identity?.uniqueName) continue
    const email = identity.uniqueName.trim()
    const key = email.toLowerCase()
    const entry = byEmail.get(key) ?? { email, name: identity.displayName.trim(), executed: 0, passed: 0, failed: 0, other: 0 }
    entry.executed += 1
    if (outcome === 'passed') entry.passed += 1
    else if (FAILED_OUTCOMES.has(outcome)) entry.failed += 1
    else entry.other += 1
    byEmail.set(key, entry)
  }
  return [...byEmail.values()].sort((a, b) => b.executed - a.executed || a.name.localeCompare(b.name))
}

/** Execuções de um Test Case por uma pessoa (quem rodou; vazio nos automatizados sem runBy). */
export interface TestCaseRunSummary {
  testCaseId: number
  email: string
  name: string
  executed: number
  passed: number
  failed: number
}

/** Resultados executados agrupados por Test Case e pessoa (mesma regra de "executado" do resumo por pessoa). */
export function summarizeResultsByTestCase(results: AzureTestResult[]): TestCaseRunSummary[] {
  const byKey = new Map<string, TestCaseRunSummary>()
  for (const result of results) {
    const outcome = (result.outcome ?? '').toLowerCase()
    const testCaseId = Number(result.testCase?.id)
    if (NOT_EXECUTED_OUTCOMES.has(outcome) || !Number.isInteger(testCaseId) || testCaseId <= 0) continue
    const identity = result.runBy ?? result.owner
    const email = identity?.uniqueName?.trim() ?? ''
    const key = `${testCaseId}|${email.toLowerCase()}`
    const entry = byKey.get(key) ?? { testCaseId, email, name: identity?.displayName?.trim() ?? '', executed: 0, passed: 0, failed: 0 }
    entry.executed += 1
    if (outcome === 'passed') entry.passed += 1
    else if (FAILED_OUTCOMES.has(outcome)) entry.failed += 1
    byKey.set(key, entry)
  }
  return [...byKey.values()].sort((a, b) => a.testCaseId - b.testCaseId || a.email.localeCompare(b.email))
}

/** Soma resumos por pessoa de vários runs (mesma pessoa = mesmo email). */
export function mergePersonTestSummaries(summaries: PersonTestSummary[]): PersonTestSummary[] {
  const byEmail = new Map<string, PersonTestSummary>()
  for (const summary of summaries) {
    const key = summary.email.toLowerCase()
    const entry = byEmail.get(key)
    byEmail.set(
      key,
      entry
        ? { ...entry, executed: entry.executed + summary.executed, passed: entry.passed + summary.passed, failed: entry.failed + summary.failed, other: entry.other + summary.other }
        : { ...summary },
    )
  }
  return [...byEmail.values()].sort((a, b) => b.executed - a.executed || a.name.localeCompare(b.name))
}

/** Soma resumos por Test Case e pessoa de vários runs. */
export function mergeTestCaseRunSummaries(summaries: TestCaseRunSummary[]): TestCaseRunSummary[] {
  const byKey = new Map<string, TestCaseRunSummary>()
  for (const summary of summaries) {
    const key = `${summary.testCaseId}|${summary.email.toLowerCase()}`
    const entry = byKey.get(key)
    byKey.set(
      key,
      entry
        ? { ...entry, executed: entry.executed + summary.executed, passed: entry.passed + summary.passed, failed: entry.failed + summary.failed }
        : { ...summary },
    )
  }
  return [...byKey.values()].sort((a, b) => a.testCaseId - b.testCaseId || a.email.localeCompare(b.email))
}

// ---------------------------------------------------------------------------
// Histórico de um work item

export type WorkItemEventKind = 'state' | 'iteration' | 'assignee' | 'points' | 'tags' | 'comment'

export interface WorkItemEvent {
  date: string
  author: string
  kind: WorkItemEventKind
  from?: string
  to?: string
  /** Texto do comentário, sem HTML. */
  text?: string
}

const TRACKED_FIELDS: Record<string, WorkItemEventKind> = {
  'System.State': 'state',
  'System.IterationPath': 'iteration',
  'System.AssignedTo': 'assignee',
  'System.Tags': 'tags',
}

function fieldValueText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return (value as Partial<AzureIdentity>).displayName ?? ''
  return String(value)
}

// O Azure grava 9999-01-01 como revisedDate da revisão atual; a data real da mudança é o ChangedDate.
function updateDate(update: AzureWorkItemUpdate): string {
  const changed = update.fields?.['System.ChangedDate']?.newValue
  if (typeof changed === 'string') return changed
  return update.revisedDate && !update.revisedDate.startsWith('9999') ? update.revisedDate : ''
}

/** Revisões → cada mudança de System.State com a data, em ordem (inclui o estado de criação). */
export function stateHistoryFromUpdates(updates: AzureWorkItemUpdate[]): StateChange[] {
  return updates
    .flatMap((update) => {
      const state = update.fields?.['System.State']?.newValue
      const date = updateDate(update)
      return typeof state === 'string' && date ? [{ state, date }] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Revisões + comentários → linha do tempo das mudanças que explicam um atraso: estado,
 * troca de sprint (Iteration Path), responsável, story points e tags. A revisão de criação
 * (sem valor anterior) também entra, para mostrar a sprint/estado iniciais.
 */
export function workItemTimeline(
  updates: AzureWorkItemUpdate[],
  comments: AzureWorkItemComment[],
  storyPointsField: string,
): WorkItemEvent[] {
  const fieldKinds: Record<string, WorkItemEventKind> = { ...TRACKED_FIELDS, [storyPointsField]: 'points' }
  const events: WorkItemEvent[] = []
  for (const update of updates) {
    const date = updateDate(update)
    const author = update.revisedBy?.displayName ?? ''
    for (const [field, change] of Object.entries(update.fields ?? {})) {
      const kind = fieldKinds[field]
      if (!kind) continue
      events.push({ date, author, kind, from: fieldValueText(change.oldValue), to: fieldValueText(change.newValue) })
    }
  }
  for (const comment of comments) {
    events.push({
      date: comment.createdDate ?? '',
      author: comment.createdBy?.displayName ?? '',
      kind: 'comment',
      text: htmlToText(comment.text),
    })
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}
