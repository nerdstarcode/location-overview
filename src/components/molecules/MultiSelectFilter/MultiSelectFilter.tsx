import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { Checkbox } from '../../atoms/Checkbox/Checkbox'
import { Chip } from '../../atoms/Chip/Chip'

export interface MultiSelectFilterProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}

// Filtro multiselect com autocomplete no padrão do Autocomplete "multiple" do
// MUI (busca + checkboxes + chips), construído com os átomos do projeto —
// não há dependência de MUI aqui.
export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const filteredOptions = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()))

  function toggleOption(option: string) {
    onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
          selected.length > 0
            ? 'border-[var(--accent)] text-[var(--text-h)]'
            : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--code-bg)]',
        )}
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="rounded-full bg-[var(--accent)] px-1.5 text-xs text-white">{selected.length}</span>
        )}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-lg">
          {selected.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
              {selected.map((value) => (
                <Chip key={value} label={value} onRemove={() => toggleOption(value)} />
              ))}
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar..."
            autoFocus
            className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text-h)] outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 && (
              <p className="px-1 py-2 text-xs text-[var(--text)]">Nenhuma opção encontrada.</p>
            )}
            {filteredOptions.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-[var(--text-h)] hover:bg-[var(--code-bg)]"
              >
                <Checkbox checked={selected.includes(option)} onChange={() => toggleOption(option)} />
                <span className="truncate">{option}</span>
              </label>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-xs">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[var(--text)] hover:text-[var(--text-h)]"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => onChange([...new Set([...selected, ...filteredOptions])])}
              className="text-[var(--text)] hover:text-[var(--text-h)]"
            >
              Selecionar todos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
