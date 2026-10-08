import { useMemo, useState } from 'react'
import { Button } from '../../components/atoms/Button/Button'
import { Checkbox } from '../../components/atoms/Checkbox/Checkbox'
import { RequestState } from '../../components/molecules/RequestState/RequestState'
import { ChartCard } from '../../components/molecules/ChartCard/ChartCard'
import { SprintHeader } from '../../components/organisms/SprintHeader/SprintHeader'
import { SprintKpis } from '../../components/organisms/SprintKpis/SprintKpis'
import { SprintPointsByPerson } from '../../components/organisms/SprintPointsByPerson/SprintPointsByPerson'
import { SprintBurnupChart } from '../../components/organisms/SprintBurnupChart/SprintBurnupChart'
import { SprintPointsByTypeChart } from '../../components/organisms/SprintPointsByTypeChart/SprintPointsByTypeChart'
import { SprintPointsByStateChart } from '../../components/organisms/SprintPointsByStateChart/SprintPointsByStateChart'
import { SprintAllocationComparison } from '../../components/organisms/SprintAllocationComparison/SprintAllocationComparison'
import { SprintTestRunsSummary } from '../../components/organisms/SprintTestRunsSummary/SprintTestRunsSummary'
import { SprintAllocationView } from '../../components/organisms/SprintAllocationView/SprintAllocationView'
import { usePersistedState } from '../../hooks/usePersistedState'
import { normalizeKey } from '../../lib/text'
import { SprintAnalysisProvider } from '../../contexts/azure/SprintAnalysisProvider'
import { useSprintAnalysis } from '../../contexts/azure/SprintAnalysisContext'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'
import { DEFAULT_TOTAL_VALID_DAYS, formatSprintLabel } from '../../lib/sprintsStorage'
import type { SprintSyncResult, SyncOutcome } from '../../lib/azure/syncToBase'
import type { PersonPoints } from '../../lib/azure/sprintMetrics'

function describeSync(outcome: SyncOutcome<SprintSyncResult>): string {
  if (!outcome.ok) return outcome.reason
  const { result } = outcome
  const parts = [
    `${result.workItems} work item(s) gravados`,
    `squad ${result.squadCreated ? 'criada' : 'atualizada'}`,
    `${result.peopleCreated} pessoa(s) nova(s), ${result.peopleLinked} vinculada(s)`,
    result.sprintCreated === null
      ? 'sprint não gravada (nome fora do padrão "Sprint N - FYxx-yy")'
      : `sprint ${result.sprintCreated ? 'criada' : 'atualizada'}`,
    result.testReport ? 'relatório de testes atualizado' : 'sem test runs para o relatório',
  ]
  return `Base atualizada: ${parts.join(' · ')}.`
}

function TestRunsSection() {
  const { metrics, testRuns, workingDays } = useSprintAnalysis()
  if (metrics.testRuns) return <SprintTestRunsSummary summary={metrics.testRuns} workingDays={workingDays} />
  return (
    <ChartCard title="Execuções de testes na sprint">
      <RequestState
        loading={testRuns.loading}
        error={testRuns.error}
        empty
        emptyMessage="Sem dados de test runs."
        loadingMessage="Buscando test runs…"
        onRetry={testRuns.reload}
      />
    </ChartCard>
  )
}

