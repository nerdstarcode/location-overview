import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HeartHandshake } from 'lucide-react'
import { Chip } from '../../components/atoms/Chip/Chip'
import { Select } from '../../components/atoms/Select/Select'
import { SegmentedControl } from '../../components/molecules/SegmentedControl/SegmentedControl'
import { PersonDevDashboard } from '../../components/organisms/PersonDevDashboard/PersonDevDashboard'
import { PersonQaDashboard } from '../../components/organisms/PersonQaDashboard/PersonQaDashboard'
import { WorkItemDetailsModal } from '../../components/organisms/WorkItemDetailsModal/WorkItemDetailsModal'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'
import type { CargoTipo } from '../../lib/cargosStorage'
import type { Person } from '../../lib/peopleStorage'
import { computePersonDevMetrics, computePersonQaMetrics, delayInfo, peerAveragePerSprint, type DelayInfo } from '../../lib/personMetrics'
import { canShowQaPersonMetrics } from '../../lib/featureFlags'
import { devLoadBySprint, personSupportView, qaLoadBySprint, type LoadBySprint } from '../../lib/supportMetrics'
import { itemTimelines } from '../../lib/stateFlow'
import { isPointItem } from '../../lib/azure/sprintMetrics'
import { formatSprintLabel } from '../../lib/sprintsStorage'
import { itemExecutions } from '../../lib/testExecutionsPerPoint'
import type { WorkItemRow } from '../../lib/workItems'
import { loadPersonDashboardBase, usePersonDashboardFilters } from './personDashboardBase'
import { PersonDashboardFilterBar } from './PersonDashboardFilterBar'

type Role = 'dev' | 'qa'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'dev', label: 'Dev' },
  { value: 'qa', label: 'QA' },
]

