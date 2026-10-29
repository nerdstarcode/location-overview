import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Chip } from '../../atoms/Chip/Chip'
import { formatDateBR } from '../../../lib/dates'
import { Button } from '../../atoms/Button/Button'
import type { IterationSyncProgress, IterationSyncStatus } from '../../../lib/azure/syncToBase'
import type { AzureIteration, AzureIterationTimeFrame } from '../../../lib/azure/types'

const TIME_FRAME_LABEL: Record<AzureIterationTimeFrame, string> = {
  past: 'Encerrada',
  current: 'Atual',
  future: 'Futura',
}

function timeFrameLabel(iteration: AzureIteration): string {
  return TIME_FRAME_LABEL[iteration.attributes.timeFrame] ?? iteration.attributes.timeFrame
}

function syncStatusLabel(entry: IterationSyncStatus): string {
  switch (entry.status) {
    case 'pending':
      return 'Na fila'
    case 'running':
      return 'Sincronizando…'
    case 'done':
      return `Sincronizada · ${entry.result.workItems} itens`
    case 'error':
      return 'Erro'
  }
}

export interface IterationsListProps {
  iterations: AzureIteration[]
  onOpen: (iteration: AzureIteration) => void
  /** Com seleção: checkboxes para escolher as sprints a sincronizar. */
  selectedIds?: Set<string>
  onToggleRow?: (iteration: AzureIteration) => void
  onTogglePage?: (iterations: AzureIteration[]) => void
  /** Status da sincronização em lote, por id da iteration; mostra a coluna "Sincronização". */
  syncStatus?: IterationSyncProgress
}

// Sprints (iterations) do team, da mais recente para a mais antiga. Clicar na linha abre a análise.
export function IterationsList({ iterations, onOpen, selectedIds, onToggleRow, onTogglePage, syncStatus }: IterationsListProps) {
  const rows = useMemo(
    () => [...iterations].sort((a, b) => (b.attributes.startDate ?? '').localeCompare(a.attributes.startDate ?? '')),
    [iterations],
  )

  const columns = useMemo<ColumnDef<AzureIteration, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Sprint' },
      {
        id: 'start',
        header: 'Início',
        accessorFn: (it) => it.attributes.startDate ?? '',
        cell: ({ row }) => formatDateBR(row.original.attributes.startDate),
        meta: { searchValue: (it) => formatDateBR(it.attributes.startDate) },
      },
      {
        id: 'end',
        header: 'Fim',
        accessorFn: (it) => it.attributes.finishDate ?? '',
        cell: ({ row }) => formatDateBR(row.original.attributes.finishDate),
        meta: { searchValue: (it) => formatDateBR(it.attributes.finishDate) },
      },
      {
        id: 'timeFrame',
        header: 'Situação',
        accessorFn: (it) => it.attributes.timeFrame,
        cell: ({ row }) => <Chip label={timeFrameLabel(row.original)} />,
        meta: { searchValue: timeFrameLabel },
      },
      { accessorKey: 'path', header: 'Iteration Path' },
      ...(syncStatus
        ? [
            {
              id: 'sync',
              header: 'Sincronização',
              enableSorting: false,
              cell: ({ row }) => {
                const entry = syncStatus[row.original.id]
                if (!entry) return null
                return (
                  <span title={entry.status === 'error' ? entry.reason : undefined}>
                    <Chip label={syncStatusLabel(entry)} />
                  </span>
                )
              },
            } satisfies ColumnDef<AzureIteration, unknown>,
          ]
        : []),
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
    [onOpen, syncStatus],
  )

  return (
    <DataTable
      data={rows}
      columns={columns}
      onRowClick={onOpen}
      selectable={!!selectedIds}
      getRowId={(it) => it.id}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onTogglePage={onTogglePage}
      rowSelectionAriaLabel={(it) => `Selecionar ${it.name}`}
      emptyMessage="Este team não tem sprints configuradas."
    />
  )
}
