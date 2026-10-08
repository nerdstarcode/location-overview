import { readList, removeKey, writeJson } from './localStore'
import { getAllocationKey, type AllocationRow } from './allocation'

const STORAGE_KEY = 'location-overview:allocations'

export { getAllocationKey }

/**
 * Faz upsert de `incoming` sobre `existing` por `getAllocationKey`: em caso de
 * chave repetida, o registro importado por último vence. O resultado sempre
 * volta ordenado por Sprint e, em seguida, por Name.
 */
export function mergeAllocations(existing: AllocationRow[], incoming: AllocationRow[]): AllocationRow[] {
  const byKey = new Map<string, AllocationRow>()
  for (const row of existing) byKey.set(getAllocationKey(row), row)
  for (const row of incoming) byKey.set(getAllocationKey(row), row)

  return [...byKey.values()].sort(
    (a, b) => a.sprint.localeCompare(b.sprint) || a.name.localeCompare(b.name),
  )
}

/** Dados antigos (antes do rename Min -> Capacity) ainda podem ter `minPointsDay`/`minPointsSprint` salvos. */
function migrateAllocation(raw: unknown): AllocationRow {
  const row = raw as AllocationRow & { minPointsDay?: number; minPointsSprint?: number }
  return {
    ...row,
    capacityPointsDay: row.capacityPointsDay ?? row.minPointsDay ?? 0,
    capacityPointsSprint: row.capacityPointsSprint ?? row.minPointsSprint ?? 0,
  }
}

export function loadAllocations(): AllocationRow[] {
  return readList<unknown>(STORAGE_KEY).map(migrateAllocation)
}

export function saveAllocations(rows: AllocationRow[]): void {
  writeJson(STORAGE_KEY, rows)
}

export function clearAllocations(): void {
  removeKey(STORAGE_KEY)
}
