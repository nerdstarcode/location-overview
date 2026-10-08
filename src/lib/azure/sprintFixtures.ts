// Dados de exemplo de uma sprint (Storybook): 10 dias úteis, 2 devs, 1 QA e itens sem responsável.
import type { WorkItemRow } from '../workItems'
import type { Person } from '../peopleStorage'
import type { PersonAllocation } from '../personAllocationsStorage'
import type { Sprint } from '../sprintsStorage'
import { DEFAULT_LEVELS } from '../levelsStorage'
import { workingDaysBetween } from '../dates'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import type { AzureIteration, AzureTeamMember, AzureTestRun } from './types'
import { summarizeTestRuns } from './mappers'
import {
  allocationComparison,
  burnup,
  pointsByPerson,
  pointsByState,
  pointsByType,
  tasksPerUserStory,
  totalStoryPoints,
} from './sprintMetrics'

export const FIXTURE_POINT_TYPES = DEFAULT_AZURE_CONFIG.pointTypes

function item(partial: Partial<WorkItemRow> & Pick<WorkItemRow, 'id' | 'workItemType'>): WorkItemRow {
  return {
    title: `Item ${partial.id}`,
    assignedTo: '',
    email: '',
    state: 'Active',
    tags: '',
    iterationPath: 'Portal\\Sprint 08 - FY25-26',
    sprint: 'Sprint 08',
    fiscalYear: 'FY25-26',
    storyPoints: 0,
    effort: 0,
    timeCriticality: 0,
    wsjf: 0,
    pontoExecucao: 0,
    runs: 0,
    isDelayed: false,
    ...partial,
  }
}

const ada = { assignedTo: 'Ada Lovelace', email: 'ada@example.com' }
const alan = { assignedTo: 'Alan Turing', email: 'alan@example.com' }
const grace = { assignedTo: 'Grace Hopper', email: 'grace@example.com' }

export const FIXTURE_WORK_ITEMS: WorkItemRow[] = [
  item({ id: 101, workItemType: 'User Story', title: 'Login com SSO', ...ada, storyPoints: 8, state: 'Closed', closedDate: '2025-09-04T15:00:00Z' }),
  item({ id: 102, workItemType: 'User Story', title: 'Exportar relatório', ...alan, storyPoints: 5, state: 'Closed', closedDate: '2025-09-09T12:00:00Z' }),
  item({ id: 103, workItemType: 'User Story', title: 'Filtro por squad', ...alan, storyPoints: 5, state: 'Active' }),
  item({ id: 104, workItemType: 'Bug', title: 'Erro ao salvar', ...ada, storyPoints: 2, state: 'Closed', closedDate: '2025-09-06T10:00:00Z' }),
  item({ id: 105, workItemType: 'Bug', title: 'Layout quebrado no mobile', storyPoints: 3, state: 'New' }),
  item({ id: 106, workItemType: 'Enabler', title: 'Pipeline de deploy', ...grace, storyPoints: 3, state: 'Testing QA' }),
  item({ id: 107, workItemType: 'Enabler', title: 'Atualizar dependências', storyPoints: 2, state: 'New' }),
  item({ id: 108, workItemType: 'User Story', title: 'Testes regressivos', ...grace, storyPoints: 5, state: 'Closed', closedDate: '2025-09-11T18:00:00Z' }),
  item({ id: 201, workItemType: 'Task', title: 'API SSO', ...ada, parentId: 101, state: 'Closed' }),
  item({ id: 202, workItemType: 'Task', title: 'Tela SSO', ...ada, parentId: 101, state: 'Closed' }),
  item({ id: 203, workItemType: 'Task', title: 'Gerar XLSX', ...alan, parentId: 102, state: 'Closed' }),
  item({ id: 204, workItemType: 'Task', title: 'Componente de filtro', ...alan, parentId: 103, state: 'Active' }),
  item({ id: 205, workItemType: 'Task', title: 'Query por squad', ...alan, parentId: 103, state: 'New' }),
]

export const FIXTURE_ITERATION: AzureIteration = {
  id: 'it-8',
  name: 'Sprint 08 - FY25-26',
  path: 'Portal\\Sprint 08 - FY25-26',
  attributes: { startDate: '2025-09-01T00:00:00Z', finishDate: '2025-09-12T00:00:00Z', timeFrame: 'current' },
}

