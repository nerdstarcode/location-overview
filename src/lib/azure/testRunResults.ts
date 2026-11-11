import { localDateKey } from '../dates'
import { readList, removeKey, writeJson } from '../localStore'
import { normalizeKey } from '../text'
import { listTestRunResults } from './api'
import type { AzureConfig } from './azureConfigStorage'
import {
  mergePersonTestSummaries,
  mergeTestCaseRunSummaries,
  summarizeResultsByPerson,
  summarizeResultsByTestCase,
  type PersonTestSummary,
  type TestCaseRunSummary,
} from './mappers'
import type { AzureTestResult, AzureTestRun } from './types'

// Resultados dos test runs com o mínimo de pedidos ao Azure (um por run): por padrão só os runs
// manuais da sprint do time entram (configurável), e o resumo de cada run concluído fica guardado no
// navegador, para uma nova sincronização buscar só os runs novos ou ainda em andamento.

/** Resumo com o dia (fuso local, "yyyy-mm-dd") em que os resultados foram executados; vazio sem data. */
export type Dated<T> = T & { day?: string }

/** Resumo já calculado de um run concluído (um run concluído não muda mais), separado por dia. */
interface CachedRunResults {
  runId: number
  persons: Dated<PersonTestSummary>[]
  testCases: Dated<TestCaseRunSummary>[]
}

const CACHE_KEY = 'location-overview:test-run-results:v2'
/** Cache anterior, sem o dia de execução: descartado. */
const LEGACY_CACHE_KEY = 'location-overview:test-run-results'

/** Dia da execução: a conclusão do resultado; sem ela, a do run ou o início do run. */
function resultDay(result: AzureTestResult, run: AzureTestRun): string {
  const date = result.completedDate ?? run.completedDate ?? run.startedDate
  return date ? localDateKey(new Date(date)) : ''
}

function groupByDay(results: AzureTestResult[], run: AzureTestRun): Map<string, AzureTestResult[]> {
  const byDay = new Map<string, AzureTestResult[]>()
  for (const result of results) {
    const day = resultDay(result, run)
    byDay.set(day, [...(byDay.get(day) ?? []), result])
  }
  return byDay
}

/** Soma por dia: `merge` junta os resumos de cada dia separadamente. */
function mergeByDay<T>(summaries: Dated<T>[], merge: (list: T[]) => T[]): Dated<T>[] {
  const byDay = new Map<string, T[]>()
  for (const { day = '', ...summary } of summaries) byDay.set(day, [...(byDay.get(day) ?? []), summary as T])
  return [...byDay.entries()].flatMap(([day, list]) => merge(list).map((summary) => ({ ...summary, day })))
}

const normalizePath = (path: string) => normalizeKey(path.replace(/^\\+|\\+$/g, ''))

export type TestRunFilter = Pick<AzureConfig, 'testRunsIncludeAutomated' | 'testRunsOnlySprintIteration'>

/**
 * Runs que entram nas execuções. Pela configuração: os automatizados (pipeline) só com
 * `testRunsIncludeAutomated`; com `testRunsOnlySprintIteration`, só os com a iteration dentro da
 * sprint do time (exclui os de outros times do projeto e os sem iteration).
 */
export function relevantTestRuns(runs: AzureTestRun[], iterationPath: string, filter: TestRunFilter): AzureTestRun[] {
  const sprintPath = normalizePath(iterationPath)
  return runs.filter((run) => {
    if (run.isAutomated && !filter.testRunsIncludeAutomated) return false
    if (!filter.testRunsOnlySprintIteration) return true
    if (!run.iteration) return false
    const path = normalizePath(run.iteration)
    return path === sprintPath || path.startsWith(`${sprintPath}\\`)
  })
}

const isCompleted = (run: AzureTestRun) => normalizeKey(run.state) === 'completed'

export interface RunResultSummaries {
  /** Executados por pessoa e dia de execução (todos os runs somados). */
  persons: Dated<PersonTestSummary>[]
  /** Executados por Test Case, pessoa e dia de execução (todos os runs somados). */
  testCases: Dated<TestCaseRunSummary>[]
  /** Quantos runs precisaram ser buscados no Azure (os demais vieram do cache). */
  fetched: number
}

/** Resultados executados dos `runs`, por pessoa e por Test Case e por dia, reaproveitando os runs concluídos já lidos. */
export async function testRunResultSummaries(
  config: AzureConfig,
  project: string,
  runs: AzureTestRun[],
  signal?: AbortSignal,
): Promise<RunResultSummaries> {
  const cache = new Map(readList<CachedRunResults>(CACHE_KEY).map((entry) => [entry.runId, entry]))
  const summaries: CachedRunResults[] = []
  let fetched = 0
  for (const run of runs) {
    const cached = cache.get(run.id)
    if (cached && isCompleted(run)) {
      summaries.push(cached)
      continue
    }
    const results = await listTestRunResults(config, project, run.id, signal)
    fetched += 1
    const days = [...groupByDay(results, run)]
    const entry = {
      runId: run.id,
      persons: days.flatMap(([day, list]) => summarizeResultsByPerson(list).map((summary) => ({ ...summary, day }))),
      testCases: days.flatMap(([day, list]) => summarizeResultsByTestCase(list).map((summary) => ({ ...summary, day }))),
    }
    if (isCompleted(run)) cache.set(run.id, entry)
    summaries.push(entry)
  }
  writeJson(CACHE_KEY, [...cache.values()])
  removeKey(LEGACY_CACHE_KEY)
  return {
    persons: mergeByDay(summaries.flatMap((s) => s.persons), mergePersonTestSummaries),
    testCases: mergeByDay(summaries.flatMap((s) => s.testCases), mergeTestCaseRunSummaries),
    fetched,
  }
}
