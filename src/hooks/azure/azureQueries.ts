import {
  getIterationWorkItems,
  getTeamDaysOff,
  listProjects,
  listTeamIterations,
  listTeamMembers,
  listTeams,
  listTestRuns,
} from '../../lib/azure/api'
import type { AzureConfig } from '../../lib/azure/azureConfigStorage'
import { azureWorkItemToRow } from '../../lib/azure/mappers'
import { useAzureRequest } from './useAzureRequest'

type Param = string | null | undefined
type Ready<P extends readonly Param[]> = { [K in keyof P]: string }

function allPresent<P extends readonly Param[]>(params: P): Ready<P> | null {
  return params.every((param) => typeof param === 'string' && param !== '') ? (params as unknown as Ready<P>) : null
}

/** Só dispara a requisição quando todos os parâmetros existem; o fetcher recebe-os já validados. */
function useAzureQuery<P extends readonly Param[], T>(
  resource: string,
  params: P,
  fetcher: (config: AzureConfig, params: Ready<P>, signal: AbortSignal) => Promise<T>,
) {
  const ready = allPresent(params)
  return useAzureRequest(
    ready && { key: [resource, ...ready].join('|'), fetch: (config, signal) => fetcher(config, ready, signal) },
  )
}

export function useAzureProjects() {
  return useAzureQuery('projects', [] as const, (config, _params, signal) => listProjects(config, signal))
}

export function useAzureTeams(project: Param) {
  return useAzureQuery('teams', [project] as const, (config, [p], signal) => listTeams(config, p, signal))
}

export function useAzureTeamMembers(project: Param, team: Param) {
  return useAzureQuery('members', [project, team] as const, (config, [p, t], signal) => listTeamMembers(config, p, t, signal))
}

export function useAzureIterations(project: Param, team: Param) {
  return useAzureQuery('iterations', [project, team] as const, (config, [p, t], signal) =>
    listTeamIterations(config, p, t, signal),
  )
}

export function useAzureTeamDaysOff(project: Param, team: Param, iterationId: Param) {
  return useAzureQuery('daysoff', [project, team, iterationId] as const, (config, [p, t, it], signal) =>
    getTeamDaysOff(config, p, t, it, signal),
  )
}

export function useAzureSprintWorkItems(project: Param, iterationPath: Param) {
  return useAzureQuery('workitems', [project, iterationPath] as const, async (config, [p, path], signal) => {
    const items = await getIterationWorkItems(config, p, path, signal)
    return items.map((item) => azureWorkItemToRow(item, config))
  })
}

export function useAzureTestRuns(project: Param, start: Param, end: Param) {
  return useAzureQuery('testruns', [project, start, end] as const, (config, [p, from, to], signal) =>
    listTestRuns(config, p, from, to, signal),
  )
}