function SprintAnalysisContent() {
  const { config } = useAzureConfig()
  const { projectId, team, iteration, workItems, members, workingDays, localSquad, localSprint, metrics, loading, refresh, saveToBase, updateSprintDays, toggleHidden } =
    useSprintAnalysis()
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [showAllocation, setShowAllocation] = usePersistedState('sprint-analysis-show-allocation', false)
  const [onlyAllocated, setOnlyAllocated] = usePersistedState('sprint-analysis-only-allocated', false)

  // "Somente pessoas alocadas": as visões por pessoa passam a partir da Alocação da squad/sprint local —
  // inclusive quem está alocado mas não é membro do team no Azure ou não tem SP na sprint (aparece com 0).
  const hasAllocation = metrics.sprintAllocation.entries.length > 0
  const filterAllocated = onlyAllocated && hasAllocation
  const allocatedPoints = useMemo<PersonPoints[]>(
    () =>
      metrics.sprintAllocation.entries
        .map(
          (entry) =>
            (entry.email && metrics.byPerson.find((p) => normalizeKey(p.email) === normalizeKey(entry.email))) || {
              name: entry.name,
              email: entry.email,
              storyPoints: 0,
              deliveredPoints: 0,
              itemCount: 0,
            },
        )
        .sort((a, b) => b.storyPoints - a.storyPoints || a.name.localeCompare(b.name)),
    [metrics.sprintAllocation, metrics.byPerson],
  )
  const byPerson = filterAllocated ? allocatedPoints : metrics.byPerson
  const allocationRows = filterAllocated ? metrics.allocation.filter((row) => row.percentage !== null) : metrics.allocation
  const unassigned = filterAllocated ? { ...metrics.unassigned, storyPoints: 0, itemCount: 0 } : metrics.unassigned

  const backHref = `/azure/${encodeURIComponent(projectId)}${team ? `?team=${encodeURIComponent(team.id)}` : ''}`

  return (
    <div className="flex flex-col gap-4">
      <SprintHeader
        title={iteration?.name ?? 'Sprint'}
        startDate={iteration?.attributes.startDate}
        finishDate={iteration?.attributes.finishDate}
        workingDaysCount={workingDays.length}
        validDays={localSprint?.totalValidDays ?? DEFAULT_TOTAL_VALID_DAYS}
        onValidDaysChange={(days) => {
          const outcome = updateSprintDays(days)
          setSyncMessage(outcome.ok ? `Dias válidos da sprint: ${outcome.result.totalValidDays}.` : outcome.reason)
        }}
        backHref={backHref}
        backLabel={team ? `Sprints de ${team.name}` : 'Sprints'}
        loading={loading}
        canSave={Boolean(workItems.data && members.data)}
        onRefresh={refresh}
        onSave={() => setSyncMessage(describeSync(saveToBase()))}
      />
      {syncMessage && (
        <p role="status" className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-h)]">
          {syncMessage}
        </p>
      )}

      <RequestState
        loading={loading}
        error={workItems.error ?? members.error}
        empty={!workItems.data}
        emptyMessage="Sprint não encontrada neste team."
        loadingMessage="Buscando work items da sprint…"
        onRetry={refresh}
      >
        <SprintKpis metrics={metrics} workItemsCount={workItems.data?.length ?? 0} membersCount={members.data?.length ?? 0} />

        <div className="flex flex-wrap items-center gap-4">
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowAllocation(!showAllocation)}>
            {showAllocation ? 'Ocultar alocação da sprint' : 'Ver alocação da sprint'}
          </Button>
          <label
            className="flex items-center gap-2 text-sm text-[var(--text-h)]"
            title={hasAllocation ? undefined : 'Nenhuma pessoa alocada nesta squad/sprint na base local.'}
          >
            <Checkbox
              checked={filterAllocated}
              disabled={!hasAllocation}
              onChange={(e) => setOnlyAllocated(e.target.checked)}
            />
            Somente pessoas alocadas na sprint
          </label>
        </div>

        {showAllocation && (
          <SprintAllocationView
            summary={metrics.sprintAllocation}
            totalPoints={metrics.totalPoints}
            localSquadName={localSquad?.name}
            localSprintLabel={localSprint ? formatSprintLabel(localSprint) : undefined}
          />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SprintPointsByPerson people={byPerson} unassigned={unassigned} totalPoints={metrics.totalPoints} />
          <SprintPointsByStateChart byState={metrics.byState} />
          <div className="lg:col-span-2">
            <SprintBurnupChart points={metrics.burnup} />
          </div>
          <div className="lg:col-span-2">
            <SprintPointsByTypeChart byType={metrics.byType} userStories={metrics.userStories} onToggleHidden={toggleHidden} />
          </div>
          <div className="lg:col-span-2">
            <SprintAllocationComparison
              rows={allocationRows}
              totalPoints={metrics.totalPoints}
              qaMinPercent={config.qaMinPercent}
              qaMaxPercent={config.qaMaxPercent}
              localSquadName={localSquad?.name}
              localSprintLabel={localSprint ? formatSprintLabel(localSprint) : undefined}
            />
          </div>
          <div className="lg:col-span-2">
            <TestRunsSection />
          </div>
        </div>
      </RequestState>
    </div>
  )
}

export function SprintAnalysisPage() {
  return (
    <SprintAnalysisProvider>
      <SprintAnalysisContent />
    </SprintAnalysisProvider>
  )
}