export const FIXTURE_ITERATIONS: AzureIteration[] = [
  FIXTURE_ITERATION,
  {
    id: 'it-7',
    name: 'Sprint 07 - FY25-26',
    path: 'Portal\\Sprint 07 - FY25-26',
    attributes: { startDate: '2025-08-18T00:00:00Z', finishDate: '2025-08-29T00:00:00Z', timeFrame: 'past' },
  },
]

export const FIXTURE_WORKING_DAYS = workingDaysBetween(
  FIXTURE_ITERATION.attributes.startDate!,
  FIXTURE_ITERATION.attributes.finishDate!,
)

export const FIXTURE_MEMBERS: AzureTeamMember[] = [ada, alan, grace].map((p, index) => ({
  identity: { id: `m${index}`, displayName: p.assignedTo, uniqueName: p.email },
}))

export const FIXTURE_SPRINT: Sprint = { id: 's8', number: 8, fiscalYear: 'FY25-26', startDate: '2025-09-01', endDate: '2025-09-12', totalValidDays: 10 }

export const FIXTURE_PEOPLE: Person[] = [
  { id: 'p1', nome: 'Ada Lovelace', email: 'ada@example.com', cargo: 'Sr Software Developer', nivel: 'SR', squadIds: ['sq1'] },
  { id: 'p2', nome: 'Alan Turing', email: 'alan@example.com', cargo: 'Software Developer', nivel: 'PL', squadIds: ['sq1'] },
  { id: 'p3', nome: 'Grace Hopper', email: 'grace@example.com', cargo: 'Sr Software Tester Quality', nivel: 'SR', squadIds: ['sq1'] },
]

export const FIXTURE_ALLOCATIONS: PersonAllocation[] = [
  { id: 'a1', personId: 'p1', squadId: 'sq1', sprintId: 's8', percentage: 100 },
  { id: 'a2', personId: 'p2', squadId: 'sq1', sprintId: 's8', percentage: 50 },
  { id: 'a3', personId: 'p3', squadId: 'sq1', sprintId: 's8', percentage: 100 },
]

export const FIXTURE_TOTAL_POINTS = totalStoryPoints(FIXTURE_WORK_ITEMS, FIXTURE_POINT_TYPES)
export const FIXTURE_POINTS_BY_PERSON = pointsByPerson(FIXTURE_WORK_ITEMS, FIXTURE_POINT_TYPES)
export const FIXTURE_BURNUP = burnup(FIXTURE_WORK_ITEMS, FIXTURE_POINT_TYPES, FIXTURE_WORKING_DAYS, new Date('2025-09-10T12:00:00Z'))
export const FIXTURE_BY_TYPE = pointsByType(FIXTURE_WORK_ITEMS, FIXTURE_POINT_TYPES)
export const FIXTURE_BY_STATE = pointsByState(FIXTURE_WORK_ITEMS, FIXTURE_POINT_TYPES)
export const FIXTURE_USER_STORIES = tasksPerUserStory(FIXTURE_WORK_ITEMS, FIXTURE_POINT_TYPES)
export const FIXTURE_ALLOCATION = allocationComparison({
  members: FIXTURE_MEMBERS,
  personPoints: FIXTURE_POINTS_BY_PERSON.people,
  totalPoints: FIXTURE_TOTAL_POINTS,
  people: FIXTURE_PEOPLE,
  allocations: FIXTURE_ALLOCATIONS,
  levels: DEFAULT_LEVELS,
  cargos: [],
  squadId: 'sq1',
  sprint: FIXTURE_SPRINT,
  qaMinPercent: 20,
  qaMaxPercent: 30,
})

export const FIXTURE_TEST_RUNS: AzureTestRun[] = [
  { id: 1, name: 'Regressivo', state: 'Completed', isAutomated: true, startedDate: '2025-09-02T10:00:00Z', totalTests: 40, passedTests: 36, incompleteTests: 0, notApplicableTests: 1, unanalyzedTests: 3 },
  { id: 2, name: 'Smoke', state: 'Completed', isAutomated: false, startedDate: '2025-09-02T15:00:00Z', totalTests: 10, passedTests: 10, incompleteTests: 0, notApplicableTests: 0, unanalyzedTests: 0 },
  { id: 3, name: 'Regressivo', state: 'Completed', isAutomated: true, startedDate: '2025-09-09T10:00:00Z', totalTests: 40, passedTests: 38, incompleteTests: 2, notApplicableTests: 0, unanalyzedTests: 0 },
]

export const FIXTURE_TEST_RUNS_SUMMARY = summarizeTestRuns(FIXTURE_TEST_RUNS)
