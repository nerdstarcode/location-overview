import type { Person } from './peopleStorage'
import { squadMatchesIterationPath } from './squadMatching'
import type { Sprint } from './sprintsStorage'
import type { Squad } from './squadsStorage'
import type { WorkItemRow } from './workItems'

const sameEmail = (item: WorkItemRow, email: string | undefined) => {
  const normalized = email?.trim().toLowerCase()
  return !normalized || item.email.trim().toLowerCase() === normalized
}

/** Itens planejados para a sprint (colunas Sprint e Fiscal Year), em qualquer squad. */
function inSprint(item: WorkItemRow, sprint: Sprint): boolean {
  return item.sprint === `Sprint ${String(sprint.number).padStart(2, '0')}` && item.fiscalYear === sprint.fiscalYear.toUpperCase()
}

/**
 * Work items cujo Iteration Path bata com a squad e cujo Sprint/Fiscal Year
 * batam com a sprint — opcionalmente também restrito ao email de uma pessoa.
 */
export function matchingWorkItems(workItems: WorkItemRow[], squad: Squad, sprint: Sprint, email?: string): WorkItemRow[] {
  return workItems.filter(
    (item) => squadMatchesIterationPath(squad, item.iterationPath) && inSprint(item, sprint) && sameEmail(item, email),
  )
}

export function matchedStoryPoints(workItems: WorkItemRow[], squad: Squad, sprint: Sprint): number {
  return matchingWorkItems(workItems, squad, sprint).reduce((sum, item) => sum + item.storyPoints, 0)
}

/** Soma Story Points e Pontos de Execução dos work items de uma pessoa (por email) que batem com a squad e a sprint. */
export function personPoints(
  workItems: WorkItemRow[],
  squad: Squad,
  sprint: Sprint,
  person: Person | undefined,
): { storyPoints: number; pontoExecucao: number } {
  if (!person?.email.trim()) return { storyPoints: 0, pontoExecucao: 0 }
  const matches = matchingWorkItems(workItems, squad, sprint, person.email)
  return {
    storyPoints: matches.reduce((sum, item) => sum + item.storyPoints, 0),
    pontoExecucao: matches.reduce((sum, item) => sum + item.pontoExecucao, 0),
  }
}

/** SP planejados da pessoa (por email) na sprint, em qualquer squad: a base do apoio no detalhe da squad. */
export function personSprintStoryPoints(workItems: WorkItemRow[], sprint: Sprint, person: Person | undefined): number {
  if (!person?.email.trim()) return 0
  return workItems.filter((item) => inSprint(item, sprint) && sameEmail(item, person.email)).reduce((sum, item) => sum + item.storyPoints, 0)
}
