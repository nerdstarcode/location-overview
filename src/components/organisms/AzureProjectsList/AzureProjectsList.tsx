import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { Input } from '../../atoms/Input/Input'
import type { AzureProject } from '../../../lib/azure/types'

export interface AzureProjectsListProps {
  projects: AzureProject[]
  /** Monta o link de cada projeto (padrão: /azure/{nome}). */
  getHref?: (project: AzureProject) => string
}

export function AzureProjectsList({
  projects,
  getHref = (project) => `/azure/${encodeURIComponent(project.name)}`,
}: AzureProjectsListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name))
    return term ? sorted.filter((p) => p.name.toLowerCase().includes(term)) : sorted
  }, [projects, search])

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        placeholder="Buscar projeto…"
        aria-label="Buscar projeto"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text)]">Nenhum projeto encontrado.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <li key={project.id}>
              <Link
                to={getHref(project)}
                className="flex h-full items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition-colors hover:border-blue-500"
              >
                <FolderKanban size={20} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--text-h)]">{project.name}</span>
                  {project.description && (
                    <span className="mt-1 line-clamp-2 block text-xs text-[var(--text)]">{project.description}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
