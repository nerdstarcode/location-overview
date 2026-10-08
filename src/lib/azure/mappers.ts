import { toDateKey } from '../dates'
import { percentOf } from '../numbers'
import { buildWorkItemRow, CLOSED_STATES, parseSprintInfo, type WorkItemRow } from '../workItems'
import type { AzureConfig } from './azureConfigStorage'
import type { AzureIdentity, AzureIteration, AzureTestRun, AzureWorkItem } from './types'

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
  return {
    ...row,
    parentId: typeof parent === 'number' ? parent : undefined,
    closedDate: resolveClosedDate(item, row.state),
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
