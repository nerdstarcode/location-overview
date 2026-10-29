import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnDef } from '@tanstack/react-table'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { Chip } from '../../atoms/Chip/Chip'
import { DataTable } from '../DataTable/DataTable'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import { DELAY_REASON_LABEL, type PersonQaItem, type PersonQaMetrics } from '../../../lib/personMetrics'

// Explicação resumida de cada card (tooltip ⓘ).
const INFO = {
  executed:
    'Resultados de teste executados pela pessoa (quem rodou, no Azure), trazidos ao sincronizar as sprints. Resultados não executados (Not Executed, In Progress…) não contam.',
  average: 'Testes executados ÷ sprints em que a pessoa executou algum teste.',
  passed: 'Passed ÷ executados × 100. Abaixo, o % de failed (Failed, Error, Timeout e Aborted).',
  adherence:
    'Pontos de Execução ÷ capacity × 100, só nas sprints em que a pessoa tem alocação. Capacity = dias alocados (% × dias válidos) × capacity points/dia do nível atual.',
  executionPoints:
    'Ponto de execução × runs ÷ 36 dos Test Cases atribuídos à pessoa (36 PE = 1 SP). A média ignora sprints sem PE.',
  testCases: 'Quantidade de Test Cases e Test Plans com a pessoa no Assigned To, nas sprints do filtro.',
}

export interface PersonQaDashboardProps {
  metrics: PersonQaMetrics
  onOpenItem: (item: PersonQaItem) => void
}

