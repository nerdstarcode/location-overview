import * as XLSX from 'xlsx'
import type { ColumnDef } from '@tanstack/react-table'
import { TagsCell } from '../components/organisms/DataTable/TagsCell'
import { Chip } from '../components/atoms/Chip/Chip'

export interface WorkItemRow {
  id: number
  workItemType: string
  title: string
  assignedTo: string
  email: string
  state: string
  tags: string
  iterationPath: string
  sprint: string
  fiscalYear: string
  storyPoints: number
  effort: number
  timeCriticality: number
  wsjf: number
  /** Se ausente na importação: 1 para Work Item Type "Test Case", 0 para os demais. */
  pontoExecucao: number
  /** Se ausente na importação: 2 para State Closed/Done, 0 para os demais. */
  runs: number
  /** true quando as Tags têm "Delayed" + um sprint diferente do Iteration Path (ver `resolveSprint`). */
  isDelayed: boolean
  /** Preenchidos só na sincronização pelo Azure DevOps (a planilha não traz esses campos). */
  parentId?: number
  closedDate?: string
}

/** Mesmo conjunto usado no gráfico "Story Points Closed por Sprint" do Dashboard e no default de Runs. */
export const CLOSED_STATES = new Set(['Closed', 'Done'])

const ASSIGNED_TO_EMAIL = /<([^>]+)>/

/** Separa "Nome Sobrenome <email>" em { name, email }, aplicando trim no nome. */
export function splitAssignedTo(rawAssignedTo: string): { name: string; email: string } {
  const match = rawAssignedTo.match(ASSIGNED_TO_EMAIL)
  const email = match ? match[1].trim() : ''
  const name = rawAssignedTo.replace(ASSIGNED_TO_EMAIL, '').trim()
  return { name, email }
}

export function getWorkItemKey(row: Pick<WorkItemRow, 'id'>): string {
  return String(row.id)
}

export function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

// O separador entre o número da sprint e o "FYxx-yy" varia entre arquivos:
// "Sprint 01 - FY26-27", "Sprint 14 FY23-24", "Sprint 13FY23-24" — por isso o
// traço e os espaços em volta dele são todos opcionais.
const SPRINT_PATTERN = /Sprint\s*(\d+)\s*-?\s*(FY\d{2}-\d{2})/i

/**
 * Extrai "Sprint N [-] FYxx-yy" do Iteration Path, separando em Sprint (número
 * sempre com 2 dígitos — "Sprint 1" e "Sprint 01" viram ambos "Sprint 01")
 * e Fiscal Year ("FY26-27").
 */
export function parseSprintInfo(iterationPath: string): { sprint: string; fiscalYear: string } {
  const match = iterationPath.match(SPRINT_PATTERN)
  if (!match) return { sprint: '', fiscalYear: '' }
  const number = match[1].padStart(2, '0')
  return { sprint: `Sprint ${number}`, fiscalYear: match[2].toUpperCase() }
}

