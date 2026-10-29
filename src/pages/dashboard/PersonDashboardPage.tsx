import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Select } from '../../components/atoms/Select/Select'
import { MultiSelectFilter } from '../../components/molecules/MultiSelectFilter/MultiSelectFilter'
import { SegmentedControl } from '../../components/molecules/SegmentedControl/SegmentedControl'
import { PersonDevDashboard } from '../../components/organisms/PersonDevDashboard/PersonDevDashboard'
import { PersonQaDashboard } from '../../components/organisms/PersonQaDashboard/PersonQaDashboard'
import { WorkItemDetailsModal } from '../../components/organisms/WorkItemDetailsModal/WorkItemDetailsModal'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'
import { usePersistedState } from '../../hooks/usePersistedState'
import { loadCargos, type CargoTipo } from '../../lib/cargosStorage'
import { loadLevels } from '../../lib/levelsStorage'
import { loadPeople, type Person } from '../../lib/peopleStorage'
import { loadPersonAllocations } from '../../lib/personAllocationsStorage'
import {
  compareSprintLabels,
  computePersonDevMetrics,
  computePersonQaMetrics,
  plannedSprintLabel,
  peerAveragePerSprint,
  type DelayInfo,
  type DevAttribution,
} from '../../lib/personMetrics'
import { formatSprintLabel, loadSprints } from '../../lib/sprintsStorage'
import { loadSquads } from '../../lib/squadsStorage'
import { loadTestExecutions } from '../../lib/testExecutionsStorage'
import type { WorkItemRow } from '../../lib/workItems'
import { loadWorkItems } from '../../lib/workItemsStorage'

type Role = 'dev' | 'qa'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'qa', label: 'QA' },
]

function loadBase() {
  return {
    people: loadPeople(),
    rows: loadWorkItems(),
    sprints: loadSprints(),
    allocations: loadPersonAllocations(),
    levels: loadLevels(),
    cargos: loadCargos(),
    executions: loadTestExecutions(),
    squads: loadSquads(),
  }
}

// Dashboard por Pessoa (`/dashboard/pessoa/:personId`): entrega como dev (story points)
// ou execução de testes como QA, por sprint, com os itens atrasados detalhados.
export function PersonDashboardPage() {
  const { personId } = useParams()
  const navigate = useNavigate()
  const { config } = useAzureConfig()
  const [base] = useState(loadBase)
  const [mode, setMode] = usePersistedState<DevAttribution>('person-dashboard-dev-mode', 'assigned')
  const [selectedSprints, setSelectedSprints] = usePersistedState<string[]>('person-dashboard-sprints', [])
  const [roleOverride, setRoleOverride] = useState<{ personId: string; role: Role } | null>(null)
  const [openItem, setOpenItem] = useState<{ row: WorkItemRow; delay: DelayInfo } | null>(null)

  const person = base.people.find((p) => p.id === personId)
  const tipoOf = (p: Person): CargoTipo | undefined => base.cargos.find((c) => c.cargo === p.cargo)?.tipo
  const defaultRole: Role = person && tipoOf(person) === 'QA' ? 'qa' : 'dev'
  const role = roleOverride && roleOverride.personId === person?.id ? roleOverride.role : defaultRole

  const sprintOptions = useMemo(() => {
    const labels = new Set([...base.sprints.map(formatSprintLabel), ...base.rows.map(plannedSprintLabel)])
    labels.delete('')
    return [...labels].sort((a, b) => compareSprintLabels(b, a))
  }, [base])

  const metricsInput = person && { ...base, person, selectedSprints }

  const devMetrics = useMemo(
    () => (metricsInput && role === 'dev' ? computePersonDevMetrics({ ...metricsInput, mode, pointTypes: config.pointTypes }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [person, base, selectedSprints, role, mode, config.pointTypes],
  )

  // Comparação com quem tem o mesmo tipo de cargo e divide alguma squad com a pessoa.
  const peerAverage = useMemo(() => {
    if (!person || role !== 'dev') return 0
    const tipo = tipoOf(person)
    const peers = base.people.filter(
      (p) => p.id !== person.id && tipoOf(p) === tipo && p.squadIds.some((id) => person.squadIds.includes(id)),
    )
    return peerAveragePerSprint({ ...base, selectedSprints, peers, mode, pointTypes: config.pointTypes })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, base, selectedSprints, role, mode, config.pointTypes])

  const qaMetrics = useMemo(
    () => (metricsInput && role === 'qa' ? computePersonQaMetrics(metricsInput) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [person, base, selectedSprints, role],
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-full max-w-sm flex-col gap-1 text-sm font-medium text-[var(--text-h)]">
          Pessoa
          <Select
            value={person?.id ?? ''}
            placeholder="Selecione uma pessoa"
            onChange={(value) => navigate(`/dashboard/pessoa/${encodeURIComponent(value)}`)}
            options={[...base.people]
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((p) => ({ value: p.id, label: p.cargo ? `${p.nome} · ${p.cargo}` : p.nome }))}
          />
        </label>
        <MultiSelectFilter label="Sprint" options={sprintOptions} selected={selectedSprints} onChange={setSelectedSprints} />
        {person && (
          <SegmentedControl
            aria-label="Visão"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(next) => setRoleOverride({ personId: person.id, role: next })}
          />
        )}
      </div>

      {!person && (
        <p className="rounded-md border border-[var(--border)] p-10 text-center text-sm text-[var(--text)]">
          Selecione uma pessoa para ver as entregas dela.
        </p>
      )}

      {devMetrics && (
        <PersonDevDashboard
          metrics={devMetrics}
          peerAverage={peerAverage}
          mode={mode}
          onModeChange={setMode}
          onOpenItem={(item) => setOpenItem({ row: item.row, delay: item.delay })}
        />
      )}
      {qaMetrics && <PersonQaDashboard metrics={qaMetrics} onOpenItem={(item) => setOpenItem({ row: item.row, delay: item.delay })} />}

      <WorkItemDetailsModal row={openItem?.row ?? null} delay={openItem?.delay} allRows={base.rows} onClose={() => setOpenItem(null)} />
    </div>
  )
}
