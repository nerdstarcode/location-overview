import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { formatDateBR } from '../../../lib/dates'
import { formatDuration, type ItemFlow } from '../../../lib/stateFlow'
import type { WorkItemRow } from '../../../lib/workItems'

export interface StateFlowTableProps {
  items: ItemFlow[]
  onOpenItem?: (row: WorkItemRow) => void
}

/** Tempo útil (horas abaixo de 1 dia), ou "—" quando o item não chegou ao marco. */
const daysColumn = (id: string, header: string, pick: (flow: ItemFlow) => number | null): ColumnDef<ItemFlow, unknown> => ({
  id,
  header,
  accessorFn: (flow) => pick(flow) ?? Number.POSITIVE_INFINITY,
  cell: ({ row }) => formatDuration(pick(row.original)),
  meta: { align: 'right', numeric: true, searchValue: (flow: ItemFlow) => formatDuration(pick(flow)) },
})

const COLUMNS: ColumnDef<ItemFlow, unknown>[] = [
  { id: 'id', header: 'ID', accessorFn: (flow) => flow.row.id, meta: { align: 'right', headerAlign: 'left', numeric: true } },
  { id: 'title', header: 'Título', accessorFn: (flow) => flow.row.title },
  { id: 'state', header: 'Estado', accessorFn: (flow) => flow.row.state },
  {
    id: 'activeAt',
    header: 'Active em',
    accessorFn: (flow) => flow.activeAt ?? '',
    cell: ({ row }) => formatDateBR(row.original.activeAt),
    meta: { searchValue: (flow: ItemFlow) => formatDateBR(flow.activeAt) },
  },
  daysColumn('sprintToActive', 'Início → Active', (flow) => flow.sprintToActive),
  daysColumn('testingQa', '→ Testing QA', (flow) => flow.toMilestone.testingQa),
  daysColumn('mrProd', '→ MR Prod', (flow) => flow.toMilestone.mrProd),
  daysColumn('testingProd', '→ Testing Prod', (flow) => flow.toMilestone.testingProd),
  daysColumn('done', '→ Done', (flow) => flow.toMilestone.done),
  daysColumn('onHold', 'On Hold', (flow) => flow.onHoldDays),
  { id: 'fails', header: 'Fails', accessorFn: (flow) => flow.fails, meta: { align: 'right', numeric: true } },
]

// Fluxo de estados item a item (dias úteis desde o Active até cada marco, On Hold e Fails).
export function StateFlowTable({ items, onOpenItem }: StateFlowTableProps) {
  return (
    <DataTable
      data={items}
      columns={COLUMNS}
      getRowId={(flow) => String(flow.row.id)}
      onRowClick={onOpenItem ? (flow) => onOpenItem(flow.row) : undefined}
      emptyMessage="Nenhum item com histórico de estados."
    />
  )
}
