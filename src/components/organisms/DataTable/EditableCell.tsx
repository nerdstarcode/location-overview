import { useEffect, useState, type ChangeEvent } from 'react'

export interface EditableCellProps {
  value: string
  type?: 'text' | 'number'
  onCommit: (value: string) => void
}

// Input compacto para edição inline de células do DataTable: sincroniza com o
// valor externo, mas só dispara `onCommit` ao perder o foco ou dar Enter —
// evita recalcular/persistir a cada tecla digitada.
export function EditableCell({ value, type = 'text', onCommit }: EditableCellProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value)
  }

  function commit() {
    if (draft !== value) onCommit(draft)
  }

  return (
    <input
      type={type}
      value={draft}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      onClick={(event) => event.stopPropagation()}
      style={type === 'number' ? undefined : { width: `${Math.max(draft.length, 1) + 1}ch` }}
      className={`border-0 bg-transparent px-1 py-0.5 text-inherit outline-none focus:bg-[var(--accent)]/10 focus:ring-1 focus:ring-blue-500 ${
        type === 'number' ? 'w-full min-w-0' : ''
      }`}
    />
  )
}
