import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Chip } from '../../atoms/Chip/Chip'
import { formatDateBR } from '../../../lib/dates'
import { Button } from '../../atoms/Button/Button'
import type { AzureIteration, AzureIterationTimeFrame } from '../../../lib/azure/types'

const TIME_FRAME_LABEL: Record<AzureIterationTimeFrame, string> = {
  past: 'Encerrada',
  current: 'Atual',
  future: 'Futura',
}

export interface IterationsListProps {
  iterations: AzureIteration[]
  onOpen: (iteration: AzureIteration) => void
}

// Sprints (iterations) do team, da mais recente para a mais antiga. Clicar na linha abre a análise.
export function IterationsList({ iterations, onOpen }: IterationsListProps) {
  const rows = useMemo(
    () => [...iterations].sort((a, b) => (b.attributes.startDate ?? '').localeCompare(a.attributes.startDate ?? '')),
    [iterations],
  )

  const columns = useMemo<ColumnDef<AzureIteration, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Sprint' },
      { id: 'start', header: 'Início', accessorFn: (it) => it.attributes.startDate ?? '', cell: ({ row }) => formatDateBR(row.original.attributes.startDate) },
      { id: 'end', header: 'Fim', accessorFn: (it) => it.attributes.finishDate ?? '', cell: ({ row }) => formatDateBR(row.original.attributes.finishDate) },
      {
        id: 'timeFrame',
        header: 'Situação',
        accessorFn: (it) => it.attributes.timeFrame,
        cell: ({ row }) => <Chip label={TIME_FRAME_LABEL[row.original.attributes.timeFrame] ?? row.original.attributes.timeFrame} />,
      },
      { accessorKey: 'path', header: 'Iteration Path' },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(event) => {
              // A linha inteira também abre a sprint; sem isso o clique dispararia onOpen duas vezes.
              event.stopPropagation()
              onOpen(row.original)
            }}
          >
            Analisar
          </Button>
        ),
      },
    ],
    [onOpen],
  )

  return (
    <DataTable
      data={rows}
      columns={columns}
      onRowClick={onOpen}
      emptyMessage="Este team não tem sprints configuradas."
    />
  )
}
