import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  it('soma os runs e reaproveita os concluídos já lidos; em andamento busca de novo', async () => {
    const runs = [run(1), run(2), run(3, { state: 'InProgress' })]
    const first = await testRunResultSummaries(config, 'Proj', runs)
    expect(first.fetched).toBe(3)
    expect(first.persons).toEqual([{ email: 'grace@example.com', name: 'Grace', executed: 3, passed: 3, failed: 0, other: 0 }])
    expect(first.testCases).toEqual([{ testCaseId: 501, email: 'grace@example.com', name: 'Grace', executed: 3, passed: 3, failed: 0 }])

    const second = await testRunResultSummaries(config, 'Proj', runs)
    expect(second.fetched).toBe(1)
    expect(vi.mocked(listTestRunResults).mock.calls.map((call) => call[2])).toEqual([1, 2, 3, 3])
    expect(second.persons[0].executed).toBe(3)
  })
})
