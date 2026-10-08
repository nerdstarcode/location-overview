import type { DateRange } from '../dates'

// Subconjunto das respostas da API REST do Azure DevOps (api-version 7.1) usado pelo app.

export interface AzureProject {
  id: string
  name: string
  description?: string
  state: string
  lastUpdateTime?: string
}

export interface AzureTeam {
  id: string
  name: string
  description?: string
  projectId: string
  projectName: string
}

export interface AzureIdentity {
  id: string
  displayName: string
  uniqueName: string
  imageUrl?: string
}

export interface AzureTeamMember {
  identity: AzureIdentity
  isTeamAdmin?: boolean
}

export type AzureIterationTimeFrame = 'past' | 'current' | 'future'

export interface AzureIteration {
  id: string
  name: string
  path: string
  attributes: {
    startDate: string | null
    finishDate: string | null
    timeFrame: AzureIterationTimeFrame
  }
}

export interface AzureTeamDaysOff {
  daysOff: DateRange[]
}

export interface AzureWiqlResult {
  workItems: { id: number }[]
}

export interface AzureWorkItem {
  id: number
  fields: Record<string, unknown>
}

export interface AzureTestRun {
  id: number
  name: string
  state: string
  isAutomated: boolean
  startedDate?: string
  completedDate?: string
  totalTests: number
  passedTests: number
  incompleteTests: number
  notApplicableTests: number
  unanalyzedTests: number
  iteration?: string
}
