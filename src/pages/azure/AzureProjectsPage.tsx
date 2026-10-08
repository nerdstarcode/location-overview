import { Link } from 'react-router-dom'
import { RotateCw, Settings } from 'lucide-react'
import { AzureProjectsList } from '../../components/organisms/AzureProjectsList/AzureProjectsList'
import { RequestState } from '../../components/molecules/RequestState/RequestState'
import { Button } from '../../components/atoms/Button/Button'
import { buttonClasses } from '../../components/atoms/Button/buttonClasses'
import { useAzureProjects } from '../../hooks/azure/azureQueries'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'

export function AzureProjectsPage() {
  const { config } = useAzureConfig()
  const projects = useAzureProjects()

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--text-h)]">
          Projetos <span className="font-normal text-[var(--text)]">· {config.organization}</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={projects.reload} disabled={projects.loading}>
            <RotateCw size={14} className={projects.loading ? 'animate-spin' : undefined} /> Atualizar
          </Button>
          <Link to="/azure/configuracao" className={buttonClasses('secondary')}>
            <Settings size={14} /> Configuração
          </Link>
        </div>
      </div>
      <RequestState
        loading={projects.loading}
        error={projects.error}
        empty={!projects.data || projects.data.length === 0}
        emptyMessage="Nenhum projeto visível para este token."
        loadingMessage="Carregando projetos…"
        onRetry={projects.reload}
      >
        <AzureProjectsList projects={projects.data ?? []} />
      </RequestState>
    </div>
  )
}