export function PersonQaDashboard({ metrics, onOpenItem }: PersonQaDashboardProps) {
  const chart = useChartTheme()
  const { sprints } = metrics

  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(sprints.map((s) => s.label)),
        yAxis: [chart.valueAxis({ name: 'Testes', nameTextStyle: chart.textStyle }), chart.valueAxis({ name: 'PE (SP)', nameTextStyle: chart.textStyle, splitLine: { show: false } })],
        series: [
          {
            name: 'Passed',
            type: 'bar',
            stack: 'executed',
            data: sprints.map((s) => s.passed),
            itemStyle: { color: chart.palette[1], ...chart.paletteBorder },
            barMaxWidth: 40,
            markLine: {
              symbol: 'none',
              // Dentro da área do gráfico: na ponta direita padrão o rótulo era cortado.
              label: { color: chart.theme.text, formatter: 'Média: {c}', position: 'insideEndTop' },
              lineStyle: { color: chart.theme.text, type: 'dashed' },
              data: [{ yAxis: metrics.averageExecutedPerSprint, name: 'Média executados' }],
            },
          },
          {
            name: 'Failed',
            type: 'bar',
            stack: 'executed',
            data: sprints.map((s) => s.failed),
            itemStyle: { color: chart.palette[5], ...chart.paletteBorder },
            barMaxWidth: 40,
          },
          {
            name: 'Outros (Blocked…)',
            type: 'bar',
            stack: 'executed',
            data: sprints.map((s) => s.other),
            itemStyle: { color: chart.palette[3], ...chart.paletteBorder },
            barMaxWidth: 40,
          },
          {
            name: 'Pontos de Execução',
            type: 'line',
            yAxisIndex: 1,
            data: sprints.map((s) => s.executionPoints),
            itemStyle: { color: chart.palette[4] },
            symbol: 'circle',
          },
          {
            name: 'Capacity (Alocação)',
            type: 'line',
            yAxisIndex: 1,
            // null = sem alocação na sprint: sem ponto, em vez de puxar a linha para 0.
            data: sprints.map((s) => (s.capacity > 0 ? s.capacity : null)),
            itemStyle: { color: chart.palette[2] },
            lineStyle: { type: 'dashed' },
            symbol: 'triangle',
          },
        ],
      }),
    [sprints, metrics.averageExecutedPerSprint, chart],
  )

  const executedSprints = useMemo(() => sprints.filter((s) => s.executed > 0), [sprints])

  const squadOption: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, type: 'scroll', textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(executedSprints.map((s) => s.label)),
        yAxis: chart.valueAxis({ minInterval: 1 }),
        series: metrics.squadNames.map((squad, index) => ({
          name: squad,
          type: 'bar',
          data: executedSprints.map((s) => s.bySquad[squad] ?? 0),
          itemStyle: { color: chart.palette[index % chart.palette.length], ...chart.paletteBorder },
          barMaxWidth: 28,
        })),
      }),
    [executedSprints, metrics.squadNames, chart],
  )

  const passRateOption: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', valueFormatter: (value) => `${value}%` },
        xAxis: chart.categoryAxis(executedSprints.map((s) => s.label)),
        yAxis: chart.valueAxis({ min: 0, max: 100, axisLabel: { ...chart.textStyle, formatter: '{value}%' } }),
        series: [
          {
            name: '% Passed',
            type: 'line',
            data: executedSprints.map((s) => round1((s.passed / s.executed) * 100)),
            itemStyle: { color: chart.palette[1] },
            lineStyle: { width: 3 },
            symbol: 'circle',
            markLine: {
              symbol: 'none',
              label: { color: chart.theme.text, formatter: 'Geral: {c}%', position: 'insideEndTop' },
              lineStyle: { color: chart.theme.text, type: 'dashed' },
              data: [{ yAxis: metrics.passedPercent, name: '% Passed geral' }],
            },
          },
        ],
      }),
    [executedSprints, metrics.passedPercent, chart],
  )

  const columns = useMemo<ColumnDef<PersonQaItem, unknown>[]>(
    () => [
      { id: 'id', header: 'ID', accessorFn: (item) => item.row.id, meta: { align: 'right', headerAlign: 'left', numeric: true } },
      { id: 'type', header: 'Tipo', accessorFn: (item) => item.row.workItemType },
      { id: 'title', header: 'Título', accessorFn: (item) => item.row.title },
      { id: 'state', header: 'Estado', accessorFn: (item) => item.row.state },
      { id: 'runs', header: 'Runs', accessorFn: (item) => item.row.runs, meta: { align: 'right', numeric: true } },
      {
        id: 'pe',
        header: 'PE (SP)',
        accessorFn: (item) => item.executionPoints,
        cell: ({ row }) => round1(row.original.executionPoints),
        meta: { align: 'right', numeric: true },
      },
      { id: 'delivery', header: 'Sprint', accessorFn: (item) => item.delay.deliverySprint },
      {
        id: 'delay',
        header: 'Atraso',
        accessorFn: (item) => (item.delay.reason ? DELAY_REASON_LABEL[item.delay.reason] : ''),
        cell: ({ row }) => (row.original.delay.reason ? <Chip label={DELAY_REASON_LABEL[row.original.delay.reason]} /> : null),
      },
    ],
    [],
  )

  const executionsHint = metrics.hasExecutions
    ? `${metrics.passed} passed · ${metrics.failed} failed`
    : 'Sincronize as sprints pelo Azure para trazer quem executou'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Testes executados" info={INFO.executed} value={metrics.executed} hint={executionsHint} />
        <StatCard label="Média de execução" info={INFO.average} value={`${metrics.averageExecutedPerSprint} testes/sprint`} hint="Sprints com execução" />
        <StatCard label="% Passed" info={INFO.passed} value={`${metrics.passedPercent}%`} hint={`${metrics.failedPercent}% failed`} />
        <StatCard
          label="Aderência à capacity" info={INFO.adherence}
          value={metrics.capacityAdherence === null ? '—' : `${metrics.capacityAdherence}%`}
          hint={
            metrics.allocatedSprints > 0
              ? `${metrics.deliveredOnAllocatedSprints} PE em ${metrics.allocatedSprints} sprint(s) com alocação · capacity ${metrics.capacity} SP`
              : 'Sem alocação nas sprints'
          }
        />
        <StatCard label="Pontos de Execução" info={INFO.executionPoints} value={`${metrics.executionPoints} SP`} hint={`Média ${metrics.averageExecutionPointsPerSprint} SP/sprint`} />
        <StatCard label="Test Cases atribuídos" info={INFO.testCases} value={metrics.testCases} hint="Test Case / Test Plan com a pessoa no Assigned To" />
      </div>

      <ChartCard
        title="Testes executados por sprint"
        description="Barras: resultados executados pela pessoa (runBy). Linhas: Pontos de Execução dos Test Cases atribuídos e capacity da Alocação (eixo da direita, em SP)."
        isEmpty={sprints.length === 0}
        emptyMessage="Nenhuma execução, Test Case ou alocação nas sprints selecionadas."
      >
        <ReactECharts option={option} style={{ height: 320 }} notMerge />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Testes executados por sprint e squad"
          description="Resultados executados pela pessoa em cada sprint, uma barra por squad (a squad da sincronização)."
          isEmpty={executedSprints.length === 0}
          emptyMessage="Nenhum teste executado nas sprints selecionadas."
        >
          <ReactECharts option={squadOption} style={{ height: 300 }} notMerge />
        </ChartCard>

        <ChartCard
          title="% Passed por sprint"
          description="Passed ÷ executados em cada sprint; a linha tracejada é o % geral do período."
          isEmpty={executedSprints.length === 0}
          emptyMessage="Nenhum teste executado nas sprints selecionadas."
        >
          <ReactECharts option={passRateOption} style={{ height: 300 }} notMerge />
        </ChartCard>
      </div>

      <ChartCard title="Test Cases" description="Clique num item para ver o detalhe e buscar o histórico no Azure.">
        <DataTable
          data={metrics.items}
          columns={columns}
          getRowId={(item) => String(item.row.id)}
          onRowClick={onOpenItem}
          emptyMessage="Nenhum Test Case atribuído a esta pessoa."
        />
      </ChartCard>
    </div>
  )
}
