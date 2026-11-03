import { readList, writeJson } from '../localStore'
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
import type { AzureTestRun } from './types'

// Resultados dos test runs com o mínimo de pedidos ao Azure (um por run): por padrão só os runs
// manuais da sprint do time entram (configurável), e o resumo de cada run concluído fica guardado no
// navegador, para uma nova sincronização buscar só os runs novos ou ainda em andamento.

/** Resumo já calculado de um run concluído (um run concluído não muda mais). */
interface CachedRunResults {
  runId: number
  persons: PersonTestSummary[]
  testCases: TestCaseRunSummary[]
}

const CACHE_KEY = 'location-overview:test-run-results'

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
  /** Executados por pessoa (todos os runs somados). */
  persons: PersonTestSummary[]
  /** Executados por Test Case e pessoa (todos os runs somados). */
  testCases: TestCaseRunSummary[]
  /** Quantos runs precisaram ser buscados no Azure (os demais vieram do cache). */
  fetched: number
}

/** Resultados executados dos `runs`, por pessoa e por Test Case, reaproveitando os runs concluídos já lidos. */
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
    const entry = { runId: run.id, persons: summarizeResultsByPerson(results), testCases: summarizeResultsByTestCase(results) }
    if (isCompleted(run)) cache.set(run.id, entry)
    summaries.push(entry)
  }
  writeJson(CACHE_KEY, [...cache.values()])
  return {
    persons: mergePersonTestSummaries(summaries.flatMap((s) => s.persons)),
    testCases: mergeTestCaseRunSummaries(summaries.flatMap((s) => s.testCases)),
    fetched,
  }
}
