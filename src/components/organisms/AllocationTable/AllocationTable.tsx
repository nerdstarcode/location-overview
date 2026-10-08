import { useCallback, useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../../atoms/Button/Button'
import { DataTable } from '../DataTable/DataTable'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { Pagination } from '../../molecules/Pagination/Pagination'
import {
  ALLOCATION_COLUMNS,
  deriveSprintPoints,
  getAllocationKey,
  parseAllocationFile,
  toNumber,
  type AllocationRow,
} from '../../../lib/allocation'
import { clearAllocations, loadAllocations, mergeAllocations, saveAllocations } from '../../../lib/allocationStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { resolveSquadName } from '../../../lib/squadMatching'

const NUMERIC_FIELDS = new Set<keyof AllocationRow>(['diasSprint', 'capacityPointsDay', 'maxPointsDay'])

const TEXT_FILTER_FIELDS: { field: keyof AllocationRow; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'cargo', label: 'Cargo' },
  { field: 'squad', label: 'Squad' },
  { field: 'sprint', label: 'Sprint' },
  { field: 'perfil', label: 'Perfil' },
  { field: 'nivel', label: 'Nivel' },
]

export interface AllocationTableProps {
  /** Uso reservado a Storybook/testes: quando informado, ignora o localStorage. */
  initialRows?: AllocationRow[]
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

// Importa planilhas (.xlsx/.xls/.csv) no formato "Alocação Sprint" e acumula o
// resultado em localStorage, fazendo upsert por Name+Sprint+Squad+Perfil — várias
// planilhas importadas ao longo do tempo se somam na mesma base local.
export function AllocationTable({ initialRows }: AllocationTableProps) {
  const persistent = initialRows === undefined
  const [rows, setRows] = useState<AllocationRow[]>(() => (persistent ? loadAllocations() : initialRows))
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [squads] = useState<Squad[]>(loadSquads)

  // A coluna Squad é texto livre da planilha: aliases aparecem e filtram pelo nome principal da squad cadastrada.
  const filterValue = useCallback(
    (row: AllocationRow, field: keyof AllocationRow) =>
      field === 'squad' ? resolveSquadName(squads, row.squad) : String(row[field]),
    [squads],
  )

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {}
    for (const { field } of TEXT_FILTER_FIELDS) {
      options[field] = [...new Set(rows.map((row) => filterValue(row, field)).filter(Boolean))].sort()
    }
    return options
  }, [rows, filterValue])

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, values]) => values.length > 0)
    if (activeFilters.length === 0) return rows
    return rows.filter((row) =>
      activeFilters.every(([field, values]) => values.includes(filterValue(row, field as keyof AllocationRow))),
    )
  }, [rows, columnFilters, filterValue])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  // Reseta a página ao trocar de dataset ou de filtro — ajuste de estado durante a
  // renderização (padrão recomendado pelo React) em vez de um efeito com setState.
  const [prevResetKey, setPrevResetKey] = useState('')
  const resetKey = `${rows.length}|${JSON.stringify(columnFilters)}`
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    if (page !== 1) setPage(1)
  }

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  function handleColumnFilterChange(field: string, values: string[]) {
    setColumnFilters((prev) => ({ ...prev, [field]: values }))
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const parsed = await parseAllocationFile(file)
      if (parsed.length === 0) {
        setError('Nenhuma linha reconhecida. Verifique se as colunas seguem o padrão da planilha de alocação.')
        return
      }
      setRows((prev) => {
        const merged = mergeAllocations(prev, parsed)
        if (persistent) saveAllocations(merged)
        return merged
      })
      setFileName(file.name)
      setError(null)
    } catch {
      setError('Não foi possível ler o arquivo. Use um .xlsx, .xls ou .csv válido.')
    }
  }

  function handleEditRow(key: string, field: keyof AllocationRow, value: string) {
    setRows((prev) => {
      const next = prev.map((row) => {
        if (getAllocationKey(row) !== key) return row
        const updated: AllocationRow = {
          ...row,
          [field]: NUMERIC_FIELDS.has(field) ? toNumber(value) : value,
        }
        return { ...updated, ...deriveSprintPoints(updated) }
      })
      if (persistent) saveAllocations(next)
      return next
    })
  }

  function handleClear() {
    clearAllocations()
    setRows([])
    setFileName(null)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button type="button" onClick={() => inputRef.current?.click()}>
          Importar planilha
        </Button>
        {persistent && rows.length > 0 && (
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar dados
          </Button>
        )}
        {fileName && <span className="text-sm text-[var(--text)]">Última importação: {fileName}</span>}
        {rows.length > 0 && (
          <span className="text-sm text-[var(--text)]">
            {rows.length} {rows.length === 1 ? 'linha' : 'linhas'}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-brand-action-danger">{error}</p>}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {TEXT_FILTER_FIELDS.map(({ field, label }) => (
            <MultiSelectFilter
              key={field}
              label={label}
              options={filterOptions[field] ?? []}
              selected={columnFilters[field] ?? []}
              onChange={(values) => handleColumnFilterChange(field, values)}
            />
          ))}
        </div>
      )}

      <DataTable
        columns={ALLOCATION_COLUMNS}
        data={pageRows}
        emptyMessage="Importe uma planilha para visualizar a alocação."
        meta={{ updateRow: handleEditRow, squadDisplayName: (name) => resolveSquadName(squads, name) }}
      />

      {rows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          total={filteredRows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}
    </div>
  )
}
