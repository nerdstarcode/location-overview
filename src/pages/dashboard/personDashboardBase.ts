import { useMemo } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
import { loadCargos } from '../../lib/cargosStorage'
import { loadLevels } from '../../lib/levelsStorage'
import { loadPeople } from '../../lib/peopleStorage'
import { loadPersonAllocations } from '../../lib/personAllocationsStorage'
import { compareSprintLabels, fiscalYearOfLabel, plannedSprintLabel, type DevAttribution } from '../../lib/personMetrics'
import { formatSprintLabel, loadSprints } from '../../lib/sprintsStorage'
import { loadSquads } from '../../lib/squadsStorage'
import { loadTestExecutions } from '../../lib/testExecutionsStorage'
import { loadTestReports } from '../../lib/testReportsStorage'
import { loadWorkItems } from '../../lib/workItemsStorage'

// Base e filtros comuns às Métricas Individuais e ao Resumo: os filtros
// ficam no mesmo localStorage, então ir do resumo para uma pessoa mantém os filtros.

export type PersonDashboardBase = ReturnType<typeof loadPersonDashboardBase>

export function loadPersonDashboardBase() {
  return {
    people: loadPeople(),
    rows: loadWorkItems(),
    sprints: loadSprints(),
    allocations: loadPersonAllocations(),
    levels: loadLevels(),
    cargos: loadCargos(),
    executions: loadTestExecutions(),
    testReports: loadTestReports(),
    squads: loadSquads(),
  }
}

export function usePersonDashboardFilters(base: PersonDashboardBase) {
  const [selectedSprints, setSelectedSprints] = usePersistedState<string[]>('person-dashboard-sprints', [])
  const [selectedSquads, setSelectedSquads] = usePersistedState<string[]>('person-dashboard-squads', [])
  const [selectedFiscalYears, setSelectedFiscalYears] = usePersistedState<string[]>('person-dashboard-fiscal-years', [])
  const [onlyAllocatedSprints, setOnlyAllocatedSprints] = usePersistedState('person-dashboard-only-allocated', false)
  const [mode, setMode] = usePersistedState<DevAttribution>('person-dashboard-dev-mode', 'assigned')

  const allSprintLabels = useMemo(() => {
    const labels = new Set([...base.sprints.map(formatSprintLabel), ...base.rows.map(plannedSprintLabel)])
    labels.delete('')
    return [...labels].sort((a, b) => compareSprintLabels(b, a))
  }, [base])

  const fiscalYearOptions = useMemo(
    () => [...new Set(allSprintLabels.map(fiscalYearOfLabel).filter(Boolean))].sort().reverse(),
    [allSprintLabels],
  )
  // Com ano fiscal escolhido, o filtro de Sprint só oferece as sprints desses anos.
  const sprintOptions = useMemo(
    () =>
      selectedFiscalYears.length === 0
        ? allSprintLabels
        : allSprintLabels.filter((label) => selectedFiscalYears.includes(fiscalYearOfLabel(label))),
    [allSprintLabels, selectedFiscalYears],
  )
  const squadOptions = useMemo(() => base.squads.map((squad) => squad.name).sort((a, b) => a.localeCompare(b)), [base])
  // Mesma referência enquanto os filtros não mudam: os cálculos das páginas dependem dela.
  const metricsFilters = useMemo(
    () => ({ selectedSprints, selectedSquads, selectedFiscalYears, onlyAllocatedSprints }),
    [selectedSprints, selectedSquads, selectedFiscalYears, onlyAllocatedSprints],
  )

  return {
    selectedSprints,
    setSelectedSprints,
    selectedSquads,
    setSelectedSquads,
    selectedFiscalYears,
    setSelectedFiscalYears,
    onlyAllocatedSprints,
    setOnlyAllocatedSprints,
    mode,
    setMode,
    sprintOptions,
    squadOptions,
    fiscalYearOptions,
    /** O que os cálculos de personMetrics recebem. */
    metricsFilters,
  }
}
