import type { Person } from './peopleStorage'
import { squadMatchesIterationPath } from './squadMatching'
import type { Sprint } from './sprintsStorage'
import type { Squad } from './squadsStorage'
import type { WorkItemRow } from './workItems'

/**
 * Work items cujo Iteration Path bata com a squad e cujo Sprint/Fiscal Year
 * batam com a sprint — opcionalmente também restrito ao email de uma pessoa.
 */
export function matchingWorkItems(workItems: WorkItemRow[], squad: Squad, sprint: Sprint, email?: string): WorkItemRow[] {
  const sprintLabel = `Sprint ${String(sprint.number).padStart(2, '0')}`
  const fiscalYear = sprint.fiscalYear.toUpperCase()
  const normalizedEmail = email?.trim().toLowerCase()
  return workItems.filter(
    (item) =>
      squadMatchesIterationPath(squad, item.iterationPath) &&
      item.sprint === sprintLabel &&
      item.fiscalYear === fiscalYear &&
      (!normalizedEmail || item.email.trim().toLowerCase() === normalizedEmail),
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
