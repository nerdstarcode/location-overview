// Dados de exemplo do Dashboard por Pessoa (Storybook): a sprint de exemplo + um item
// entregue com atraso na sprint seguinte e os testes executados pela QA.
import { DEFAULT_LEVELS } from './levelsStorage'
import type { CargoConfig } from './cargosStorage'
import { computePeopleSummary, computePersonDevMetrics, computePersonQaMetrics, delayInfo } from './personMetrics'
import { formatSprintLabel, type Sprint } from './sprintsStorage'
import type { TestExecution } from './testExecutionsStorage'
import type { WorkItemRow } from './workItems'
import {
  FIXTURE_ALLOCATIONS,
  FIXTURE_PEOPLE,
  FIXTURE_POINT_TYPES,
  FIXTURE_SPRINT,
  FIXTURE_WORK_ITEMS,
} from './azure/sprintFixtures'

const SPRINT_9: Sprint = { id: 's9', number: 9, fiscalYear: 'FY25-26', startDate: '2025-09-15', endDate: '2025-09-26', totalValidDays: 10 }

const DELAYED_ITEM: WorkItemRow = {
  ...FIXTURE_WORK_ITEMS[0],
  id: 109,
  title: 'Integração com o ERP',
  storyPoints: 5,
  // Planejado na Sprint 08 (tag) e movido para a Sprint 09 (Iteration Path), onde foi entregue.
  iterationPath: 'Portal\\Sprint 09 - FY25-26',
  tags: 'Delayed; Sprint 08 - FY25-26',
  sprint: 'Sprint 08',
  isDelayed: true,
  closedDate: '2025-09-18T12:00:00Z',
}

const TEST_CASE: WorkItemRow = {
  ...FIXTURE_WORK_ITEMS[0],
  id: 301,
  workItemType: 'Test Case',
  title: 'Login com SSO - caminho feliz',
  assignedTo: 'Grace Hopper',
  email: 'grace@example.com',
  storyPoints: 0,
  pontoExecucao: 18,
  runs: 2,
}

export const PERSON_FIXTURE_ROWS: WorkItemRow[] = [...FIXTURE_WORK_ITEMS, DELAYED_ITEM, TEST_CASE]
export const PERSON_FIXTURE_SPRINTS: Sprint[] = [FIXTURE_SPRINT, SPRINT_9]
export const PERSON_FIXTURE_DELAYED_ITEM = DELAYED_ITEM
export const PERSON_FIXTURE_DELAY = delayInfo(DELAYED_ITEM, new Map(PERSON_FIXTURE_SPRINTS.map((s) => [formatSprintLabel(s), s])))

const EXECUTIONS: TestExecution[] = [
  { id: 'e1', squadId: 'sq1', sprintId: 's8', email: 'grace@example.com', name: 'Grace Hopper', executed: 42, passed: 36, failed: 4, other: 2 },
  { id: 'e2', squadId: 'sq1', sprintId: 's9', email: 'grace@example.com', name: 'Grace Hopper', executed: 30, passed: 29, failed: 1, other: 0 },
]

const base = {
  rows: PERSON_FIXTURE_ROWS,
  sprints: PERSON_FIXTURE_SPRINTS,
  allocations: FIXTURE_ALLOCATIONS,
  levels: DEFAULT_LEVELS,
  squads: [{ id: 'sq1', name: 'Portal' }],
  selectedSprints: [],
}

export const PERSON_FIXTURE_DEV_METRICS = computePersonDevMetrics({
  ...base,
  person: FIXTURE_PEOPLE[0],
  mode: 'assigned',
  pointTypes: FIXTURE_POINT_TYPES,
})

export const PERSON_FIXTURE_QA_METRICS = computePersonQaMetrics({ ...base, person: FIXTURE_PEOPLE[2], executions: EXECUTIONS })

const CARGOS: CargoConfig[] = [
  { id: 'c1', cargo: 'Sr Software Developer', tipo: 'Dev', nivel: 'SR' },
  { id: 'c2', cargo: 'Software Developer', tipo: 'Dev', nivel: 'PL' },
  { id: 'c3', cargo: 'Sr Software Tester Quality', tipo: 'QA', nivel: 'SR' },
]

export const PERSON_FIXTURE_SUMMARY = computePeopleSummary({
  ...base,
  people: FIXTURE_PEOPLE,
  cargos: CARGOS,
  executions: EXECUTIONS,
  mode: 'assigned',
  pointTypes: FIXTURE_POINT_TYPES,
})
