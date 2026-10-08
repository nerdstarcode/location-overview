import { StatCard } from '../../molecules/StatCard/StatCard'
import { percentOf, round1 } from '../../../lib/numbers'
import type { SprintMetrics } from '../../../lib/azure/sprintMetrics'

export interface SprintKpisProps {
  metrics: SprintMetrics
  workItemsCount: number
  membersCount: number
}

export function SprintKpis({ metrics, workItemsCount, membersCount }: SprintKpisProps) {
  const { capacity, max, entries, missingLevel } = metrics.sprintAllocation
  const hasAllocation = entries.length > 0
  const overMax = hasAllocation && metrics.totalPoints > max
  const allocationHint = hasAllocation ? `${entries.length} pessoa(s) alocada(s)` : 'Sem alocação na base local'
  // Valor em SP (só os tipos que somam pontos); a contagem inclui também as Tasks sem responsável.
  const unassignedCount = metrics.unassignedByType.reduce((sum, group) => sum + group.count, 0)
  const unassignedHint =
    unassignedCount === 0
      ? '0 item(ns)'
      : `${unassignedCount} item(ns): ${metrics.unassignedByType.map((group) => `${group.count} ${group.key}`).join(' · ')}`
  const missingLevelAlert =
    missingLevel > 0 ? `${missingLevel} pessoa(s) sem nível cadastrado contam 0 — veja em "Ver alocação da sprint"` : undefined

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Story Points na sprint"
        value={metrics.totalPoints}
        hint={`${workItemsCount} work item(s)`}
        alert={overMax ? `Acima do Max em ${round1(metrics.totalPoints - max)} SP` : undefined}
      />
      <StatCard label="Effort na sprint" value={metrics.totalEffort} hint="Mesmos tipos dos Story Points" />
      <StatCard label="Capacity Points" value={hasAllocation ? capacity : '—'} hint={allocationHint} alert={missingLevelAlert} />
      <StatCard label="Max Points" value={hasAllocation ? max : '—'} hint={allocationHint} alert={missingLevelAlert} />
      <StatCard
        label="Entregues"
        value={metrics.deliveredPoints}
        hint={`${Math.round(percentOf(metrics.deliveredPoints, metrics.totalPoints))}% do total`}
      />
      <StatCard label="SP Sem responsável" value={metrics.unassigned.storyPoints} hint={unassignedHint} />
      <StatCard label="Pessoas com SP" value={metrics.byPerson.length} hint={`${membersCount} no team`} />
      <StatCard
        label="Execuções de teste"
        value={metrics.testRuns?.runCount ?? '—'}
        hint={metrics.testRuns ? `${metrics.testRuns.totalTests} testes executados` : undefined}
      />
    </div>
  )
}
