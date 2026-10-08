import { readList, writeJson } from './localStore'
import type { WorkItemRow } from './workItems'

// Work items "ocultos" na Análise da Sprint: continuam na tabela (apagados), mas
// saem dos KPIs e gráficos daquela tela. Os work items em si não são alterados.
const STORAGE_KEY = 'location-overview:hidden-work-items'

export function loadHiddenWorkItems(): number[] {
  return readList<number>(STORAGE_KEY).filter((id) => typeof id === 'number')
}

export function saveHiddenWorkItems(ids: number[]): void {
  writeJson(STORAGE_KEY, ids)
}

/** Oculta o work item se estiver visível, ou volta a mostrar se já estiver oculto. */
export function toggleHiddenWorkItem(id: number): number[] {
  const current = loadHiddenWorkItems()
  const next = current.includes(id) ? current.filter((hiddenId) => hiddenId !== id) : [...current, id]
  saveHiddenWorkItems(next)
  return next
}

/** Remove os itens ocultos e as Tasks filhas deles (pelo parentId). */
export function excludeHidden(items: WorkItemRow[], hidden: ReadonlySet<number>): WorkItemRow[] {
  if (hidden.size === 0) return items
  return items.filter((item) => !hidden.has(item.id) && !(item.parentId !== undefined && hidden.has(item.parentId)))
}
