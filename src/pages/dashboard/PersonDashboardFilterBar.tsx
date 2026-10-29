import type { ReactNode } from 'react'
import { Checkbox } from '../../components/atoms/Checkbox/Checkbox'
import { MultiSelectFilter } from '../../components/molecules/MultiSelectFilter/MultiSelectFilter'
import type { usePersonDashboardFilters } from './personDashboardBase'

export interface PersonDashboardFilterBarProps {
  filters: ReturnType<typeof usePersonDashboardFilters>
  /** Controles antes dos filtros (ex.: seletor de pessoa). */
  leading?: ReactNode
  /** Controles depois dos filtros (ex.: Dev | QA). */
  trailing?: ReactNode
}

// Filtros das Métricas Individuais e do Resumo: ano fiscal, sprint, squad e só sprints com alocação.
export function PersonDashboardFilterBar({ filters, leading, trailing }: PersonDashboardFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {leading}
      <MultiSelectFilter
        label="Ano fiscal"
        options={filters.fiscalYearOptions}
        selected={filters.selectedFiscalYears}
        onChange={filters.setSelectedFiscalYears}
      />
      <MultiSelectFilter
        label="Sprint"
        options={filters.sprintOptions}
        selected={filters.selectedSprints}
        onChange={filters.setSelectedSprints}
      />
      <MultiSelectFilter
        label="Squad"
        options={filters.squadOptions}
        selected={filters.selectedSquads}
        onChange={filters.setSelectedSquads}
      />
      <label
        className="flex h-9 items-center gap-2 text-sm text-[var(--text-h)]"
        title="Considera só as sprints em que a pessoa tem alocação cadastrada (na squad filtrada, se houver)."
      >
        <Checkbox checked={filters.onlyAllocatedSprints} onChange={(e) => filters.setOnlyAllocatedSprints(e.target.checked)} />
        Só sprints com alocação
      </label>
      {trailing}
    </div>
  )
}
