import * as XLSX from 'xlsx'
import type { ColumnDef } from '@tanstack/react-table'
import { EditableCell } from '../components/organisms/DataTable/EditableCell'
import { levelsToPointsMap, loadLevels } from './levelsStorage'

export interface AllocationRow {
  name: string
  cargo: string
  squad: string
  sprint: string
  perfil: string
  nivel: string
  diasSprint: number
  capacityPointsDay: number
  maxPointsDay: number
  capacityPointsSprint: number
  maxPointsSprint: number
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    updateRow?: (key: string, field: keyof AllocationRow, value: string) => void
    /** Nome exibido na coluna Squad (ex.: nome principal quando o texto é um alias). */
    squadDisplayName?: (name: string) => string
  }
}

/** Name + Sprint + Squad + Perfil identifica uma linha de forma única. */
export function getAllocationKey(row: Pick<AllocationRow, 'name' | 'sprint' | 'squad' | 'perfil'>): string {
  return [row.name, row.sprint, row.squad, row.perfil].map((value) => value.trim().toLowerCase()).join('::')
}

export function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

/** capacityPointsSprint/maxPointsSprint são sempre derivados de diasSprint * points/day. */
export function deriveSprintPoints(
  row: Pick<AllocationRow, 'diasSprint' | 'capacityPointsDay' | 'maxPointsDay'>,
): Pick<AllocationRow, 'capacityPointsSprint' | 'maxPointsSprint'> {
  return {
    capacityPointsSprint: row.diasSprint * row.capacityPointsDay,
    maxPointsSprint: row.diasSprint * row.maxPointsDay,
  }
}

function editableTextColumn(field: keyof AllocationRow): ColumnDef<AllocationRow, unknown>['cell'] {
  return ({ row, table }) => (
    <EditableCell
      value={String(row.original[field])}
      type="text"
      onCommit={(value) => table.options.meta?.updateRow?.(getAllocationKey(row.original), field, value)}
    />
  )
}

function editableNumberColumn(field: keyof AllocationRow): ColumnDef<AllocationRow, unknown>['cell'] {
  return ({ row, table }) => (
    <EditableCell
      value={String(row.original[field])}
      type="number"
      onCommit={(value) => table.options.meta?.updateRow?.(getAllocationKey(row.original), field, value)}
    />
  )
}

// Espelha as colunas e a ordem da tabela "Tabela13" do Alocação Sprint.xlsx.
export const ALLOCATION_COLUMNS: ColumnDef<AllocationRow, unknown>[] = [
  { accessorKey: 'name', header: 'Name', cell: editableTextColumn('name') },
  { accessorKey: 'cargo', header: 'Cargo', cell: editableTextColumn('cargo') },
  {
    accessorKey: 'squad',
    header: 'Squad',
    cell: ({ row, table }) => (
      <EditableCell
        value={table.options.meta?.squadDisplayName?.(row.original.squad) ?? row.original.squad}
        type="text"
        onCommit={(value) => table.options.meta?.updateRow?.(getAllocationKey(row.original), 'squad', value)}
      />
    ),
  },
  { accessorKey: 'sprint', header: 'Sprint', cell: editableTextColumn('sprint') },
  { accessorKey: 'perfil', header: 'Perfil', cell: editableTextColumn('perfil') },
  { accessorKey: 'nivel', header: 'Nivel', cell: editableTextColumn('nivel') },
  {
    accessorKey: 'diasSprint',
    header: 'Dias Sprint(Alocação em dias)',
    meta: { align: 'right', numeric: true },
    cell: editableNumberColumn('diasSprint'),
  },
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
  { accessorKey: 'capacityPointsSprint', header: 'Capacity Points/Sprint', meta: { align: 'right', numeric: true } },
  { accessorKey: 'maxPointsSprint', header: 'Max Points/Sprint', meta: { align: 'right', numeric: true } },
]

const HEADER_ALIASES: Record<string, keyof AllocationRow> = {
  name: 'name',
  cargo: 'cargo',
  squad: 'squad',
  sprint: 'sprint',
  perfil: 'perfil',
  nivel: 'nivel',
  'dias sprint(alocação em dias)': 'diasSprint',
  'dias sprint (alocação em dias)': 'diasSprint',
  'dias sprint': 'diasSprint',
  'capacity points/day': 'capacityPointsDay',
  'min points/day': 'capacityPointsDay',
  'max points/day': 'maxPointsDay',
  'capacity points/sprint': 'capacityPointsSprint',
  'min points/sprint': 'capacityPointsSprint',
  'max points/sprint': 'maxPointsSprint',
}

function buildRow(raw: Record<string, unknown>, pointsByLevel: Record<string, { capacity: number; max: number }>): AllocationRow {
  const nivel = String(raw.nivel ?? '').trim().toUpperCase()
  const diasSprint = toNumber(raw.diasSprint)

  const levelPoints = pointsByLevel[nivel]
  const capacityPointsDay =
    raw.capacityPointsDay !== undefined ? toNumber(raw.capacityPointsDay) : levelPoints?.capacity ?? 0
  const maxPointsDay = raw.maxPointsDay !== undefined ? toNumber(raw.maxPointsDay) : levelPoints?.max ?? 0

  const derived = deriveSprintPoints({ diasSprint, capacityPointsDay, maxPointsDay })
  const capacityPointsSprint =
    raw.capacityPointsSprint !== undefined ? toNumber(raw.capacityPointsSprint) : derived.capacityPointsSprint
  const maxPointsSprint = raw.maxPointsSprint !== undefined ? toNumber(raw.maxPointsSprint) : derived.maxPointsSprint

  return {
    name: String(raw.name ?? '').trim(),
    cargo: String(raw.cargo ?? '').trim(),
    squad: String(raw.squad ?? '').trim(),
    sprint: String(raw.sprint ?? '').trim(),
    perfil: String(raw.perfil ?? '').trim(),
    nivel,
    diasSprint,
    capacityPointsDay,
    maxPointsDay,
    capacityPointsSprint,
    maxPointsSprint,
  }
}

/** Lê um arquivo .xlsx/.xls/.csv e converte a primeira planilha em linhas de alocação. */
export async function parseAllocationFile(file: File): Promise<AllocationRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const pointsByLevel = levelsToPointsMap(loadLevels())

  return records
    .map((record) => {
      const mapped: Record<string, unknown> = {}
      for (const [header, value] of Object.entries(record)) {
        const key = HEADER_ALIASES[header.trim().toLowerCase()]
        if (key) mapped[key] = value
      }
      return mapped
    })
    .filter((mapped) => String(mapped.name ?? '').trim() !== '')
    .map((mapped) => buildRow(mapped, pointsByLevel))
}
