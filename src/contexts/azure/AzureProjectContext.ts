import { createContext, useContext } from 'react'
import type { AzureRequestState } from '../../hooks/azure/useAzureRequest'
import type { SyncOutcome, TeamSyncResult } from '../../lib/azure/syncToBase'
import type { AzureIteration, AzureTeam, AzureTeamMember } from '../../lib/azure/types'

export interface AzureProjectContextValue {
  /** Nome (ou id) do projeto vindo da rota `azure/:projectId`. */
  projectId: string
  teams: AzureRequestState<AzureTeam[]>
  selectedTeam: AzureTeam | undefined
  selectTeam: (teamId: string) => void
  members: AzureRequestState<AzureTeamMember[]>
  iterations: AzureRequestState<AzureIteration[]>
  /** Grava o Team como squad, os membros como pessoas e as iterations como sprints na base local. */
  syncTeam: () => SyncOutcome<TeamSyncResult>
}

export const AzureProjectContext = createContext<AzureProjectContextValue | null>(null)

export function useAzureProject(): AzureProjectContextValue {
  const value = useContext(AzureProjectContext)
  if (!value) throw new Error('useAzureProject precisa estar dentro de <AzureProjectProvider>.')
  return value
}
