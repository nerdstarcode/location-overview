import { createId } from '../createId'
import { toDateKey } from '../dates'
import { loadPeople, savePeople, type Person } from '../peopleStorage'
import { DEFAULT_TOTAL_VALID_DAYS, loadSprints, upsertSprint, type Sprint } from '../sprintsStorage'
import { loadSquads, upsertSquad, type Squad } from '../squadsStorage'
import { squadMatchesName } from '../squadMatching'
import { DEFAULT_TEST_POINTS_RATIO, loadTestReports, upsertTestReport } from '../testReportsStorage'
import { normalizeKey } from '../text'
import type { WorkItemRow } from '../workItems'
import { loadWorkItems, mergeWorkItems, saveWorkItems } from '../workItemsStorage'
import { iterationSprintInfo, testRunsToReportFields, type TestRunsSummary } from './mappers'
import type { AzureIteration, AzureTeamMember } from './types'

/** Resultado de uma sincronização: o que foi gravado, ou por que nada foi gravado. */
export type SyncOutcome<T> = { ok: true; result: T } | { ok: false; reason: string }

/** Squad cujo nome principal ou algum alias seja `name`. */
export function findSquadByName(squads: Squad[], name: string): Squad | undefined {
  return squads.find((squad) => squadMatchesName(squad, name))
}

export function findSprintForIteration(sprints: Sprint[], iteration: AzureIteration): Sprint | undefined {
  const info = iterationSprintInfo(iteration)
  if (!info) return undefined
  return sprints.find(
    (sprint) => sprint.number === info.number && normalizeKey(sprint.fiscalYear) === normalizeKey(info.fiscalYear),
  )
}

/** Team → Squad de mesmo nome ou alias (mantendo o id) ou uma nova. */
export function upsertSquadByName(name: string): { squad: Squad; created: boolean } {
  const existing = findSquadByName(loadSquads(), name)
  if (existing) return { squad: existing, created: false }
  const squad = { id: createId(), name: name.trim() }
  upsertSquad(squad)
  return { squad, created: true }
}

function newPersonFromMember({ identity }: AzureTeamMember, squadId: string): Person {
  return { id: createId(), nome: identity.displayName.trim(), email: identity.uniqueName.trim(), cargo: '', nivel: '', squadIds: [squadId] }
}

/**
 * Membros do Team → Pessoas, casando por email. Pessoas existentes só ganham o vínculo
 * com a squad (cargo/nível não mudam); as novas entram sem cargo/nível para completar depois.
 */
export function upsertPeopleFromTeam(squadId: string, members: AzureTeamMember[]): { created: number; linked: number } {
  const people = loadPeople()
  let created = 0
  let linked = 0
  for (const member of members) {
    const index = people.findIndex((p) => normalizeKey(p.email) === normalizeKey(member.identity.uniqueName))
    if (index < 0) {
      people.push(newPersonFromMember(member, squadId))
      created += 1
    } else if (!people[index].squadIds.includes(squadId)) {
      people[index] = { ...people[index], squadIds: [...people[index].squadIds, squadId] }
      linked += 1
    }
  }
  savePeople(people.sort((a, b) => a.nome.localeCompare(b.nome)))
  return { created, linked }
}

/**
 * Iteration → Sprint (por número + Fiscal Year). Sprint nova entra com
 * DEFAULT_TOTAL_VALID_DAYS; uma existente mantém o totalValidDays, que é editado
 * à mão (Sprints ou Análise da Sprint) — o calendário do Azure não o sobrescreve.
 * null quando o nome da iteration não segue "Sprint N - FYxx-yy" ou ela não tem datas.
 */
export function upsertSprintFromIteration(iteration: AzureIteration): { sprint: Sprint; created: boolean } | null {
  const info = iterationSprintInfo(iteration)
  const { startDate, finishDate } = iteration.attributes
  if (!info || !startDate || !finishDate) return null

  const existing = findSprintForIteration(loadSprints(), iteration)
  const sprint: Sprint = {
    id: existing?.id ?? createId(),
    number: info.number,
    fiscalYear: info.fiscalYear,
    startDate: toDateKey(startDate),
    endDate: toDateKey(finishDate),
    totalValidDays: existing?.totalValidDays ?? DEFAULT_TOTAL_VALID_DAYS,
  }
  upsertSprint(sprint)
  return { sprint, created: !existing }
}

/** Upsert por ID sobre a base de Work Items (mesma regra da importação por planilha). */
export function upsertWorkItems(rows: WorkItemRow[]): number {
  saveWorkItems(mergeWorkItems(loadWorkItems(), rows))
  return rows.length
}

/** Relatório de Testes da squad/sprint a partir dos runs, preservando o pointsRatio já ajustado. */
export function upsertTestReportFromRuns(squadId: string, sprintId: string, summary: TestRunsSummary): void {
  const existing = loadTestReports().find((r) => r.squadId === squadId && r.sprintId === sprintId)
  upsertTestReport({
    id: existing?.id ?? createId(),
    squadId,
    sprintId,
    pointsRatio: existing?.pointsRatio ?? DEFAULT_TEST_POINTS_RATIO,
    ...testRunsToReportFields(summary),
  })
}

export interface TeamSyncInput {
  teamName: string
  members: AzureTeamMember[]
  iterations: AzureIteration[]
}

export interface TeamSyncResult {
  squadCreated: boolean
  peopleCreated: number
  peopleLinked: number
  sprintsSynced: number
}

export function syncTeamToBase(input: TeamSyncInput): TeamSyncResult {
  const { squad, created } = upsertSquadByName(input.teamName)
  const people = upsertPeopleFromTeam(squad.id, input.members)
  const sprintsSynced = input.iterations.filter((iteration) => upsertSprintFromIteration(iteration) !== null).length
  return { squadCreated: created, peopleCreated: people.created, peopleLinked: people.linked, sprintsSynced }
}

export interface SprintSyncInput {
  teamName: string
  members: AzureTeamMember[]
  iteration: AzureIteration
  workItems: WorkItemRow[]
  testRuns: TestRunsSummary | null
}

export interface SprintSyncResult {
  squadCreated: boolean
  peopleCreated: number
  peopleLinked: number
  /** null quando a iteration não pôde virar Sprint (nome fora do padrão ou sem datas). */
  sprintCreated: boolean | null
  workItems: number
  testReport: boolean
}

function syncTestReport(squadId: string, sprint: Sprint | undefined, testRuns: TestRunsSummary | null): boolean {
  if (!sprint || !testRuns || testRuns.runCount === 0) return false
  upsertTestReportFromRuns(squadId, sprint.id, testRuns)
  return true
}

export function syncSprintToBase(input: SprintSyncInput): SprintSyncResult {
  const { squad, created: squadCreated } = upsertSquadByName(input.teamName)
  const people = upsertPeopleFromTeam(squad.id, input.members)
  const sprintResult = upsertSprintFromIteration(input.iteration)
  return {
    squadCreated,
    peopleCreated: people.created,
    peopleLinked: people.linked,
    sprintCreated: sprintResult ? sprintResult.created : null,
    workItems: upsertWorkItems(input.workItems),
    testReport: syncTestReport(squad.id, sprintResult?.sprint, input.testRuns),
  }
}
