import { useCallback, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAzureIterations, useAzureTeamMembers, useAzureTeams } from '../../hooks/azure/azureQueries'
import { syncTeamToBase, type SyncOutcome, type TeamSyncResult } from '../../lib/azure/syncToBase'
import { AzureProjectContext, type AzureProjectContextValue } from './AzureProjectContext'

// Estado da rota `azure/:projectId`: teams do projeto, o team selecionado (`?team=` na
// URL, para o link sobreviver a refresh) e os membros/iterations dele.
export function AzureProjectProvider({ children }: { children: ReactNode }) {
  const { projectId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const teams = useAzureTeams(projectId)
  const teamParam = searchParams.get('team')
  const selectedTeam = teams.data?.find((team) => team.id === teamParam) ?? teams.data?.[0]
  const members = useAzureTeamMembers(projectId, selectedTeam?.id)
  const iterations = useAzureIterations(projectId, selectedTeam?.id)

  const selectTeam = useCallback(
    (teamId: string) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('team', teamId)
        return next
      }),
    [setSearchParams],
  )

  function syncTeam(): SyncOutcome<TeamSyncResult> {
    if (!selectedTeam) return { ok: false, reason: 'Selecione uma squad.' }
    if (!members.data || !iterations.data) return { ok: false, reason: 'Aguarde o carregamento das pessoas e sprints.' }
    return { ok: true, result: syncTeamToBase({ teamName: selectedTeam.name, members: members.data, iterations: iterations.data }) }
  }

  const value: AzureProjectContextValue = { projectId, teams, selectedTeam, selectTeam, members, iterations, syncTeam }
  return <AzureProjectContext.Provider value={value}>{children}</AzureProjectContext.Provider>
}
