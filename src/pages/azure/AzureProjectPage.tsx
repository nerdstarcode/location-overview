import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from '../../components/atoms/Select/Select'
import { Button } from '../../components/atoms/Button/Button'
import { Chip } from '../../components/atoms/Chip/Chip'
import { RequestState } from '../../components/molecules/RequestState/RequestState'
import { ChartCard } from '../../components/molecules/ChartCard/ChartCard'
import { IterationsList } from '../../components/organisms/IterationsList/IterationsList'
import { useAzureProject } from '../../contexts/azure/AzureProjectContext'
import type { IterationSyncProgress } from '../../lib/azure/syncToBase'
import type { AzureIteration } from '../../lib/azure/types'

function batchSummary(progress: IterationSyncProgress): string {
  const entries = Object.values(progress)
  let ok = 0
  let errors = 0
  let workItems = 0
  let testReports = 0
  for (const entry of entries) {
    if (entry.status === 'error') errors += 1
    if (entry.status !== 'done') continue
    ok += 1
    workItems += entry.result.workItems
    if (entry.result.testReport) testReports += 1
  }
  return (
    `${entries.length} sprint(s): ${ok} sincronizada(s) · ${errors} com erro · ` +
    `${workItems} work item(s) · ${testReports} relatório(s) de teste.`
  )
}

function batchProgressMessage(progress: IterationSyncProgress): string {
  const entries = Object.values(progress)
  const finished = entries.filter((entry) => entry.status === 'done' || entry.status === 'error').length
  return `Sincronizando ${Math.min(finished + 1, entries.length)} de ${entries.length}…`
}

// Projeto → escolha do Team (squad) → sprints do team. Daqui abre a análise de uma sprint
// e dá para gravar squad, pessoas e sprints do team na base local — inclusive, em lote,
// os work items e test runs das sprints selecionadas.
export function AzureProjectPage() {
  const {
    teams,
    selectedTeam,
    selectTeam,
    members,
    iterations,
    syncTeam,
    iterationsSync,
    syncIterations,
    cancelIterationsSync,
  } = useAzureProject()
  const navigate = useNavigate()
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const batchRunning = iterationsSync?.running ?? false

  function handleSync() {
    const outcome = syncTeam()
    if (!outcome.ok) {
      setSyncMessage(outcome.reason)
      return
    }
    const { squadCreated, peopleCreated, peopleLinked, sprintsSynced } = outcome.result
    setSyncMessage(
      `Squad ${squadCreated ? 'criada' : 'já existia'} · ${peopleCreated} pessoa(s) nova(s) · ` +
        `${peopleLinked} vinculada(s) à squad · ${sprintsSynced} sprint(s) atualizada(s).`,
    )
  }

  async function handleSyncIterations() {
    setBatchMessage(null)
    const outcome = await syncIterations([...selectedIds])
    setBatchMessage(outcome.ok ? batchSummary(outcome.result) : outcome.reason)
  }

  function toggleIteration(iteration: AzureIteration) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(iteration.id)) next.delete(iteration.id)
      else next.add(iteration.id)
      return next
    })
  }

  function togglePage(pageIterations: AzureIteration[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = pageIterations.every((it) => prev.has(it.id))
      for (const it of pageIterations) {
        if (allSelected) next.delete(it.id)
        else next.add(it.id)
      }
      return next
    })
  }

  function openIteration(iteration: AzureIteration) {
    if (selectedTeam) navigate(`${encodeURIComponent(selectedTeam.id)}/${encodeURIComponent(iteration.id)}`)
  }

  return (
    <RequestState
      loading={teams.loading}
      error={teams.error}
      empty={!teams.data || teams.data.length === 0}
      emptyMessage="Nenhum team (squad) neste projeto."
      loadingMessage="Carregando teams…"
      onRetry={teams.reload}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-full max-w-sm flex-col gap-1 text-sm font-medium text-[var(--text-h)]">
            Squad (Team)
            <Select
              disableClearable
              value={selectedTeam?.id ?? ''}
              onChange={(value) => {
                selectTeam(value)
                setSyncMessage(null)
                setSelectedIds(new Set())
                setBatchMessage(null)
              }}
              options={(teams.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
            />
          </label>
          <Button type="button" onClick={handleSync} disabled={!members.data || !iterations.data}>
            Sincronizar squad, pessoas e sprints
          </Button>
        </div>
        {syncMessage && (
          <p role="status" className="text-sm text-[var(--text-h)]">
            {syncMessage}
          </p>
        )}

        <ChartCard title={`Pessoas na squad${members.data ? ` (${members.data.length})` : ''}`}>
          <RequestState
            loading={members.loading}
            error={members.error}
            empty={!members.data || members.data.length === 0}
            emptyMessage="Nenhum membro neste team."
            onRetry={members.reload}
          >
            <div className="flex flex-wrap gap-1.5">
              {(members.data ?? []).map((member) => (
                <Chip key={member.identity.id} label={member.identity.displayName} />
              ))}
            </div>
          </RequestState>
        </ChartCard>

        <ChartCard
          title="Sprints"
          description="Clique numa sprint para ver a análise, ou selecione várias para buscar work items e testes de todas em sequência."
        >
          <RequestState
            loading={iterations.loading}
            error={iterations.error}
            empty={!iterations.data}
            loadingMessage="Carregando sprints…"
            onRetry={iterations.reload}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleSyncIterations}
                  disabled={selectedIds.size === 0 || batchRunning || !members.data || !iterations.data}
                >
                  Sincronizar sprints selecionadas ({selectedIds.size})
                </Button>
                {batchRunning && (
                  <Button type="button" variant="secondary" onClick={cancelIterationsSync}>
                    Cancelar
                  </Button>
                )}
                {(batchRunning || batchMessage) && (
                  <p role="status" className="text-sm text-[var(--text-h)]">
                    {batchRunning && iterationsSync ? batchProgressMessage(iterationsSync.progress) : batchMessage}
                  </p>
                )}
              </div>
              <IterationsList
                iterations={iterations.data ?? []}
                onOpen={openIteration}
                selectedIds={selectedIds}
                onToggleRow={toggleIteration}
                onTogglePage={togglePage}
                syncStatus={iterationsSync?.progress}
              />
            </div>
          </RequestState>
        </ChartCard>
      </div>
    </RequestState>
  )
}
