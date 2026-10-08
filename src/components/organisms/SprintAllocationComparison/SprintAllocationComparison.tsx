import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { DataTable } from '../DataTable/DataTable'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import type { AllocationComparisonRow, AllocationStatus } from '../../../lib/azure/sprintMetrics'

export interface SprintAllocationComparisonProps {
  rows: AllocationComparisonRow[]
  totalPoints: number
  qaMinPercent: number
  qaMaxPercent: number
  /** Nome da squad/sprint locais usadas no cruzamento — undefined quando ainda não existem na base. */
  localSquadName?: string
  localSprintLabel?: string
}

const STATUS_LABEL: Record<AllocationStatus, string> = {
  'sem-cadastro': 'Sem cadastro',
  'sem-alocacao': 'Sem alocação',
  abaixo: 'Abaixo',
  dentro: 'Dentro',
  acima: 'Acima',
}

const STATUS_CLASS: Record<AllocationStatus, string> = {
  'sem-cadastro': 'bg-[var(--code-bg)] text-[var(--text)]',
  'sem-alocacao': 'bg-[var(--code-bg)] text-[var(--text)]',
  abaixo: 'bg-brand-action-warning/20 text-[var(--text-h)]',
  dentro: 'bg-brand-action-success/20 text-[var(--text-h)]',
  acima: 'bg-brand-action-danger/20 text-[var(--text-h)]',
}

function formatRange(min: number | null, max: number | null): string {
  return min === null || max === null ? '—' : `${min} – ${max}`
}

const NUMERIC = { align: 'right', numeric: true } as const

const COLUMNS: ColumnDef<AllocationComparisonRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Pessoa',
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="text-[var(--text-h)]">{row.original.name}</span>
        {!row.original.isMember && <span className="text-xs text-[var(--text)]">fora do team</span>}
      </span>
    ),
  },
  { id: 'cargo', header: 'Cargo', accessorFn: (row) => row.person?.cargo ?? '' },
  { id: 'nivel', header: 'Nível', accessorFn: (row) => row.person?.nivel ?? '' },
  {
    id: 'percentage',
    header: 'Alocação',
    accessorFn: (row) => row.percentage ?? -1,
    cell: ({ row }) => (row.original.percentage === null ? '—' : `${row.original.percentage}%`),
    meta: NUMERIC,
  },
  { accessorKey: 'capacity', header: 'Capacity', meta: NUMERIC },
  { accessorKey: 'max', header: 'Max', meta: NUMERIC },
  {
    id: 'qaRange',
    header: 'Faixa QA (SP)',
    accessorFn: (row) => row.expectedMin ?? -1,
    cell: ({ row }) => formatRange(row.original.expectedMin, row.original.expectedMax),
    meta: NUMERIC,
  },
  { accessorKey: 'assigned', header: 'SP atribuídos', meta: NUMERIC },
  { accessorKey: 'delivered', header: 'SP entregues', meta: NUMERIC },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASS[row.original.status])}>
        {STATUS_LABEL[row.original.status]}
      </span>
    ),
  },
]

function describeQaExpectation(rows: AllocationComparisonRow[], totalPoints: number, minPercent: number, maxPercent: number): string {
  const qaAssigned = round1(rows.filter((row) => row.isQa).reduce((sum, row) => sum + row.assigned, 0))
  const min = round1((totalPoints * minPercent) / 100)
  const max = round1((totalPoints * maxPercent) / 100)
  return `QA esperado: ${minPercent}%–${maxPercent}% de ${totalPoints} SP = ${min} – ${max} SP (atribuído aos QAs: ${qaAssigned} SP)`
}

// Cruza os SP atribuídos na sprint com a Alocação da base local: para devs o status
// compara os SP com capacity/max (dias alocados × pontos/dia do nível); para QA
// compara a Faixa QA (qaMin%–qaMax% dos SP totais, dividida entre os QAs
// proporcionalmente ao capacity) com o capacity/max dele.
export function SprintAllocationComparison({
  rows,
  totalPoints,
  qaMinPercent,
  qaMaxPercent,
  localSquadName,
  localSprintLabel,
}: SprintAllocationComparisonProps) {
  const chart = useChartTheme()

  // Uma barra por pessoa (devs: SP atribuídos; QA: máximo da Faixa QA), empilhadas com
  // null para as duas séries ocuparem o mesmo lugar, e marcadores de Capacity/Max de cada um.
  const option: EChartsOption = useMemo(() => {
    const hasAllocation = (row: AllocationComparisonRow) => row.percentage !== null
    return chart.baseOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: chart.textStyle },
      grid: { ...chart.grid, bottom: 24 },
      xAxis: chart.categoryAxis(
        rows.map((row) => (row.isQa ? `${row.name} (QA)` : row.name)),
        { axisLabel: { ...chart.textStyle, interval: 0, rotate: rows.length > 6 ? 30 : 0 } },
      ),
      yAxis: chart.valueAxis(),
      series: [
        {
          name: 'SP atribuídos (Dev)',
          type: 'bar',
          stack: 'pessoa',
          data: rows.map((row) => (row.isQa ? null : row.assigned)),
          itemStyle: { color: chart.palette[0], ...chart.paletteBorder },
          barMaxWidth: 28,
        },
        {
          name: 'Faixa QA máx. (QA)',
          type: 'bar',
          stack: 'pessoa',
          data: rows.map((row) => (row.isQa ? row.expectedMax : null)),
          itemStyle: { color: chart.palette[6], ...chart.paletteBorder },
          barMaxWidth: 28,
        },
        {
          name: 'Capacity',
          type: 'scatter',
          data: rows.map((row) => (hasAllocation(row) ? row.capacity : null)),
          symbol: 'rect',
          symbolSize: [28, 4],
          itemStyle: { color: chart.palette[2], ...chart.paletteBorder },
        },
        {
          name: 'Max',
          type: 'scatter',
          data: rows.map((row) => (hasAllocation(row) ? row.max : null)),
          symbol: 'triangle',
          symbolSize: 12,
          itemStyle: { color: chart.palette[5], ...chart.paletteBorder },
        },
      ],
    })
  }, [rows, chart])

  const missingBase = !localSquadName || !localSprintLabel

  return (
    <ChartCard
      title="Story Points × Alocação"
      description={
        missingBase
          ? undefined
          : `Base local: squad ${localSquadName} · ${localSprintLabel} · ${describeQaExpectation(rows, totalPoints, qaMinPercent, qaMaxPercent)}`
      }
    >
      {missingBase && (
        <p className="mb-3 flex items-center gap-2 rounded-md bg-brand-action-warning/15 p-3 text-sm text-[var(--text-h)]">
          <AlertTriangle size={16} className="shrink-0 text-brand-action-warning" />
          {!localSquadName ? 'Squad' : 'Sprint'} ainda não existe na base local — use “Atualizar base” e cadastre as
          alocações na tela de Squads para comparar com capacity.
        </p>
      )}
      {rows.length > 0 && <ReactECharts option={option} style={{ height: 340 }} notMerge />}
      <div className="mt-3">
        <DataTable data={rows} columns={COLUMNS} getRowId={(row) => row.email || row.name} emptyMessage="Nenhum membro no team." />
      </div>
    </ChartCard>
  )
}
