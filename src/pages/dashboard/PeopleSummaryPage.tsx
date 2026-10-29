import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SegmentedControl } from '../../components/molecules/SegmentedControl/SegmentedControl'
import { PeopleSummary, type PeopleSummaryView } from '../../components/organisms/PeopleSummary/PeopleSummary'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'
import { usePersistedState } from '../../hooks/usePersistedState'
import { computePeopleSummary } from '../../lib/personMetrics'
import { loadPersonDashboardBase, usePersonDashboardFilters } from './personDashboardBase'
import { PersonDashboardFilterBar } from './PersonDashboardFilterBar'

const VIEW_OPTIONS: { value: PeopleSummaryView; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'qa', label: 'QA' },
]

// Resumo (`/dashboard/pessoas`): todas as pessoas com os mesmos filtros das Métricas
// Individuais; clicar numa pessoa abre as métricas dela.
export function PeopleSummaryPage() {
  const navigate = useNavigate()
  const { config } = useAzureConfig()
  const [base] = useState(loadPersonDashboardBase)
  const filters = usePersonDashboardFilters(base)
  const { metricsFilters, mode } = filters
  const [view, setView] = usePersistedState<PeopleSummaryView>('people-summary-view', 'dev')

  const rows = useMemo(
    () => computePeopleSummary({ ...base, ...metricsFilters, mode, pointTypes: config.pointTypes }),
    [base, metricsFilters, mode, config.pointTypes],
  )

  if (base.people.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] p-10 text-center text-sm text-[var(--text)]">
        Nenhuma pessoa cadastrada. Cadastre pessoas na página Pessoas ou sincronize uma squad pelo Azure DevOps.
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PersonDashboardFilterBar
        filters={filters}
        trailing={<SegmentedControl aria-label="Visão" options={VIEW_OPTIONS} value={view} onChange={setView} />}
      />

      <PeopleSummary
        rows={rows}
        view={view}
        mode={mode}
        onModeChange={filters.setMode}
        onOpenPerson={(person) => navigate(`/dashboard/pessoa/${encodeURIComponent(person.id)}`)}
      />
    </div>
  )
}
