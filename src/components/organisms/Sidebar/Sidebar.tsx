import type { ReactNode } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'

export interface SidebarProps {
  children: ReactNode
  open?: boolean
  onClose?: () => void
}

// Menu lateral colapsável, sem estado de usuário/permissões — apenas a lista de
// NavItem passada em `children`.
export function Sidebar({ children, open = false, onClose }: SidebarProps) {
  return (
    <aside
      aria-label="Menu principal"
      aria-hidden={!open}
      className={clsx(
        'h-full shrink-0 overflow-hidden bg-[var(--bg-elevated)] transition-[width] duration-200 ease-out',
        open ? 'w-64 border-r border-[var(--border)]' : 'w-0',
      )}
    >
      <div className="flex h-full w-64 flex-col">
        <div className="h-14 shrink-0 px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex h-full w-full items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)]"
          >
            <X size={16} />
            <span className="text-sm">Fechar</span>
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3">{children}</nav>

        <div className="shrink-0 px-3 py-4 text-center">
          <p className="text-[10px] tracking-wide text-[var(--text)] opacity-60 uppercase">Desenvolvido por</p>
          <p className="mt-0.5 text-xs text-[var(--text)] opacity-80">Ana Paula Teixeira &amp; Sthiven Correia</p>
        </div>
      </div>
    </aside>
  )
}
