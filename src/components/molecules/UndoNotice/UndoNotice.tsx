import { X } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'

export interface UndoNoticeProps {
  label: string
  onUndo: () => void
  onClose: () => void
}

// Aviso logo depois de uma remoção, com o botão "Desfazer" (o tempo na tela fica com useUndo).
export function UndoNotice({ label, onUndo, onClose }: UndoNoticeProps) {
  return (
    <div role="status" className="flex items-center justify-between gap-2 rounded-md bg-[var(--code-bg)] px-3 py-2 text-sm text-[var(--text-h)]">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="secondary" onClick={onUndo}>
          Desfazer
        </Button>
        <button type="button" aria-label="Fechar aviso" onClick={onClose} className="rounded p-1 text-[var(--text)] hover:text-[var(--text-h)]">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
