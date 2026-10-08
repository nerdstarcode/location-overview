import { readList, writeJson } from './localStore'

export interface Sprint {
  id: string
  number: number
  fiscalYear: string
  startDate: string
  endDate: string
  totalValidDays: number
}

export const DEFAULT_TOTAL_VALID_DAYS = 10

const STORAGE_KEY = 'location-overview:sprints'

/** Mesmo formato aceito em src/lib/workItems.tsx (SPRINT_PATTERN). */
const FISCAL_YEAR_PATTERN = /^FY\d{2}-\d{2}$/i

export function isValidFiscalYear(value: string): boolean {
  return FISCAL_YEAR_PATTERN.test(value.trim())
}

/** "Sprint 08 - FY25-26", no mesmo formato normalizado de parseSprintInfo. */
export function formatSprintLabel(sprint: Pick<Sprint, 'number' | 'fiscalYear'>): string {
  return `Sprint ${String(sprint.number).padStart(2, '0')} - ${sprint.fiscalYear.toUpperCase()}`
}

export function loadSprints(): Sprint[] {
  return readList<Sprint>(STORAGE_KEY)
}

export function saveSprints(sprints: Sprint[]): void {
  writeJson(STORAGE_KEY, sprints)
}

/** Cria (sem id) ou atualiza (com id existente) uma sprint, ordenada por Fiscal Year e depois por número. */
export function upsertSprint(sprint: Sprint): Sprint[] {
  const sprints = loadSprints()
  const index = sprints.findIndex((s) => s.id === sprint.id)
  const next = index >= 0 ? sprints.map((s, i) => (i === index ? sprint : s)) : [...sprints, sprint]
  next.sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear) || a.number - b.number)
  saveSprints(next)
  return next
}

export function deleteSprint(id: string): Sprint[] {
  const next = loadSprints().filter((s) => s.id !== id)
  saveSprints(next)
  return next
}
