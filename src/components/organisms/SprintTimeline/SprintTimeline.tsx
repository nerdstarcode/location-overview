import clsx from 'clsx'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { LoadStatusChip } from '../../molecules/LoadStatusChip/LoadStatusChip'
import { SegmentedControl } from '../../molecules/SegmentedControl/SegmentedControl'
import { Button } from '../../atoms/Button/Button'
import type { SprintPlanTotals } from '../../../lib/sprintPlanning'
import { formatSprintLabel, SPRINT_PHASE_LABEL, type Sprint, type SprintPhase } from '../../../lib/sprintsStorage'

export type SprintPhaseFilter = 'active' | 'all' | 'closed'

const PHASE_FILTER_OPTIONS: { value: SprintPhaseFilter; label: string }[] = [
  { value: 'active', label: 'Atual + abertas' },
  { value: 'closed', label: 'Fechadas' },
  { value: 'all', label: 'Todas' },
]

const PHASE_CLASSES: Record<SprintPhase, string> = {
  closed: 'bg-[var(--code-bg)] text-[var(--text)]',
  current: 'bg-blue-500 text-white',
  open: 'border border-blue-500/60 text-[var(--text-h)]',
}

export interface SprintTimelineRow {
  sprint: Sprint
  phase: SprintPhase
  plan: SprintPlanTotals & { squads: number }
}

export interface SprintTimelineProps {
  rows: SprintTimelineRow[]
  phaseFilter: SprintPhaseFilter
  onPhaseFilterChange: (filter: SprintPhaseFilter) => void
  onOpen: (sprint: Sprint) => void
  onCreate: () => void
  onEdit: (sprint: Sprint) => void
  onDelete: (sprint: Sprint) => void
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function SprintPhaseChip({ phase }: { phase: SprintPhase }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', PHASE_CLASSES[phase])}>
      {SPRINT_PHASE_LABEL[phase]}
    </span>
  )
}

// Linha do tempo das sprints em ordem, com a situação (fechada, atual ou aberta) e o planejado
// das squads × o previsto da Alocação. Clicar numa sprint abre a alocação por squad.
export function SprintTimeline({ rows, phaseFilter, onPhaseFilterChange, onOpen, onCreate, onEdit, onDelete }: SprintTimelineProps) {
  const visible = rows.filter((row) =>
    phaseFilter === 'all' ? true : phaseFilter === 'closed' ? row.phase === 'closed' : row.phase !== 'closed',
  )
  // Fechadas: da mais recente para a mais antiga; as demais em ordem cronológica (a atual primeiro).
  const ordered = phaseFilter === 'closed' ? [...visible].reverse() : visible

  const columns: ColumnDef<SprintTimelineRow, unknown>[] = [
    {
      id: 'sprint',
      header: 'Sprint',
      cell: ({ row }) => <span className="font-medium text-[var(--text-h)]">{formatSprintLabel(row.original.sprint)}</span>,
      meta: { searchValue: (row: SprintTimelineRow) => formatSprintLabel(row.sprint) },
    },
    {
      id: 'phase',
      header: 'Situação',
      cell: ({ row }) => <SprintPhaseChip phase={row.original.phase} />,
      meta: { searchValue: (row: SprintTimelineRow) => SPRINT_PHASE_LABEL[row.phase] },
    },
    {
      id: 'dates',
      header: 'Período',
      cell: ({ row }) => `${formatDate(row.original.sprint.startDate)} – ${formatDate(row.original.sprint.endDate)}`,
    },
    { id: 'days', header: 'Dias válidos', cell: ({ row }) => row.original.sprint.totalValidDays, meta: { align: 'right', numeric: true } },
    { id: 'squads', header: 'Squads alocadas', cell: ({ row }) => row.original.plan.squads, meta: { align: 'right', numeric: true } },
    { id: 'people', header: 'Pessoas', cell: ({ row }) => row.original.plan.people, meta: { align: 'right', numeric: true } },
    {
      id: 'capacity',
      header: 'Previsto / Máximo',
      cell: ({ row }) => (row.original.plan.squads > 0 ? `${row.original.plan.capacity} / ${row.original.plan.max}` : '—'),
      meta: { align: 'right', numeric: true },
    },
    { id: 'planned', header: 'SP planejados', cell: ({ row }) => row.original.plan.plannedPoints, meta: { align: 'right', numeric: true } },
    { id: 'status', header: 'Planejado × previsto', cell: ({ row }) => <LoadStatusChip status={row.original.plan.status} /> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => onEdit(row.original.sprint)}
            aria-label={`Editar ${formatSprintLabel(row.original.sprint)}`}
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(row.original.sprint)}
            aria-label={`Excluir ${formatSprintLabel(row.original.sprint)}`}
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-brand-action-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text)]">
          Sprints em ordem. Clique numa sprint para definir a alocação de cada squad e ver se os pontos planejados
          estão abaixo, no esperado ou acima do previsto.
        </p>
        <Button type="button" onClick={onCreate}>
          <Plus size={14} /> Nova sprint
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={ordered}
        getRowId={(row) => row.sprint.id}
        onRowClick={(row) => onOpen(row.sprint)}
        getRowClassName={(row) => (row.phase === 'current' ? 'bg-blue-500/5' : row.phase === 'closed' ? 'opacity-80' : undefined)}
        emptyMessage={rows.length === 0 ? 'Nenhuma sprint cadastrada.' : 'Nenhuma sprint nesta situação.'}
        pageResetKey={phaseFilter}
        toolbar={
          <SegmentedControl aria-label="Situação das sprints" options={PHASE_FILTER_OPTIONS} value={phaseFilter} onChange={onPhaseFilterChange} />
        }
      />
    </div>
  )
}
