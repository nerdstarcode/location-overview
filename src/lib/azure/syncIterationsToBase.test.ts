import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTestReports } from '../testReportsStorage'
import { loadWorkItems } from '../workItemsStorage'
import { loadTestExecutions } from '../testExecutionsStorage'
import { getIterationWorkItems, getWorkItemsStateHistory, listTestRunResults, listTestRuns } from './api'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import { FIXTURE_ITERATIONS, FIXTURE_MEMBERS, FIXTURE_TEST_RUNS } from './sprintFixtures'
import { syncIterationsToBase, type IterationSyncProgress } from './syncToBase'

vi.mock('./api', () => ({
  getIterationWorkItems: vi.fn(),
  getWorkItemsStateHistory: vi.fn(),
  listTestRuns: vi.fn(),
  listTestRunResults: vi.fn(),
}))

const HISTORY = [
  { state: 'Active', date: '2025-09-02T12:00:00Z' },
  { state: 'Done', date: '2025-09-05T12:00:00Z' },
]

const config = { ...DEFAULT_AZURE_CONFIG, organization: 'org', pat: 'pat' }
const [first, second] = FIXTURE_ITERATIONS

function workItem(id: number, type = 'User Story', rev = 1) {
  return { id, rev, fields: { 'System.Title': `Item ${id}`, 'System.WorkItemType': type, 'System.State': 'Done' } }
}

describe('syncIterationsToBase', () => {
  beforeEach(() => {
    vi.mocked(getIterationWorkItems).mockReset()
    // Um run manual de cada sprint (os resultados só vêm dos runs manuais da sprint do time).
    vi.mocked(listTestRuns)
      .mockReset()
      .mockResolvedValue([
        ...FIXTURE_TEST_RUNS,
        { ...FIXTURE_TEST_RUNS[1], id: 11, iteration: first.path },
        { ...FIXTURE_TEST_RUNS[1], id: 12, iteration: second.path },
      ])
    vi.mocked(getWorkItemsStateHistory)
      .mockReset()
      .mockImplementation(async (_config, ids) => new Map(ids.map((id) => [id, HISTORY])))
    vi.mocked(listTestRunResults)
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
    expect(loadWorkItems()[0].stateHistory).toEqual(HISTORY)
    expect(progress[first.id]).toMatchObject({ result: { stateHistoryError: undefined } })
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

  it('grava a sprint sem histórico de estados quando a busca do histórico falha', async () => {
    vi.mocked(getIterationWorkItems).mockResolvedValueOnce([workItem(1)])
    vi.mocked(getWorkItemsStateHistory).mockRejectedValueOnce(new Error('HTTP 429'))

    const progress = await syncIterationsToBase({ config, project: 'Proj', teamName: 'Portal', members: FIXTURE_MEMBERS, iterations: [first] })

    expect(progress[first.id]).toMatchObject({ status: 'done', result: { workItems: 1, stateHistoryError: 'HTTP 429' } })
    expect(loadWorkItems()[0].stateHistory).toBeUndefined()
  })

  it('busca o histórico só de quem precisa: sem Tasks e sem itens que não mudaram desde a última sincronização', async () => {
    const sync = () => syncIterationsToBase({ config, project: 'Proj', teamName: 'Portal', members: FIXTURE_MEMBERS, iterations: [first] })
    vi.mocked(getIterationWorkItems).mockResolvedValueOnce([workItem(1), workItem(2), workItem(3, 'Task')])
    await sync()
    expect(vi.mocked(getWorkItemsStateHistory).mock.calls[0][1]).toEqual([1, 2])

    // Item 1 sem mudança (mesma revisão): reaproveita o histórico salvo; o 2 mudou e é buscado de novo.
    vi.mocked(getIterationWorkItems).mockResolvedValueOnce([workItem(1), workItem(2, 'User Story', 2), workItem(3, 'Task')])
    await sync()
    expect(vi.mocked(getWorkItemsStateHistory).mock.calls[1][1]).toEqual([2])
    expect(loadWorkItems().find((row) => row.id === 1)?.stateHistory).toEqual(HISTORY)
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
