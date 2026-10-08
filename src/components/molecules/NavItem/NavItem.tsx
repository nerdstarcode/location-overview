import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

export interface NavItemProps {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

export function NavItem({ to, label, icon: Icon, exact }: NavItemProps) {
  return (
    <NavLink to={to} end={exact} className="relative block py-1">
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-[var(--accent)]"
            />
          )}
          <span
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-[var(--accent-bg)] text-[var(--text-h)]'
                : 'text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]',
            )}
          >
            <Icon size={16} />
            <span className="truncate">{label}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}
