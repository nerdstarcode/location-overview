import { loadAllocations, saveAllocations } from './allocationStorage'
import type { AllocationRow } from './allocation'
import { loadWorkItems, saveWorkItems } from './workItemsStorage'
import type { WorkItemRow } from './workItems'
import { loadLevels, saveLevels } from './levelsStorage'
import type { LevelConfig } from './levelsStorage'
import { loadPeople, savePeople } from './peopleStorage'
import type { Person } from './peopleStorage'
import { loadSquads, saveSquads } from './squadsStorage'
import type { Squad } from './squadsStorage'
import { loadSprints, saveSprints } from './sprintsStorage'
import type { Sprint } from './sprintsStorage'
import { loadPersonAllocations, savePersonAllocations } from './personAllocationsStorage'
import type { PersonAllocation } from './personAllocationsStorage'
import { loadHiddenWorkItems, saveHiddenWorkItems } from './hiddenWorkItemsStorage'

export interface AppBackup {
  exportedAt: string
  allocations: AllocationRow[]
  workItems: WorkItemRow[]
  levels: LevelConfig[]
  people: Person[]
  squads: Squad[]
  sprints: Sprint[]
  personAllocations: PersonAllocation[]
  /** Opcional: backups anteriores à funcionalidade de ocultar work items não têm. */
  hiddenWorkItems?: number[]
}

/** Reúne todos os dados persistidos em localStorage (todas as telas) num único objeto exportável. */
export function exportAllData(): AppBackup {
  return {
    exportedAt: new Date().toISOString(),
    allocations: loadAllocations(),
    workItems: loadWorkItems(),
    levels: loadLevels(),
    people: loadPeople(),
    squads: loadSquads(),
    sprints: loadSprints(),
    personAllocations: loadPersonAllocations(),
    hiddenWorkItems: loadHiddenWorkItems(),
  }
}

/**
 * Substitui os dados de cada tela pelos do backup — só grava as chaves presentes
 * no arquivo (arrays), ignorando o resto, para tolerar backups parciais/antigos.
 */
export function importAllData(data: unknown): void {
  if (!data || typeof data !== 'object') throw new Error('Arquivo inválido: esperado um objeto JSON.')
  const backup = data as Partial<AppBackup>

  if (Array.isArray(backup.allocations)) saveAllocations(backup.allocations)
  if (Array.isArray(backup.workItems)) saveWorkItems(backup.workItems)
  if (Array.isArray(backup.levels)) saveLevels(backup.levels)
  if (Array.isArray(backup.people)) savePeople(backup.people)
  if (Array.isArray(backup.squads)) saveSquads(backup.squads)
  if (Array.isArray(backup.sprints)) saveSprints(backup.sprints)
  if (Array.isArray(backup.personAllocations)) savePersonAllocations(backup.personAllocations)
  if (Array.isArray(backup.hiddenWorkItems)) saveHiddenWorkItems(backup.hiddenWorkItems)
}
