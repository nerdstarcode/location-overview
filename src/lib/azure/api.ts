import { addDays } from '../dates'
import type { AzureConfig } from './azureConfigStorage'
import { azureFetch, azureFetchAll } from './client'
import type {
  AzureIteration,
  AzureProject,
  AzureTeam,
  AzureTeamDaysOff,
  AzureTeamMember,
  AzureTestRun,
  AzureWiqlResult,
  AzureWorkItem,
} from './types'

const seg = encodeURIComponent

const WORK_ITEMS_BATCH_SIZE = 200

// O endpoint test/runs recusa intervalos de min/maxLastUpdatedDate maiores que 7 dias.
const TEST_RUNS_WINDOW_DAYS = 7

export function listProjects(config: AzureConfig, signal?: AbortSignal): Promise<AzureProject[]> {
  return azureFetchAll<AzureProject>(config, '_apis/projects', { query: { $top: 500 }, signal })
}

export async function listTeams(config: AzureConfig, project: string, signal?: AbortSignal): Promise<AzureTeam[]> {
  const { value } = await azureFetch<{ value: AzureTeam[] }>(config, `_apis/projects/${seg(project)}/teams`, {
    query: { $top: 500 },
    signal,
  })
  return [...value].sort((a, b) => a.name.localeCompare(b.name))
}

export async function listTeamMembers(
  config: AzureConfig,
  project: string,
  team: string,
  signal?: AbortSignal,
): Promise<AzureTeamMember[]> {
  const { value } = await azureFetch<{ value: AzureTeamMember[] }>(
    config,
    `_apis/projects/${seg(project)}/teams/${seg(team)}/members`,
    { query: { $top: 500 }, signal },
  )
  return [...value].sort((a, b) => a.identity.displayName.localeCompare(b.identity.displayName))
}

export async function listTeamIterations(
  config: AzureConfig,
  project: string,
  team: string,
  signal?: AbortSignal,
): Promise<AzureIteration[]> {
  const { value } = await azureFetch<{ value: AzureIteration[] }>(
    config,
    `${seg(project)}/${seg(team)}/_apis/work/teamsettings/iterations`,
    { signal },
  )
  return value
}

export function getTeamDaysOff(
  config: AzureConfig,
  project: string,
  team: string,
  iterationId: string,
  signal?: AbortSignal,
): Promise<AzureTeamDaysOff> {
  return azureFetch<AzureTeamDaysOff>(
    config,
    `${seg(project)}/${seg(team)}/_apis/work/teamsettings/iterations/${seg(iterationId)}/teamdaysoff`,
    { signal },
  )
}

async function queryIterationWorkItemIds(
  config: AzureConfig,
  project: string,
  iterationPath: string,
  signal?: AbortSignal,
): Promise<number[]> {
  const escapedPath = iterationPath.replace(/'/g, "''")
  const { workItems } = await azureFetch<AzureWiqlResult>(config, `${seg(project)}/_apis/wit/wiql`, {
    method: 'POST',
    body: {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.IterationPath] UNDER '${escapedPath}' ORDER BY [System.Id]`,
    },
    signal,
  })
  return workItems.map((item) => item.id)
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size))
  return chunks
}

// Sem `fields` de propósito: pedir um campo que não existe no processo da organização
// (ex.: Effort no Agile) derruba a chamada inteira; o mapper escolhe os campos depois.
async function getWorkItemsBatch(
  config: AzureConfig,
  project: string,
  ids: number[],
  signal?: AbortSignal,
): Promise<AzureWorkItem[]> {
  const items: AzureWorkItem[] = []
  for (const batch of chunk(ids, WORK_ITEMS_BATCH_SIZE)) {
    const { value } = await azureFetch<{ value: AzureWorkItem[] }>(config, `${seg(project)}/_apis/wit/workitemsbatch`, {
      method: 'POST',
      body: { ids: batch, errorPolicy: 'omit' },
      signal,
    })
    items.push(...value.filter(Boolean))
  }
  return items
}

export async function getIterationWorkItems(
  config: AzureConfig,
  project: string,
  iterationPath: string,
  signal?: AbortSignal,
): Promise<AzureWorkItem[]> {
  const ids = await queryIterationWorkItemIds(config, project, iterationPath, signal)
  return ids.length > 0 ? getWorkItemsBatch(config, project, ids, signal) : []
}

/** Janelas consecutivas de até `days` dias cobrindo [from, to). */
export function dateWindows(from: Date, to: Date, days: number): { start: Date; end: Date }[] {
  const windows: { start: Date; end: Date }[] = []
  for (let start = from; start < to; start = addDays(start, days)) {
    const end = addDays(start, days)
    windows.push({ start, end: end > to ? to : end })
  }
  return windows
}

/** true quando o run começou entre o início de `start` e o fim do dia `end`. */
export function startedWithin(run: AzureTestRun, start: Date, end: Date): boolean {
  if (!run.startedDate) return false
  const started = new Date(run.startedDate)
  return started >= start && started < addDays(end, 1)
}

/**
 * Test runs iniciados na sprint. A API só filtra pela data de última atualização, então
 * a consulta vai até uma janela depois do fim (runs atualizados após o término) e o
 * recorte por início é feito aqui.
 */
export async function listTestRuns(
  config: AzureConfig,
  project: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AzureTestRun[]> {
  const start = new Date(from)
  const end = new Date(to)
  const now = new Date()
  const queryEnd = addDays(end, TEST_RUNS_WINDOW_DAYS)

  const byId = new Map<number, AzureTestRun>()
  for (const window of dateWindows(start, queryEnd > now ? now : queryEnd, TEST_RUNS_WINDOW_DAYS)) {
    const runs = await azureFetchAll<AzureTestRun>(config, `${seg(project)}/_apis/test/runs`, {
      query: { minLastUpdatedDate: window.start.toISOString(), maxLastUpdatedDate: window.end.toISOString() },
      signal,
    })
    for (const run of runs) byId.set(run.id, run)
  }

  return [...byId.values()]
    .filter((run) => startedWithin(run, start, end))
    .sort((a, b) => (a.startedDate ?? '').localeCompare(b.startedDate ?? ''))
}
