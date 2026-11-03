import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnDef } from '@tanstack/react-table'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { DataTable } from '../DataTable/DataTable'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import { plannedSprintLabel } from '../../../lib/personMetrics'
import { executionsBySprint, executionsSummary, type ItemExecutions } from '../../../lib/testExecutionsPerPoint'
import type { WorkItemRow } from '../../../lib/workItems'

const INFO = {
  perPoint:
    'Execuções de teste ÷ story points, só dos itens com Test Case ligado (link "Tested By" no Azure). Cada resultado executado conta, inclusive os re-testes depois de um Fail; Not Executed / In Progress não contam.',
  executions: 'Resultados de teste executados dos Test Cases ligados aos itens, nos test runs das sprints sincronizadas.',
  coverage: 'Itens de pontos (User Story, Bug, Enabler…) com pelo menos um Test Case ligado pelo "Tested By". Os sem Test Case ficam fora da média.',
}

const perPointText = (value: number | null) => (value === null ? '—' : String(round1(value)))

const COLUMNS: ColumnDef<ItemExecutions, unknown>[] = [
  { id: 'id', header: 'ID', accessorFn: (item) => item.row.id, meta: { align: 'right', headerAlign: 'left', numeric: true } },
  { id: 'type', header: 'Tipo', accessorFn: (item) => item.row.workItemType },
  { id: 'title', header: 'Título', accessorFn: (item) => item.row.title },
  { id: 'sprint', header: 'Sprint', accessorFn: (item) => plannedSprintLabel(item.row) },
  { id: 'points', header: 'SP', accessorFn: (item) => item.row.storyPoints, meta: { align: 'right', numeric: true } },
  { id: 'testCases', header: 'Test Cases', accessorFn: (item) => item.testCases, meta: { align: 'right', numeric: true } },
  { id: 'executions', header: 'Execuções', accessorFn: (item) => item.executions, meta: { align: 'right', numeric: true } },
  { id: 'passed', header: 'Passed', accessorFn: (item) => item.passed, meta: { align: 'right', numeric: true } },
  { id: 'failed', header: 'Failed', accessorFn: (item) => item.failed, meta: { align: 'right', numeric: true } },
  {
    id: 'perPoint',
    header: 'Execuções / SP',
    accessorFn: (item) => item.perPoint ?? -1,
    cell: ({ row }) => perPointText(row.original.perPoint),
    meta: { align: 'right', numeric: true, searchValue: (item: ItemExecutions) => perPointText(item.perPoint) },
  },
]

export interface TestExecutionsPerPointProps {
  items: ItemExecutions[]
  title?: string
  description?: string
  onOpenItem?: (row: WorkItemRow) => void
  emptyMessage?: string
}

// Execuções de teste por story point: cards com a média geral e a cobertura de Test Cases, o gráfico
// por sprint (quando há mais de uma) e a tabela item a item com as execuções dos Test Cases ligados.
export function TestExecutionsPerPoint({
  items,
  title = 'Execuções de teste por story point',
  description = 'Quantas execuções de teste cada item teve pelos Test Cases ligados a ele (Tested By) e a média de execuções por story point.',
  onOpenItem,
  emptyMessage = 'Nenhum item de pontos com Test Case ligado. Sincronize as sprints pelo Azure DevOps para trazer os links "Tested By" e os test results.',
}: TestExecutionsPerPointProps) {
  const chart = useChartTheme()
  const summary = useMemo(() => executionsSummary(items), [items])
  const sprints = useMemo(() => executionsBySprint(items).filter((s) => s.summary.itemsWithTests > 0), [items])

  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (raw: unknown) => {
            const params = (Array.isArray(raw) ? raw : [raw]) as { dataIndex: number; axisValueLabel: string }[]
            const sprint = sprints[params[0]?.dataIndex ?? 0]
            if (!sprint) return ''
            const s = sprint.summary
            return [
              `<b>${params[0].axisValueLabel}</b>`,
              `Execuções / SP: <b>${perPointText(s.perPoint)}</b>`,
              `${s.executions} execuções (${s.passed} passed · ${s.failed} failed)`,
              `${s.pointsWithTests} SP em ${s.itemsWithTests} de ${s.items} itens com Test Case`,
            ].join('<br/>')
          },
        },
        legend: { top: 0, textStyle: chart.textStyle },
        xAxis: chart.sprintAxis(sprints.map((s) => s.label)),
        yAxis: [
          chart.valueAxis({ name: 'Execuções / SP', nameTextStyle: chart.textStyle }),
          chart.valueAxis({ name: 'Execuções', nameTextStyle: chart.textStyle, minInterval: 1, splitLine: { show: false } }),
        ],
        series: [
          {
            name: 'Execuções / SP',
            type: 'bar',
            data: sprints.map((s) => s.summary.perPoint),
            itemStyle: { color: chart.palette[0], ...chart.paletteBorder },
            barMaxWidth: 36,
            label: { show: true, position: 'top', color: chart.theme.textH, formatter: ({ value }: { value: unknown }) => perPointText(value as number | null) },
            markLine:
              summary.perPoint === null
                ? undefined
                : {
                    symbol: 'none',
                    label: { color: chart.theme.text, formatter: 'Média: {c}', position: 'insideEndTop' },
                    lineStyle: { color: chart.palette[0], type: 'dashed' },
                    data: [{ yAxis: summary.perPoint, name: 'Média' }],
                  },
          },
          {
            name: 'Execuções',
            type: 'line',
            yAxisIndex: 1,
            data: sprints.map((s) => s.summary.executions),
            itemStyle: { color: chart.palette[4] },
            symbol: 'circle',
          },
        ],
      }),
    [chart, sprints, summary.perPoint],
  )

  return (
    <ChartCard title={title} description={description} isEmpty={summary.itemsWithTests === 0} emptyMessage={emptyMessage}>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Execuções por SP" info={INFO.perPoint} value={perPointText(summary.perPoint)} hint={`${summary.executions} execuções ÷ ${summary.pointsWithTests} SP`} />
        <StatCard label="Execuções" info={INFO.executions} value={summary.executions} hint={`${summary.passed} passed · ${summary.failed} failed`} />
        <StatCard
          label="Itens com Test Case"
          info={INFO.coverage}
          value={`${summary.itemsWithTests} de ${summary.items}`}
          hint={`${summary.pointsWithTests} de ${summary.points} SP cobertos`}
        />
        <StatCard
          label="Execuções por item"
          value={summary.itemsWithTests > 0 ? round1(summary.executions / summary.itemsWithTests) : '—'}
          hint="Média dos itens com Test Case"
        />
      </div>

      {sprints.length > 1 && (
        <div className="mb-4">
          <ReactECharts option={option} style={{ height: 300 }} notMerge />
        </div>
      )}

      <DataTable
        data={items.filter((item) => item.testCases > 0)}
        columns={COLUMNS}
        getRowId={(item) => String(item.row.id)}
        onRowClick={onOpenItem ? (item) => onOpenItem(item.row) : undefined}
        emptyMessage="Nenhum item com Test Case ligado."
      />
    </ChartCard>
  )
}
