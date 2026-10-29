import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAzureIterations, useAzureTeamMembers, useAzureTeams } from '../../hooks/azure/azureQueries'
import { isAbortError } from '../../lib/azure/client'
import {
  syncIterationsToBase,
  syncTeamToBase,
  type IterationSyncProgress,
  type SyncOutcome,
  type TeamSyncResult,
} from '../../lib/azure/syncToBase'
import { useAzureConfig } from './AzureConfigContext'
import { AzureProjectContext, type AzureProjectContextValue, type IterationsSyncState } from './AzureProjectContext'

// Estado da rota `azure/:projectId`: teams do projeto, o team selecionado (`?team=` na
// URL, para o link sobreviver a refresh) e os membros/iterations dele.
export function AzureProjectProvider({ children }: { children: ReactNode }) {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { config } = useAzureConfig()

  const teams = useAzureTeams(projectId)
  const teamParam = searchParams.get('team')
  const selectedTeam = teams.data?.find((team) => team.id === teamParam) ?? teams.data?.[0]
  const members = useAzureTeamMembers(projectId, selectedTeam?.id)
  const iterations = useAzureIterations(projectId, selectedTeam?.id)

  const [iterationsSync, setIterationsSync] = useState<IterationsSyncState | null>(null)
  const syncAbortRef = useRef<AbortController | null>(null)

  const cancelIterationsSync = useCallback(() => syncAbortRef.current?.abort(), [])

  // Trocar de team ou sair da página cancela o lote em andamento.
  useEffect(() => cancelIterationsSync, [selectedTeam?.id, cancelIterationsSync])

  const selectTeam = useCallback(
    (teamId: string) => {
      setIterationsSync(null)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('team', teamId)
        return next
      })
    },
    [setSearchParams],
  )

  function syncTeam(): SyncOutcome<TeamSyncResult> {
    if (!selectedTeam) return { ok: false, reason: 'Selecione uma squad.' }
    if (!members.data || !iterations.data) return { ok: false, reason: 'Aguarde o carregamento das pessoas e sprints.' }
    return { ok: true, result: syncTeamToBase({ teamName: selectedTeam.name, members: members.data, iterations: iterations.data }) }
  }

  async function syncIterations(iterationIds: string[]): Promise<SyncOutcome<IterationSyncProgress>> {
    if (!selectedTeam) return { ok: false, reason: 'Selecione uma squad.' }
    if (!members.data || !iterations.data) return { ok: false, reason: 'Aguarde o carregamento das pessoas e sprints.' }
    if (syncAbortRef.current) return { ok: false, reason: 'Já existe uma sincronização em andamento.' }
    const ids = new Set(iterationIds)
    const selected = iterations.data.filter((iteration) => ids.has(iteration.id))
    if (selected.length === 0) return { ok: false, reason: 'Selecione ao menos uma sprint.' }

    const controller = new AbortController()
    syncAbortRef.current = controller
    let progress: IterationSyncProgress = {}
    const onProgress = (next: IterationSyncProgress) => {
      progress = next
      if (!controller.signal.aborted) setIterationsSync({ running: true, progress: next })
    }
    try {
      await syncIterationsToBase({
        config,
        project: projectId,
        teamName: selectedTeam.name,
        members: members.data,
        iterations: selected,
        signal: controller.signal,
        onProgress,
      })
      setIterationsSync({ running: false, progress })
      return { ok: true, result: progress }
    } catch (error) {
      if (!isAbortError(error) && !controller.signal.aborted) throw error
      // Mantém só o que chegou a terminar: as sprints na fila ou interrompidas voltam a ficar sem status.
      const finished = Object.entries(progress).filter(([, entry]) => entry.status === 'done' || entry.status === 'error')
      // null quando o cancelamento veio da troca de team (selectTeam já limpou o estado).
      setIterationsSync((prev) => prev && { running: false, progress: Object.fromEntries(finished) })
      return { ok: false, reason: 'Sincronização cancelada.' }
    } finally {
      syncAbortRef.current = null
    }
  }

  const value: AzureProjectContextValue = {
    projectId,
    teams,
    selectedTeam,
    selectTeam,
    members,
    iterations,
    syncTeam,
    iterationsSync,
    syncIterations,
    cancelIterationsSync,
  }
  return <AzureProjectContext.Provider value={value}>{children}</AzureProjectContext.Provider>
}