/** Quebra o campo Tags ("Fase 1; Sprint 08-FY25-26") em valores individuais. */
export function splitTags(tags: string): string[] {
  return tags
    .split(';')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * Alguns work items têm a tag "Delayed" junto de uma tag com o padrão de sprint
 * ("Sprint 1 - FY25-26") diferente do sprint indicado pelo Iteration Path — o
 * item foi fechado depois, dentro de outro sprint. Nesse caso o Sprint/Fiscal
 * Year da linha passam a refletir o valor da tag, e a linha é marcada como delayed.
 */
export function resolveSprint(
  tags: string,
  fallback: { sprint: string; fiscalYear: string },
): { sprint: string; fiscalYear: string; isDelayed: boolean } {
  const tagList = splitTags(tags)
  const hasDelayedTag = tagList.some((tag) => tag.toLowerCase() === 'delayed')
  if (!hasDelayedTag) return { ...fallback, isDelayed: false }

  for (const tag of tagList) {
    const parsed = parseSprintInfo(tag)
    if (!parsed.sprint || !parsed.fiscalYear) continue
    if (parsed.sprint === fallback.sprint && parsed.fiscalYear === fallback.fiscalYear) continue
    return { sprint: parsed.sprint, fiscalYear: parsed.fiscalYear, isDelayed: true }
  }

  return { ...fallback, isDelayed: false }
}

export const WORK_ITEM_COLUMNS: ColumnDef<WorkItemRow, unknown>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    meta: { align: 'right', headerAlign: 'left', numeric: true },
  },
  { accessorKey: 'workItemType', header: 'Work Item Type' },
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'assignedTo', header: 'Assigned To' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'state', header: 'State' },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => <TagsCell tags={splitTags(row.original.tags)} />,
  },
  { accessorKey: 'iterationPath', header: 'Iteration Path' },
  { accessorKey: 'sprint', header: 'Sprint' },
  { accessorKey: 'fiscalYear', header: 'Fiscal Year' },
  {
    accessorKey: 'isDelayed',
    header: 'Delayed',
    cell: ({ row }) => (row.original.isDelayed ? <Chip label="Delayed" /> : null),
  },
  { accessorKey: 'storyPoints', header: 'Story Points', meta: { align: 'right', numeric: true } },
  { accessorKey: 'effort', header: 'Effort', meta: { align: 'right', numeric: true } },
  { accessorKey: 'timeCriticality', header: 'Time Criticality', meta: { align: 'right', numeric: true } },
  { accessorKey: 'wsjf', header: 'WSJF', meta: { align: 'right', numeric: true } },
  { accessorKey: 'pontoExecucao', header: 'Ponto de Execução', meta: { align: 'right', numeric: true } },
  { accessorKey: 'runs', header: 'Runs', meta: { align: 'right', numeric: true } },
]

const HEADER_ALIASES: Record<string, keyof WorkItemRow> = {
  id: 'id',
  'work item type': 'workItemType',
  title: 'title',
  'assigned to': 'assignedTo',
  state: 'state',
  tags: 'tags',
  'iteration path': 'iterationPath',
  'story points': 'storyPoints',
  effort: 'effort',
  'time criticality': 'timeCriticality',
  wsjf: 'wsjf',
  'ponto de execução': 'pontoExecucao',
  'execution point': 'pontoExecucao',
  runs: 'runs',
}

/** Normaliza um registro cru (chaves de `WorkItemRow`) — usado na planilha e na sincronização com o Azure DevOps. */
export function buildWorkItemRow(raw: Record<string, unknown>): WorkItemRow {
  const { name: assignedTo, email } = splitAssignedTo(String(raw.assignedTo ?? '').trim())
  const iterationPath = String(raw.iterationPath ?? '').trim()
  const workItemType = String(raw.workItemType ?? '').trim()
  const tags = String(raw.tags ?? '').trim()

  const state = String(raw.state ?? '').trim()

  const pontoExecucao =
    raw.pontoExecucao !== undefined ? toNumber(raw.pontoExecucao) : workItemType === 'Test Case' ? 1 : 0
  const runs = raw.runs !== undefined ? toNumber(raw.runs) : CLOSED_STATES.has(state) ? 2 : 0

  return {
    id: toNumber(raw.id),
    workItemType,
    title: String(raw.title ?? '').trim(),
    assignedTo,
    email,
    state,
    tags,
    iterationPath,
    ...resolveSprint(tags, parseSprintInfo(iterationPath)),
    storyPoints: toNumber(raw.storyPoints),
    effort: toNumber(raw.effort),
    timeCriticality: toNumber(raw.timeCriticality),
    wsjf: toNumber(raw.wsjf),
    // Test Case sempre tem no mínimo 1 ponto de execução, mesmo que a planilha traga um valor menor.
    pontoExecucao: workItemType === 'Test Case' ? Math.max(pontoExecucao, 1) : pontoExecucao,
    runs,
  }
}

/** Lê um arquivo .xlsx/.xls/.csv e converte a primeira planilha em work items. */
export async function parseWorkItemsFile(file: File): Promise<WorkItemRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return records
    .map((record) => {
      const mapped: Record<string, unknown> = {}
      for (const [header, value] of Object.entries(record)) {
        const key = HEADER_ALIASES[header.trim().toLowerCase()]
        if (key) mapped[key] = value
      }
      return mapped
    })
    .filter((mapped) => String(mapped.id ?? '').trim() !== '')
    .map(buildWorkItemRow)
}
