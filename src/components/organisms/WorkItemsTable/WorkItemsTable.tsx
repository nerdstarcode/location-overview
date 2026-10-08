import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Button } from '../../atoms/Button/Button'
import { DataTable } from '../DataTable/DataTable'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { Pagination } from '../../molecules/Pagination/Pagination'
import { WORK_ITEM_COLUMNS, parseWorkItemsFile, splitTags, type WorkItemRow } from '../../../lib/workItems'
import { clearWorkItems, loadWorkItems, mergeWorkItems, saveWorkItems } from '../../../lib/workItemsStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { findSquadNameForIterationPath } from '../../../lib/squadMatching'

interface FilterFieldDef {
  field: string
  label: string
  getValues: (row: WorkItemRow) => string[]
}

function buildFilterFields(squads: Squad[]): FilterFieldDef[] {
  return [
    { field: 'id', label: 'ID', getValues: (row) => [String(row.id)] },
    { field: 'workItemType', label: 'Work Item Type', getValues: (row) => [row.workItemType] },
    { field: 'title', label: 'Title', getValues: (row) => [row.title] },
    { field: 'assignedTo', label: 'Assigned To', getValues: (row) => [row.assignedTo] },
    { field: 'email', label: 'Email', getValues: (row) => [row.email] },
    { field: 'state', label: 'State', getValues: (row) => [row.state] },
    // Tags é uma lista separada por ";" ("Fase 1; Sprint 08-FY25-26") — as
    // opções/valores do filtro são os tokens individuais, não a string inteira.
    { field: 'tags', label: 'Tags', getValues: (row) => splitTags(row.tags) },
    { field: 'iterationPath', label: 'Iteration Path', getValues: (row) => [row.iterationPath] },
    // Squad identificada pelo mesmo match usado em AllocationsOverview.tsx: o
    // nome de uma squad cadastrada aparece como segmento do Iteration Path.
    {
      field: 'squad',
      label: 'Squad',
      getValues: (row) => {
        const squadName = findSquadNameForIterationPath(squads, row.iterationPath)
        return squadName ? [squadName] : []
      },
    },
    { field: 'sprint', label: 'Sprint', getValues: (row) => [row.sprint] },
    { field: 'fiscalYear', label: 'Fiscal Year', getValues: (row) => [row.fiscalYear] },
  ]
}

export interface WorkItemsTableProps {
  /** Uso reservado a Storybook/testes: quando informado, ignora o localStorage. */
  initialRows?: WorkItemRow[]
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

// Importa work items (.xlsx/.xls/.csv) e acumula o resultado em localStorage,
// fazendo upsert por ID — várias importações ao longo do tempo se somam na
// mesma base local (mesmo padrão de AllocationTable).
export function WorkItemsTable({ initialRows }: WorkItemsTableProps) {
  const persistent = initialRows === undefined
  const [rows, setRows] = useState<WorkItemRow[]>(() => (persistent ? loadWorkItems() : initialRows))
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [squads] = useState<Squad[]>(loadSquads)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const filterFields = useMemo(() => buildFilterFields(squads), [squads])

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {}
    for (const { field, getValues } of filterFields) {
      options[field] = [...new Set(rows.flatMap(getValues).filter(Boolean))].sort()
    }
    return options
  }, [rows, filterFields])

  const filteredRows = useMemo(() => {
    const activeFilters = filterFields.map((def) => ({ def, values: columnFilters[def.field] ?? [] })).filter(
      ({ values }) => values.length > 0,
    )
    if (activeFilters.length === 0) return rows
    return rows.filter((row) =>
      activeFilters.every(({ def, values }) => def.getValues(row).some((value) => values.includes(value))),
    )
  }, [rows, columnFilters, filterFields])

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
      const parsed = await parseWorkItemsFile(file)
      if (parsed.length === 0) {
        setError('Nenhuma linha reconhecida. Verifique se as colunas seguem o padrão de Work Items.')
        return
      }
      setRows((prev) => {
        const merged = mergeWorkItems(prev, parsed)
        if (persistent) saveWorkItems(merged)
        return merged
      })
      setFileName(file.name)
      setError(null)
    } catch {
      setError('Não foi possível ler o arquivo. Use um .xlsx, .xls ou .csv válido.')
    }
  }

  function handleClear() {
    clearWorkItems()
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
          Importar work items
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
          {filterFields.map(({ field, label }) => (
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
        columns={WORK_ITEM_COLUMNS}
        data={pageRows}
        emptyMessage="Importe um arquivo para visualizar os work items."
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
