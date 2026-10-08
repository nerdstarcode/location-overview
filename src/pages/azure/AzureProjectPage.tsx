import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select } from '../../components/atoms/Select/Select'
import { Button } from '../../components/atoms/Button/Button'
import { Chip } from '../../components/atoms/Chip/Chip'
import { RequestState } from '../../components/molecules/RequestState/RequestState'
import { ChartCard } from '../../components/molecules/ChartCard/ChartCard'
import { IterationsList } from '../../components/organisms/IterationsList/IterationsList'
import { useAzureProject } from '../../contexts/azure/AzureProjectContext'
import type { AzureIteration } from '../../lib/azure/types'

// Projeto → escolha do Team (squad) → sprints do team. Daqui abre a análise de uma sprint
// e dá para gravar squad, pessoas e sprints do team na base local.
export function AzureProjectPage() {
  const { teams, selectedTeam, selectTeam, members, iterations, syncTeam } = useAzureProject()
  const navigate = useNavigate()
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

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
              value={selectedTeam?.id ?? ''}
              onChange={(e) => {
                selectTeam(e.target.value)
                setSyncMessage(null)
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

        <ChartCard title="Sprints" description="Clique numa sprint para ver a análise e atualizar a base de work items.">
          <RequestState
            loading={iterations.loading}
            error={iterations.error}
            empty={!iterations.data}
            loadingMessage="Carregando sprints…"
            onRetry={iterations.reload}
          >
            <IterationsList
              iterations={iterations.data ?? []}
              onOpen={openIteration}
            />
          </RequestState>
        </ChartCard>
      </div>
    </RequestState>
  )
}