// Dashboard por Pessoa (`/dashboard/pessoa/:personId`): entrega como dev (story points)
// ou execução de testes como QA, por sprint, com os itens atrasados detalhados.
export function PersonDashboardPage() {
  const { personId } = useParams()
  const navigate = useNavigate()
  const { config } = useAzureConfig()
  const [base] = useState(loadPersonDashboardBase)
  const filters = usePersonDashboardFilters(base)
  const { metricsFilters, mode } = filters
  const [roleOverride, setRoleOverride] = useState<{ personId: string; role: Role } | null>(null)
  const [openItem, setOpenItem] = useState<{ row: WorkItemRow; delay: DelayInfo } | null>(null)

  const person = base.people.find((p) => p.id === personId)
  const tipoOf = (p: Person): CargoTipo | undefined => base.cargos.find((c) => c.cargo === p.cargo)?.tipo
  const isQaPerson = person !== undefined && tipoOf(person) === 'QA'
  // Fora de localhost a visão QA não existe: fica sempre em Dev.
  const qaEnabled = canShowQaPersonMetrics()
  const defaultRole: Role = qaEnabled && isQaPerson ? 'qa' : 'dev'
  const role = qaEnabled && roleOverride && roleOverride.personId === person?.id ? roleOverride.role : defaultRole

  const metricsInput = person && { ...base, person, ...metricsFilters }

  const devMetrics = useMemo(
    () => (metricsInput && role === 'dev' ? computePersonDevMetrics({ ...metricsInput, mode, pointTypes: config.pointTypes }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [person, base, metricsFilters, role, mode, config.pointTypes],
  )

  // Comparação com quem tem o mesmo tipo de cargo e divide alguma squad com a pessoa.
  const peerAverage = useMemo(() => {
    if (!person || role !== 'dev') return 0
    const tipo = tipoOf(person)
    const peers = base.people.filter(
      (p) => p.id !== person.id && tipoOf(p) === tipo && p.squadIds.some((id) => person.squadIds.includes(id)),
    )
    return peerAveragePerSprint({ ...base, ...metricsFilters, peers, mode, pointTypes: config.pointTypes })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, base, metricsFilters, role, mode, config.pointTypes])

  const qaMetrics = useMemo(
    () => (metricsInput && role === 'qa' ? computePersonQaMetrics(metricsInput) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [person, base, metricsFilters, role],
  )

  // Apoio (mentoria): a carga de cada apoiado vem da mesma visão (SP ou Test Points), nas mesmas
  // sprints, mas sem o filtro de squad, porque o apoio é por sprint.
  const support = useMemo(() => {
    if (!person) return null
    const supportedFilters = { ...metricsFilters, selectedSquads: [], onlyAllocatedSprints: false }
    const cache = new Map<string, LoadBySprint>()
    const loadOf = (personId: string): LoadBySprint => {
      const supported = base.people.find((p) => p.id === personId)
      if (!supported) return new Map()
      if (!cache.has(personId)) {
        const input = { ...base, ...supportedFilters, person: supported }
        cache.set(
          personId,
          role === 'dev'
            ? devLoadBySprint(computePersonDevMetrics({ ...input, mode, pointTypes: config.pointTypes }))
            : qaLoadBySprint(computePersonQaMetrics(input)),
        )
      }
      return cache.get(personId)!
    }
    const common = { personId: person.id, supports: base.supports, sprints: base.sprints, context: base, loadOf }
    if (devMetrics) return personSupportView({ ...common, metricsSprints: devMetrics.sprints, loadOfSprint: (s) => s.onTime + s.delayed + s.inProgress + s.inProgressDelayed })
    if (qaMetrics) return personSupportView({ ...common, metricsSprints: qaMetrics.sprints, loadOfSprint: (s) => s.testPoints })
    return null
  }, [person, base, metricsFilters, role, mode, config.pointTypes, devMetrics, qaMetrics])

  // Evolução dos itens da pessoa (os mesmos dos cards: atribuídos a ela nas sprints do filtro).
  const timelines = useMemo(() => itemTimelines((devMetrics ?? qaMetrics)?.items.map((item) => item.row) ?? []), [devMetrics, qaMetrics])

  // QA: itens de pontos em que a pessoa executou algum Test Case ligado (Tested By), com as execuções
  // feitas nas sprints do filtro (pela data de execução).
  const testExecutions = useMemo(() => {
    if (!qaMetrics || !person) return undefined
    const labels = new Set(qaMetrics.sprints.map((s) => s.label))
    const sprintsById = new Map(base.sprints.map((sprint) => [sprint.id, formatSprintLabel(sprint)]))
    const runs = base.testCaseExecutions.flatMap((run) => {
      const label = sprintsById.get(run.sprintId)
      return label && labels.has(label) ? [{ ...run, sprintLabel: label }] : []
    })
    const rows = base.rows.filter((row) => isPointItem(row, config.pointTypes))
    return itemExecutions(rows, runs, person.email, base.rows).filter((item) => item.executions > 0)
  }, [qaMetrics, person, base, config.pointTypes])

  // Dev: qualidade dos itens da pessoa (os mesmos dos cards), com os resultados de todos os testers
  // dos Test Cases ligados a eles e às Tasks filhas, nas sprints do filtro.
  const devTestResults = useMemo(() => {
    if (!devMetrics) return undefined
    const labels = new Set(devMetrics.sprints.map((s) => s.label))
    const sprintsById = new Map(base.sprints.map((sprint) => [sprint.id, formatSprintLabel(sprint)]))
    const runs = base.testCaseExecutions.flatMap((run) => {
      const label = sprintsById.get(run.sprintId)
      return label && labels.has(label) ? [{ ...run, sprintLabel: label }] : []
    })
    const rows = [...new Map(devMetrics.items.map((item) => [item.row.id, item.row])).values()]
    return itemExecutions(rows, runs, undefined, base.rows).filter((item) => item.executions > 0)
  }, [devMetrics, base])

  function openRow(row: WorkItemRow) {
    setOpenItem({ row, delay: delayInfo(row, new Map(base.sprints.map((sprint) => [formatSprintLabel(sprint), sprint]))) })
  }

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
        leading={
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
        }
        trailing={
          person &&
          qaEnabled && (
            <SegmentedControl
              aria-label="Visão"
              options={ROLE_OPTIONS}
              value={role}
              onChange={(next) => setRoleOverride({ personId: person.id, role: next })}
            />
          )
        }
      />

      {isQaPerson && !qaEnabled && (
        <p role="status" className="rounded-md border border-[var(--border)] bg-[var(--code-bg)] p-3 text-sm text-[var(--text-h)]">
          As métricas individuais de QA (testes executados) ainda estão em validação e não estão disponíveis aqui. Abaixo,
          a visão de story points.
        </p>
      )}

      {!person && (
        <p className="rounded-md border border-[var(--border)] p-10 text-center text-sm text-[var(--text)]">
          Selecione uma pessoa para ver as entregas dela.
        </p>
      )}

      {support && support.receivedFrom.length > 0 && (
        <p role="note" className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--code-bg)] px-3 py-2 text-sm text-[var(--text-h)]">
          <HeartHandshake size={16} aria-hidden="true" />
          Apoiado por
          {support.receivedFrom.map((s) => (
            <Chip key={`${s.personId}-${s.sprintLabel}`} label={`${s.nome} (${s.percentage}%) · ${s.sprintLabel}`} />
          ))}
        </p>
      )}

      {devMetrics && (
        <PersonDevDashboard
          metrics={devMetrics}
          support={support}
          timelines={timelines}
          sprints={base.sprints}
          testResults={devTestResults}
          onOpenWorkItem={openRow}
          peerAverage={peerAverage}
          mode={mode}
          onModeChange={filters.setMode}
          onOpenItem={(item) => setOpenItem({ row: item.row, delay: item.delay })}
        />
      )}
      {qaMetrics && <PersonQaDashboard metrics={qaMetrics} support={support} timelines={timelines} sprints={base.sprints} testExecutions={testExecutions} onOpenWorkItem={openRow} onOpenItem={(item) => setOpenItem({ row: item.row, delay: item.delay })} />}

      <WorkItemDetailsModal row={openItem?.row ?? null} delay={openItem?.delay} allRows={base.rows} onClose={() => setOpenItem(null)} />
    </div>
  )
}
