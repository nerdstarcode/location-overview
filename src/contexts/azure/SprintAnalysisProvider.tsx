import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAzureIterations,
  useAzureSprintWorkItems,
  useAzureTeamDaysOff,
  useAzureTeamMembers,
  useAzureTestRuns,
} from '../../hooks/azure/azureQueries'
import { useAzureConfig } from './AzureConfigContext'
import { useAzureProject } from './AzureProjectContext'
import { SprintAnalysisContext, type SprintAnalysisContextValue } from './SprintAnalysisContext'
import { workingDaysBetween } from '../../lib/dates'
import { computeSprintMetrics } from '../../lib/azure/sprintMetrics'
import {
  findSprintForIteration,
  findSquadByName,
  syncSprintToBase,
  upsertSprintFromIteration,
  type SprintSyncResult,
  type SyncOutcome,
} from '../../lib/azure/syncToBase'
import { loadCargos } from '../../lib/cargosStorage'
import { loadLevels } from '../../lib/levelsStorage'
import { loadPeople } from '../../lib/peopleStorage'
import { loadPersonAllocations } from '../../lib/personAllocationsStorage'
import { loadSprints, upsertSprint, type Sprint } from '../../lib/sprintsStorage'
import { loadSquads } from '../../lib/squadsStorage'
import { squadMatchesName } from '../../lib/squadMatching'
import { loadHiddenWorkItems, toggleHiddenWorkItem } from '../../lib/hiddenWorkItemsStorage'

function loadLocalBase() {
  return {
    people: loadPeople(),
    allocations: loadPersonAllocations(),
    levels: loadLevels(),
    cargos: loadCargos(),
    squads: loadSquads(),
    sprints: loadSprints(),
  }
}

// Estado da rota `azure/:projectId/:teamId/:iterationId`: busca a sprint no Azure DevOps,
// cruza com a base local e expõe as métricas prontas para a página de análise.
export function SprintAnalysisProvider({ children }: { children: ReactNode }) {
  const { teamId = '', iterationId = '' } = useParams()
  const { projectId, teams } = useAzureProject()
  const { config } = useAzureConfig()
  const [localBase, setLocalBase] = useState(loadLocalBase)
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(() => new Set(loadHiddenWorkItems()))

  const team = teams.data?.find((t) => t.id === teamId)
  const iterations = useAzureIterations(projectId, teamId)
  const iteration = iterations.data?.find((it) => it.id === iterationId)
  const startDate = iteration?.attributes.startDate ?? null
  const finishDate = iteration?.attributes.finishDate ?? null

  const members = useAzureTeamMembers(projectId, teamId)
  const daysOff = useAzureTeamDaysOff(projectId, teamId, iterationId)
  const workItems = useAzureSprintWorkItems(projectId, iteration?.path)
  const testRuns = useAzureTestRuns(projectId, startDate, finishDate)

  const daysOffRanges = daysOff.data?.daysOff
  const workingDays = useMemo(
    () => (startDate && finishDate ? workingDaysBetween(startDate, finishDate, daysOffRanges) : []),
    [startDate, finishDate, daysOffRanges],
  )

  const teamName = team?.name
  const localSquad = useMemo(
    () => (teamName ? findSquadByName(localBase.squads, teamName) : undefined),
    [teamName, localBase.squads],
  )
  const localSprint = useMemo(
    () => (iteration ? findSprintForIteration(localBase.sprints, iteration) : undefined),
    [iteration, localBase.sprints],
  )

  // A mesma squad/sprint pode ter mais de um registro na base (squads duplicadas ainda não
  // mescladas, sprint cadastrada duas vezes): conta a alocação de todos eles, como se fossem
  // da squad/sprint local, para Capacity/Max refletirem todo mundo que está na Alocação.
  const allocations = useMemo(() => {
    if (!teamName || !iteration || !localSquad || !localSprint) return localBase.allocations
    const squadIds = new Set(localBase.squads.filter((s) => squadMatchesName(s, teamName)).map((s) => s.id))
    const sprintIds = new Set(localBase.sprints.filter((s) => findSprintForIteration([s], iteration)).map((s) => s.id))
    return localBase.allocations.map((a) =>
      squadIds.has(a.squadId) && sprintIds.has(a.sprintId) ? { ...a, squadId: localSquad.id, sprintId: localSprint.id } : a,
    )
  }, [teamName, iteration, localSquad, localSprint, localBase])

  const metrics = useMemo(
    () =>
      computeSprintMetrics({
        items: workItems.data ?? [],
        pointTypes: config.pointTypes,
        workingDays,
        testRuns: testRuns.data,
        members: members.data ?? [],
        people: localBase.people,
        allocations,
        levels: localBase.levels,
        cargos: localBase.cargos,
        squadId: localSquad?.id,
        sprint: localSprint,
        qaMinPercent: config.qaMinPercent,
        qaMaxPercent: config.qaMaxPercent,
        hiddenIds,
      }),
    [workItems.data, testRuns.data, members.data, workingDays, config, localBase, allocations, localSquad, localSprint, hiddenIds],
  )

  function toggleHidden(id: number) {
    setHiddenIds(new Set(toggleHiddenWorkItem(id)))
  }

  function refresh() {
    for (const request of [iterations, members, daysOff, workItems, testRuns]) request.reload()
    setLocalBase(loadLocalBase())
  }

  function saveToBase(): SyncOutcome<SprintSyncResult> {
    if (!team || !iteration) return { ok: false, reason: 'Sprint não encontrada neste team.' }
    if (!members.data || !workItems.data) return { ok: false, reason: 'Aguarde o carregamento dos dados da sprint.' }
    const result = syncSprintToBase({
      teamName: team.name,
      members: members.data,
      iteration,
      workItems: workItems.data,
      testRuns: metrics.testRuns,
    })
    setLocalBase(loadLocalBase())
    return { ok: true, result }
  }

  function updateSprintDays(days: number): SyncOutcome<Sprint> {
    if (!Number.isFinite(days) || days <= 0) return { ok: false, reason: 'Dias válidos deve ser maior que 0.' }
    if (!iteration) return { ok: false, reason: 'Sprint não encontrada neste team.' }
    // Sem a sprint na base, cria a partir da iteration para já poder gravar os dias.
    const sprint = localSprint ?? upsertSprintFromIteration(iteration)?.sprint
    if (!sprint) return { ok: false, reason: 'Nome da sprint fora do padrão "Sprint N - FYxx-yy" ou sem datas.' }
    const updated = { ...sprint, totalValidDays: days }
    upsertSprint(updated)
    setLocalBase(loadLocalBase())
    return { ok: true, result: updated }
  }

  const value: SprintAnalysisContextValue = {
    projectId,
    team,
    iteration,
    members,
    workItems,
    testRuns,
    workingDays,
    localSquad,
    localSprint,
    metrics,
    loading: [teams, iterations, members, workItems, daysOff].some((request) => request.loading),
    refresh,
    saveToBase,
    updateSprintDays,
    hiddenIds,
    toggleHidden,
  }

  return <SprintAnalysisContext.Provider value={value}>{children}</SprintAnalysisContext.Provider>
}
