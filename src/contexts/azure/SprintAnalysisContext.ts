import { createContext, useContext } from 'react'
import type { AzureRequestState } from '../../hooks/azure/useAzureRequest'
import type { SprintMetrics } from '../../lib/azure/sprintMetrics'
import type { SprintSyncResult, SyncOutcome } from '../../lib/azure/syncToBase'
import type { AzureIteration, AzureTeam, AzureTeamMember, AzureTestRun } from '../../lib/azure/types'
import type { Sprint } from '../../lib/sprintsStorage'
import type { Squad } from '../../lib/squadsStorage'
import type { WorkItemRow } from '../../lib/workItems'

export interface SprintAnalysisContextValue {
  projectId: string
  team: AzureTeam | undefined
  iteration: AzureIteration | undefined
  members: AzureRequestState<AzureTeamMember[]>
  workItems: AzureRequestState<WorkItemRow[]>
  testRuns: AzureRequestState<AzureTestRun[]>
  workingDays: string[]
  /** Squad/Sprint correspondentes na base local (por nome do Team e por número/FY da iteration). */
  localSquad: Squad | undefined
  localSprint: Sprint | undefined
  metrics: SprintMetrics
  loading: boolean
  /** Refaz todas as requisições da sprint e relê a base local. */
  refresh: () => void
  /** Grava squad, pessoas, sprint, work items e relatório de testes na base local. */
  saveToBase: () => SyncOutcome<SprintSyncResult>
  /** Grava os dias válidos (base de capacity) da sprint local, criando-a a partir da iteration se preciso. */
  updateSprintDays: (days: number) => SyncOutcome<Sprint>
  /** Work items ocultos: apagados na tabela e fora dos KPIs/gráficos (salvo no navegador). */
  hiddenIds: ReadonlySet<number>
  toggleHidden: (id: number) => void
}

export const SprintAnalysisContext = createContext<SprintAnalysisContextValue | null>(null)

export function useSprintAnalysis(): SprintAnalysisContextValue {
  const value = useContext(SprintAnalysisContext)
  if (!value) throw new Error('useSprintAnalysis precisa estar dentro de <SprintAnalysisProvider>.')
  return value
}
