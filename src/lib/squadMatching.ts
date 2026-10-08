import type { Squad } from './squadsStorage'
import { normalizeKey } from './text'

/** Nome principal seguido dos nomes alternativos da squad. */
export function squadNames(squad: Squad): string[] {
  return [squad.name, ...(squad.aliases ?? [])]
}

/** A squad se chama `name` — pelo nome principal ou por um dos aliases. */
export function squadMatchesName(squad: Squad, name: string): boolean {
  const key = normalizeKey(name)
  return squadNames(squad).some((candidate) => normalizeKey(candidate) === key)
}

/**
 * Algum nome da squad (principal ou alias) aparece como um segmento do
 * Iteration Path — o separador varia entre "/" (ex.: "Apollo/Sprint 08 -
 * FY25-26") e "\" (ex.: "Renewals\Sprint 08 - FY26-27"), então aceita os dois.
 */
export function squadMatchesIterationPath(squad: Squad, iterationPath: string): boolean {
  return iterationPath.split(/[/\\]/).some((segment) => squadMatchesName(squad, segment))
}

/** Nome principal da squad cadastrada (squadsStorage) que bate com o Iteration Path, ou null se nenhuma bater. */
export function findSquadNameForIterationPath(squads: Squad[], iterationPath: string): string | null {
  return squads.find((squad) => squadMatchesIterationPath(squad, iterationPath))?.name ?? null
}

/** Nome principal da squad que se chama `name` (principal ou alias); sem squad cadastrada, devolve o próprio `name`. */
export function resolveSquadName(squads: Squad[], name: string): string {
  return squads.find((squad) => squadMatchesName(squad, name))?.name ?? name
}
