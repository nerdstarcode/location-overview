import { readList, removeKey, writeJson } from './localStore'
import { getWorkItemKey, type WorkItemRow } from './workItems'

const STORAGE_KEY = 'location-overview:work-items'

export { getWorkItemKey }

/** Faz upsert de `incoming` sobre `existing` por ID: em caso de ID repetido, o registro importado por último vence. */
export function mergeWorkItems(existing: WorkItemRow[], incoming: WorkItemRow[]): WorkItemRow[] {
  const byKey = new Map<string, WorkItemRow>()
  for (const row of existing) byKey.set(getWorkItemKey(row), row)
  for (const row of incoming) byKey.set(getWorkItemKey(row), row)

  return [...byKey.values()].sort((a, b) => a.id - b.id)
}

/** Work items salvos antes de Time Criticality/WSJF existirem não têm esses campos. */
export function loadWorkItems(): WorkItemRow[] {
  return readList<WorkItemRow>(STORAGE_KEY).map((row) => ({
    ...row,
    effort: row.effort ?? 0,
    timeCriticality: row.timeCriticality ?? 0,
    wsjf: row.wsjf ?? 0,
  }))
}

export function saveWorkItems(rows: WorkItemRow[]): void {
  writeJson(STORAGE_KEY, rows)
}

export function clearWorkItems(): void {
  removeKey(STORAGE_KEY)
}
