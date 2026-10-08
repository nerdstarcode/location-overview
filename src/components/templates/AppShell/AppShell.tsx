import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ChartColumn, ClipboardList, Cloud, Layers, LayoutDashboard, Menu, SlidersHorizontal, Users } from 'lucide-react'
import { Sidebar } from '../../organisms/Sidebar/Sidebar'
import { NavItem } from '../../molecules/NavItem/NavItem'
import { ThemeToggle } from '../../atoms/ThemeToggle/ThemeToggle'
import { ColorblindToggle } from '../../atoms/ColorblindToggle/ColorblindToggle'
import { HighContrastToggle } from '../../atoms/HighContrastToggle/HighContrastToggle'
import { DataBackup } from '../../molecules/DataBackup/DataBackup'

const STORAGE_MENU_OPEN = 'location-overview:sidebar-open'

function readMenuOpen() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_MENU_OPEN) ?? 'false') === true
  } catch {
    return false
  }
}

// Layout raiz da aplicação: menu lateral simples (sem autenticação/permissões)
// + barra superior com o toggle de tema + conteúdo da rota via <Outlet />.
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(readMenuOpen)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_MENU_OPEN, JSON.stringify(menuOpen))
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [menuOpen])

  return (
    <div className="flex h-screen w-full bg-[var(--bg)]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)}>
        <NavItem to="/" label="Alocação" icon={LayoutDashboard} exact />
        <NavItem to="/work-items" label="Work Items" icon={ClipboardList} />
        <NavItem to="/dashboard" label="Dashboard" icon={ChartColumn} />
        <NavItem to="/pessoas" label="Pessoas" icon={Users} />
        <NavItem to="/squads" label="Squads" icon={Layers} />
        <NavItem to="/niveis" label="Níveis" icon={SlidersHorizontal} />
        <NavItem to="/azure" label="Azure DevOps" icon={Cloud} />
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-6">
          <div className="flex items-center gap-3">
            {!menuOpen && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Abrir menu"
                className="rounded-md p-1.5 text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)]"
              >
                <Menu size={18} />
              </button>
            )}
            <h1 className="text-lg font-semibold text-[var(--text-h)]">Alocação Sprint</h1>
          </div>
          <div className="flex items-center gap-1">
            <DataBackup />
            <ColorblindToggle />
            <HighContrastToggle />
            <ThemeToggle />
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
