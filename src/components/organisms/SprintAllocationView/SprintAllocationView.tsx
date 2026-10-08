import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { DataTable } from '../DataTable/DataTable'
import type { SprintAllocationEntry, SprintAllocationSummary } from '../../../lib/azure/sprintMetrics'

export interface SprintAllocationViewProps {
  summary: SprintAllocationSummary
  totalPoints: number
  /** Nome da squad/sprint locais — undefined quando ainda não existem na base. */
  localSquadName?: string
  localSprintLabel?: string
}

const NUMERIC = { align: 'right', numeric: true } as const

const COLUMNS: ColumnDef<SprintAllocationEntry, unknown>[] = [
  { accessorKey: 'name', header: 'Pessoa' },
  { accessorKey: 'cargo', header: 'Cargo' },
  {
    accessorKey: 'nivel',
    header: 'Nível',
    cell: ({ row }) =>
      row.original.missingLevel ? (
        <span className="inline-flex items-center gap-1 text-[var(--text-h)]" title="Sem nível cadastrado: conta 0 em Capacity/Max.">
          <AlertTriangle size={14} className="text-brand-action-warning" />
          {row.original.nivel || 'sem nível'}
        </span>
      ) : (
        row.original.nivel
      ),
  },
  { id: 'percentage', header: '%', accessorFn: (row) => row.percentage, cell: ({ row }) => `${row.original.percentage}%`, meta: NUMERIC },
  { accessorKey: 'days', header: 'Dias', meta: NUMERIC },
  { accessorKey: 'capacity', header: 'Capacity', meta: NUMERIC },
  { accessorKey: 'max', header: 'Max', meta: NUMERIC },
  { accessorKey: 'assigned', header: 'SP atribuídos', meta: NUMERIC },
  { accessorKey: 'delivered', header: 'SP entregues', meta: NUMERIC },
]

// Alocação cadastrada na ferramenta de Alocação (tela de Squads) para a
// squad/sprint local correspondente a esta sprint do Azure.
export function SprintAllocationView({ summary, totalPoints, localSquadName, localSprintLabel }: SprintAllocationViewProps) {
  const missingBase = !localSquadName || !localSprintLabel
  const overMax = summary.entries.length > 0 && totalPoints > summary.max

  return (
    <ChartCard
      title="Alocação da sprint"
      description={
        missingBase
          ? undefined
          : `Squad ${localSquadName} · ${localSprintLabel} · Capacity ${summary.capacity} · Max ${summary.max} · ${totalPoints} SP na sprint`
      }
      actions={
        <Link to="/squads" className="text-xs text-[var(--text)] underline hover:text-[var(--text-h)]">
          Editar na tela de Squads
        </Link>
      }
    >
      {overMax && (
        <p className="mb-3 flex items-center gap-2 rounded-md bg-brand-action-warning/15 p-3 text-sm text-[var(--text-h)]">
          <AlertTriangle size={16} className="shrink-0 text-brand-action-warning" />
          Os Story Points da sprint ({totalPoints}) passam do Max da alocação ({summary.max}).
        </p>
      )}
      <DataTable
        data={summary.entries}
        columns={COLUMNS}
        getRowId={(row) => row.personId}
        emptyMessage={
          missingBase
            ? `${!localSquadName ? 'Squad' : 'Sprint'} ainda não existe na base local — use “Atualizar base”.`
            : 'Nenhuma pessoa alocada nesta squad/sprint.'
        }
      />
    </ChartCard>
  )
}
