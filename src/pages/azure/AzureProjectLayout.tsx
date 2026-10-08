import { Link, Outlet, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { AzureProjectProvider } from '../../contexts/azure/AzureProjectProvider'

// Layout da rota `azure/:projectId`: provê o AzureProjectContext para a lista de
// sprints e para a análise de sprint (rotas filhas).
export function AzureProjectLayout() {
  const { projectId = '' } = useParams()

  return (
    <AzureProjectProvider>
      <div className="flex w-full flex-col gap-4">
        <nav aria-label="Navegação" className="flex items-center gap-1 text-sm text-[var(--text)]">
          <Link to="/azure" className="hover:text-[var(--text-h)] hover:underline">
            Projetos
          </Link>
          <ChevronRight size={14} />
          <Link to={`/azure/${encodeURIComponent(projectId)}`} className="font-medium text-[var(--text-h)] hover:underline">
            {projectId}
          </Link>
        </nav>
        <Outlet />
      </div>
    </AzureProjectProvider>
  )
}
