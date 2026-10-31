import { useState } from 'react'
import {
  addPersonSupport,
  copySupportsFromSprint,
  deletePersonSupports,
  loadPersonSupports,
  restorePersonSupports,
  setSupportPercentage,
  validateSupportDraft,
  type PersonSupport,
  type SupportContext,
  type SupportDraft,
} from '../lib/personSupportsStorage'

// Estado dos apoios (mentoria) entre pessoas e as ações de cadastro, usados pela aba Sprints
// (seção "Apoios da sprint" e atalho no detalhe da squad). Cada ação devolve a mensagem de erro,
// ou null quando gravou.
export function useSupportActions(context: SupportContext) {
  const [supports, setSupports] = useState<PersonSupport[]>(loadPersonSupports)

  function addSupport(draft: SupportDraft): string | null {
    const message = validateSupportDraft(draft, supports, context)
    if (message) return message
    setSupports(addPersonSupport(draft))
    return null
  }

  /** Remove e devolve os removidos, para o "Desfazer". */
  function removeSupports(ids: string[]): PersonSupport[] {
    const { supports: next, removed } = deletePersonSupports(ids)
    setSupports(next)
    return removed
  }

  function restoreSupports(entries: PersonSupport[]) {
    setSupports(restorePersonSupports(entries))
  }

  function setPercentage(id: string, percentage: number): string | null {
    if (!(percentage > 0 && percentage <= 100)) return 'A % deve ser maior que 0 e no máximo 100.'
    setSupports(setSupportPercentage(id, percentage))
    return null
  }

  /** Copia os apoios de uma sprint para outra; devolve quantos pares foram copiados. */
  function copyFromSprint(fromSprintId: string, toSprintId: string): number {
    const { supports: next, copied } = copySupportsFromSprint(fromSprintId, toSprintId)
    setSupports(next)
    return copied
  }

  return { supports, addSupport, removeSupports, restoreSupports, setPercentage, copyFromSprint }
}
