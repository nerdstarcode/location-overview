import { useId, useState, type ReactNode } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, type LucideIcon } from 'lucide-react'

export interface NavGroupProps {
  label: string
  icon: LucideIcon
  /** Prefixo das rotas do grupo (ex.: "/dashboard"): estando nele, o grupo abre e fica destacado. */
  basePath: string
  /** NavItem filhos. */
  children: ReactNode
}

// Item do menu que agrupa outros NavItem (ex.: Dashboards → Pessoas/Squad/Pessoa). Abre
// sozinho ao entrar numa rota do grupo e pode ser recolhido clicando no cabeçalho.
export function NavGroup({ label, icon: Icon, basePath, children }: NavGroupProps) {
  const { pathname } = useLocation()
  const listId = useId()
  const isWithin = matchPath({ path: basePath, end: false }, pathname) !== null
  const [open, setOpen] = useState(isWithin)

  // Ao navegar para dentro do grupo (ex.: link de outra tela), abre — ajuste durante a
  // renderização, sem efeito.
  const [wasWithin, setWasWithin] = useState(isWithin)
  if (isWithin !== wasWithin) {
    setWasWithin(isWithin)
    if (isWithin) setOpen(true)
  }

  // Recolhido com uma rota de dentro ativa: o cabeçalho mostra que a página atual está aqui.
  const highlight = isWithin && !open

  return (
    <div className="py-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
          highlight
            ? 'bg-[var(--accent-bg)] text-[var(--text-h)]'
            : 'text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]',
          isWithin && 'text-[var(--text-h)]',
        )}
      >
        <Icon size={16} />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown size={14} className={clsx('transition-transform duration-150', open && 'rotate-180')} />
      </button>
      <div id={listId} hidden={!open} className="ml-5 border-l border-[var(--border)] pl-2">
        {children}
      </div>
    </div>
  )
}
