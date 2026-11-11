import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localDateKey } from '../dates'
import { listTestRunResults } from './api'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import { relevantTestRuns, testRunResultSummaries } from './testRunResults'
import type { AzureTestRun } from './types'

vi.mock('./api', () => ({ listTestRunResults: vi.fn() }))

const config = { ...DEFAULT_AZURE_CONFIG, organization: 'org', pat: 'pat' }
const SPRINT = 'Portal\\Sprint 08 - FY25-26'
const run = (id: number, partial: Partial<AzureTestRun> = {}): AzureTestRun => ({
  id,
  name: `Run ${id}`,
  state: 'Completed',
  isAutomated: false,
  iteration: SPRINT,
  totalTests: 1,
  passedTests: 1,
  incompleteTests: 0,
  notApplicableTests: 0,
  unanalyzedTests: 0,
  ...partial,
})
const grace = { id: 'g', displayName: 'Grace', uniqueName: 'grace@example.com' }

beforeEach(() => {
  vi.mocked(listTestRunResults).mockReset().mockResolvedValue([{ id: 1, outcome: 'Passed', runBy: grace, testCase: { id: '501' } }])
})

describe('relevantTestRuns', () => {
  it('padrão: só runs manuais com a iteration dentro da sprint do time', () => {
    const runs = [
      run(1),
      run(2, { iteration: `${SPRINT}\\Regressivo` }),
      run(3, { isAutomated: true }),
      run(4, { iteration: 'Portal\\Sprint 09 - FY25-26' }),
      run(5, { iteration: 'Outro time\\Sprint 08 - FY25-26' }),
      run(6, { iteration: undefined }),
      run(7, { iteration: 'portal\\sprint 08 - fy25-26' }),
    ]
    expect(relevantTestRuns(runs, SPRINT, DEFAULT_AZURE_CONFIG).map((r) => r.id)).toEqual([1, 2, 7])
    // Incluindo os automatizados: o 3 entra.
    expect(relevantTestRuns(runs, SPRINT, { testRunsIncludeAutomated: true, testRunsOnlySprintIteration: true }).map((r) => r.id)).toEqual([1, 2, 3, 7])
    // Sem o filtro de iteration: entram os de outras sprints/times e os sem iteration (mas não os automatizados).
    expect(relevantTestRuns(runs, SPRINT, { testRunsIncludeAutomated: false, testRunsOnlySprintIteration: false }).map((r) => r.id)).toEqual([1, 2, 4, 5, 6, 7])
  })
})

describe('testRunResultSummaries', () => {
  it('soma os runs por dia de execução e reaproveita os concluídos já lidos; em andamento busca de novo', async () => {
    const day = (iso: string) => localDateKey(new Date(iso))
    // Resultado com conclusão própria; sem ela, vale a data do run.
    vi.mocked(listTestRunResults).mockImplementation(async (_config, _project, runId) =>
      runId === 1
        ? [{ id: 1, outcome: 'Passed', runBy: grace, testCase: { id: '501' }, completedDate: '2025-09-16T15:00:00Z' }]
        : [{ id: 2, outcome: 'Passed', runBy: grace, testCase: { id: '501' } }],
    )
    const runs = [run(1), run(2, { startedDate: '2025-09-03T15:00:00Z' }), run(3, { state: 'InProgress', startedDate: '2025-09-03T16:00:00Z' })]
    const first = await testRunResultSummaries(config, 'Proj', runs)
    expect(first.fetched).toBe(3)
    expect(first.testCases).toEqual(
      expect.arrayContaining([
        { testCaseId: 501, email: 'grace@example.com', name: 'Grace', executed: 1, passed: 1, failed: 0, day: day('2025-09-16T15:00:00Z') },
        { testCaseId: 501, email: 'grace@example.com', name: 'Grace', executed: 2, passed: 2, failed: 0, day: day('2025-09-03T15:00:00Z') },
      ]),
    )
    expect(first.persons.reduce((sum, p) => sum + p.executed, 0)).toBe(3)

    const second = await testRunResultSummaries(config, 'Proj', runs)
    expect(second.fetched).toBe(1)
    expect(vi.mocked(listTestRunResults).mock.calls.map((call) => call[2])).toEqual([1, 2, 3, 3])
    expect(second.testCases).toEqual(first.testCases)
  })
})
