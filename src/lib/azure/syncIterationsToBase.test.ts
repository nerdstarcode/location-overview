import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTestReports } from '../testReportsStorage'
import { loadWorkItems } from '../workItemsStorage'
import { loadTestExecutions } from '../testExecutionsStorage'
import { getIterationWorkItems, listTestResultsForRuns, listTestRuns } from './api'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import { FIXTURE_ITERATIONS, FIXTURE_MEMBERS, FIXTURE_TEST_RUNS } from './sprintFixtures'
import { syncIterationsToBase, type IterationSyncProgress } from './syncToBase'

vi.mock('./api', () => ({ getIterationWorkItems: vi.fn(), listTestRuns: vi.fn(), listTestResultsForRuns: vi.fn() }))

const config = { ...DEFAULT_AZURE_CONFIG, organization: 'org', pat: 'pat' }
const [first, second] = FIXTURE_ITERATIONS

function workItem(id: number) {
  return { id, fields: { 'System.Title': `Item ${id}`, 'System.WorkItemType': 'Task', 'System.State': 'Done' } }
}

describe('syncIterationsToBase', () => {
  beforeEach(() => {
    vi.mocked(getIterationWorkItems).mockReset()
    vi.mocked(listTestRuns).mockReset().mockResolvedValue(FIXTURE_TEST_RUNS)
    vi.mocked(listTestResultsForRuns)
      .mockReset()
      .mockResolvedValue([{ id: 1, outcome: 'Passed', runBy: { id: 'g', displayName: 'Grace', uniqueName: 'grace@example.com' } }])
  })

  it('busca e grava cada sprint em sequência', async () => {
    vi.mocked(getIterationWorkItems).mockResolvedValueOnce([workItem(1), workItem(2)]).mockResolvedValueOnce([workItem(3)])
    const steps: IterationSyncProgress[] = []

    const progress = await syncIterationsToBase({
      config,
      project: 'Proj',
      teamName: 'Portal',
      members: FIXTURE_MEMBERS,
      iterations: [first, second],
      onProgress: (p) => steps.push(p),
    })

    expect(vi.mocked(getIterationWorkItems).mock.calls.map((call) => call[2])).toEqual([first.path, second.path])
    expect(progress[first.id]).toMatchObject({ status: 'done', result: { workItems: 2, testReport: true } })
    expect(progress[second.id]).toMatchObject({ status: 'done', result: { workItems: 1 } })
    expect(steps[0]).toEqual({ [first.id]: { status: 'pending' }, [second.id]: { status: 'pending' } })
    expect(steps[1][first.id]).toEqual({ status: 'running' })
    expect(loadWorkItems()).toHaveLength(3)
    expect(loadTestReports().length).toBeGreaterThan(0)
    expect(progress[first.id]).toMatchObject({ result: { testExecutions: 1 } })
    // Uma linha por sprint sincronizada.
    expect(loadTestExecutions()).toEqual([
      expect.objectContaining({ email: 'grace@example.com', executed: 1, passed: 1 }),
      expect.objectContaining({ email: 'grace@example.com', executed: 1, passed: 1 }),
    ])
  })

  it('segue para a próxima sprint quando uma falha', async () => {
    vi.mocked(getIterationWorkItems).mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce([workItem(3)])

    const progress = await syncIterationsToBase({
      config,
      project: 'Proj',
      teamName: 'Portal',
      members: FIXTURE_MEMBERS,
      iterations: [first, second],
    })

    expect(progress[first.id]).toEqual({ status: 'error', reason: 'HTTP 500' })
    expect(progress[second.id]).toMatchObject({ status: 'done' })
  })

  it('interrompe o lote quando é cancelado', async () => {
    const controller = new AbortController()
    vi.mocked(getIterationWorkItems).mockImplementationOnce(async () => {
      controller.abort()
      throw new DOMException('Aborted', 'AbortError')
    })

    await expect(
      syncIterationsToBase({
        config,
        project: 'Proj',
        teamName: 'Portal',
        members: FIXTURE_MEMBERS,
        iterations: [first, second],
        signal: controller.signal,
      }),
    ).rejects.toThrow()
    expect(getIterationWorkItems).toHaveBeenCalledTimes(1)
  })
})
