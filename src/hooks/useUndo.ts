import { useEffect, useState } from 'react'

/** Quanto tempo o "Desfazer" fica na tela depois de remover. */
export const UNDO_TIMEOUT_MS = 8000

// O que acabou de ser removido, para oferecer o "Desfazer"; some sozinho depois de UNDO_TIMEOUT_MS.
export function useUndo<T>() {
  const [undo, setUndo] = useState<{ items: T[]; label: string } | null>(null)

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [undo])

  return {
    undo,
    offer: (items: T[], label: string) => setUndo({ items, label }),
    clear: () => setUndo(null),
  }
}
