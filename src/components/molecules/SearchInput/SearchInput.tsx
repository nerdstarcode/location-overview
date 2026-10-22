import { Search } from 'lucide-react'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

// Campo de busca compacto, na mesma altura dos gatilhos de MultiSelectFilter.
export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: SearchInputProps) {
  return (
    <label className="flex w-full max-w-sm items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm transition-colors focus-within:border-blue-500">
      <Search size={14} className="shrink-0 text-[var(--text)]" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent text-[var(--text-h)] outline-none placeholder:text-[var(--text)]"
      />
    </label>
  )
}
