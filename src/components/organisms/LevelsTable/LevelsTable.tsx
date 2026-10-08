import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { ColumnDef, TableMeta } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { EditableCell } from '../DataTable/EditableCell'
import { toNumber } from '../../../lib/allocation'
import { DEFAULT_LEVELS, loadLevels, saveLevels, type LevelConfig } from '../../../lib/levelsStorage'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    updateLevel?: (nivel: string, field: 'capacityPointsDay' | 'maxPointsDay', value: string) => void
  }
}

function editableNumberColumn(field: 'capacityPointsDay' | 'maxPointsDay'): ColumnDef<LevelConfig, unknown>['cell'] {
  return ({ row, table }) => (
    <EditableCell
      value={String(row.original[field])}
      type="number"
      onCommit={(value) => table.options.meta?.updateLevel?.(row.original.nivel, field, value)}
    />
  )
}

const LEVELS_COLUMNS: ColumnDef<LevelConfig, unknown>[] = [
  { accessorKey: 'nivel', header: 'Nível' },
  { accessorKey: 'label', header: 'Descrição' },
  {
    accessorKey: 'capacityPointsDay',
    header: 'Capacity Points/Day',
    meta: { align: 'right', numeric: true },
    cell: editableNumberColumn('capacityPointsDay'),
  },
  {
    accessorKey: 'maxPointsDay',
    header: 'Max Points/Day',
    meta: { align: 'right', numeric: true },
    cell: editableNumberColumn('maxPointsDay'),
  },
]

// Configuração de min/max points/day por nível, usada pela importação de
// alocação (src/lib/allocation.tsx) quando a planilha não informa esses
// valores explicitamente. Persistida em localStorage via levelsStorage.ts.
export function LevelsTable() {
  const [levels, setLevels] = useState<LevelConfig[]>(loadLevels)

  function handleUpdateLevel(nivel: string, field: 'capacityPointsDay' | 'maxPointsDay', value: string) {
    setLevels((prev) => {
      const next = prev.map((level) => (level.nivel === nivel ? { ...level, [field]: toNumber(value) } : level))
      saveLevels(next)
      return next
    })
  }

  function handleReset() {
    setLevels(DEFAULT_LEVELS)
    saveLevels(DEFAULT_LEVELS)
  }

  const meta: TableMeta<LevelConfig> = { updateLevel: handleUpdateLevel }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text)]">
          Define o Capacity/Max Points por dia usado ao importar planilhas sem esses valores preenchidos.
        </p>
        <button
          type="button"
          onClick={handleReset}
          aria-label="Restaurar padrão"
          title="Restaurar padrão"
          className="rounded-md border border-[var(--border)] p-1.5 text-[var(--text-h)] transition-colors hover:bg-[var(--code-bg)]"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <DataTable columns={LEVELS_COLUMNS} data={levels} meta={meta} />
    </div>
  )
}
