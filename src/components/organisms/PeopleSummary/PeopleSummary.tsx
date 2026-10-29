import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnDef } from '@tanstack/react-table'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { SegmentedControl } from '../../molecules/SegmentedControl/SegmentedControl'
import { DataTable } from '../DataTable/DataTable'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { percentOf, round1 } from '../../../lib/numbers'
import type { Person } from '../../../lib/peopleStorage'
import type { DevAttribution, PersonSummaryRow } from '../../../lib/personMetrics'

export type PeopleSummaryView = 'dev' | 'qa'

const ATTRIBUTION_OPTIONS: { value: DevAttribution; label: string }[] = [
  { value: 'assigned', label: 'Assigned To' },
  { value: 'tasks', label: 'Rateio por Tasks' },
]

const INFO = {
  people: 'Pessoas com item, teste executado ou alocação nos filtros. Clique numa linha da tabela para abrir o dashboard da pessoa.',
  delivered: 'Soma dos SP fechados (Closed/Done) de todas as pessoas listadas, no prazo e atrasados.',
  averageDev: 'Média, entre as pessoas que entregaram algo, da média de SP por sprint de cada uma.',
  adherence:
    'Soma do que as pessoas entregaram nas sprints com alocação (cada sprint limitada ao Max da pessoa) ÷ soma da capacity delas × 100, mesma regra do card da pessoa.',
  open: 'SP dos itens das pessoas listadas que ainda não estão Closed/Done.',
  executed: 'Soma dos testes executados (runBy no Azure) pelas pessoas listadas.',
  averageQa: 'Média, entre as pessoas que executaram testes, da média de testes por sprint de cada uma.',
  passed: 'Passed ÷ executados × 100 somando todas as pessoas.',
  testPoints:
    'Soma dos Test Points executados pelas pessoas listadas, em SP (Test Points ÷ proporção do relatório de teste da squad/sprint; 3,5 sem relatório).',
}

function averageOfPositive(values: number[]): number {
  const positive = values.filter((value) => value > 0)
  return positive.length > 0 ? round1(positive.reduce((sum, value) => sum + value, 0) / positive.length) : 0
}

function adherenceOf(rows: { deliveredOnAllocatedSprints: number; capacity: number }[]): number | null {
  const capacity = rows.reduce((sum, row) => sum + row.capacity, 0)
  const delivered = rows.reduce((sum, row) => sum + row.deliveredOnAllocatedSprints, 0)
  return capacity > 0 ? percentOf(delivered, capacity) : null
}

const formatPercent = (value: number | null) => (value === null ? '—' : `${value}%`)

export interface PeopleSummaryProps {
  rows: PersonSummaryRow[]
  view: PeopleSummaryView
  mode: DevAttribution
  onModeChange: (mode: DevAttribution) => void
  onOpenPerson: (person: Person) => void
}

// Resumo de todas as pessoas: KPIs do time, ranking de entrega, aderência por pessoa e a
// tabela comparativa — Dev (story points) ou QA (testes executados).
export function PeopleSummary({ rows, view, mode, onModeChange, onOpenPerson }: PeopleSummaryProps) {
  const chart = useChartTheme()

  const visible = useMemo(
    () =>
      view === 'dev'
        ? rows.filter((r) => r.tipo !== 'QA' && (r.dev.items.length > 0 || r.dev.capacity > 0))
        : rows.filter((r) => r.tipo === 'QA' || r.qa.executed > 0 || r.qa.testCases > 0),
    [rows, view],
  )

  // Ranking: quem mais entregou/executou no topo (eixo Y invertido).
  const ranked = useMemo(
    () =>
      [...visible].sort((a, b) => (view === 'dev' ? b.dev.delivered - a.dev.delivered : b.qa.executed - a.qa.executed)),
    [visible, view],
  )
  const rankingHeight = Math.max(240, ranked.length * 28 + 80)

  const rankingOption: EChartsOption = useMemo(() => {
    const names = ranked.map((r) => r.person.nome)
    const series =
      view === 'dev'
        ? [
            { name: 'No prazo', data: ranked.map((r) => round1(r.dev.delivered - r.dev.delayedPoints)), color: chart.palette[0] },
            { name: 'Atrasados', data: ranked.map((r) => r.dev.delayedPoints), color: chart.palette[5] },
          ]
        : [
            { name: 'Passed', data: ranked.map((r) => r.qa.passed), color: chart.palette[1] },
            { name: 'Failed', data: ranked.map((r) => r.qa.failed), color: chart.palette[5] },
            { name: 'Outros', data: ranked.map((r) => r.qa.executed - r.qa.passed - r.qa.failed), color: chart.palette[3] },
          ]
    const totals = ranked.map((r) => (view === 'dev' ? r.dev.delivered : r.qa.executed))
    return chart.baseOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: chart.textStyle },
      xAxis: chart.valueAxis(),
      yAxis: chart.categoryAxis(names, { inverse: true }),
      series: series.map((s, index) => ({
        name: s.name,
        type: 'bar',
        stack: 'total',
        data: s.data,
        itemStyle: { color: s.color, ...chart.paletteBorder },
        barMaxWidth: 20,
        // Rótulo do total só na última série da pilha.
        ...(index === series.length - 1
          ? {
              label: {
                show: true,
                position: 'right',
                color: chart.theme.textH,
                formatter: ({ dataIndex }: { dataIndex: number }) => (totals[dataIndex] ? String(totals[dataIndex]) : ''),
              },
            }
          : {}),
      })),
    })
  }, [ranked, view, chart])

  const averages = ranked.map((r) => (view === 'dev' ? r.dev.averagePerSprint : r.qa.averageExecutedPerSprint))
  const teamAverage = averageOfPositive(averages)

  const averageOption: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: chart.valueAxis(),
        yAxis: chart.categoryAxis(
          ranked.map((r) => r.person.nome),
          { inverse: true },
        ),
        series: [
          {
            name: view === 'dev' ? 'SP/sprint' : 'Testes/sprint',
            type: 'bar',
            data: averages,
            itemStyle: { color: chart.palette[2], ...chart.paletteBorder },
            barMaxWidth: 20,
            markLine: {
              symbol: 'none',
              label: { color: chart.theme.text, formatter: 'Time: {c}', position: 'insideEndTop' },
              lineStyle: { color: chart.theme.text, type: 'dashed' },
              data: [{ xAxis: teamAverage, name: 'Média do time' }],
            },
          },
        ],
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranked, view, teamAverage, chart],
  )

  const withCapacity = ranked.filter((r) => (view === 'dev' ? r.dev.capacityAdherence : r.qa.capacityAdherence) !== null)
  const adherenceOption: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => `${value}%` },
        xAxis: chart.valueAxis({ axisLabel: { ...chart.textStyle, formatter: '{value}%' } }),
        yAxis: chart.categoryAxis(
          withCapacity.map((r) => r.person.nome),
          { inverse: true },
        ),
        series: [
          {
            name: 'Aderência',
            type: 'bar',
            data: withCapacity.map((r) => (view === 'dev' ? r.dev.capacityAdherence : r.qa.capacityAdherence)),
            itemStyle: { color: chart.palette[4], ...chart.paletteBorder },
            barMaxWidth: 20,
            markLine: {
              symbol: 'none',
              label: { color: chart.theme.text, formatter: '100%', position: 'insideEndTop' },
              lineStyle: { color: chart.theme.text, type: 'dashed' },
              data: [{ xAxis: 100, name: 'Capacity' }],
            },
          },
        ],
      }),
    [withCapacity, view, chart],
  )

  const devColumns = useMemo<ColumnDef<PersonSummaryRow, unknown>[]>(
    () => [
      { id: 'nome', header: 'Pessoa', accessorFn: (r) => r.person.nome },
      { id: 'cargo', header: 'Cargo', accessorFn: (r) => r.person.cargo },
      { id: 'delivered', header: 'SP entregues', accessorFn: (r) => r.dev.delivered, meta: { align: 'right', numeric: true } },
      { id: 'average', header: 'SP/sprint', accessorFn: (r) => r.dev.averagePerSprint, meta: { align: 'right', numeric: true } },
      { id: 'delayed', header: 'SP atrasados', accessorFn: (r) => r.dev.delayedPoints, meta: { align: 'right', numeric: true } },
      {
        id: 'delayedPercent',
        header: '% atraso',
        accessorFn: (r) => r.dev.delayedPercent,
        cell: ({ row }) => `${row.original.dev.delayedPercent}%`,
        meta: { align: 'right', numeric: true },
      },
      { id: 'capacity', header: 'Capacity', accessorFn: (r) => r.dev.capacity, meta: { align: 'right', numeric: true } },
      {
        id: 'adherence',
        header: 'Aderência',
        accessorFn: (r) => r.dev.capacityAdherence ?? -1,
        cell: ({ row }) => formatPercent(row.original.dev.capacityAdherence),
        meta: { align: 'right', numeric: true },
      },
      {
        id: 'overload',
        header: 'Acima do Max (SP)',
        accessorFn: (r) => r.dev.overloadPoints,
        cell: ({ row }) => (row.original.dev.overloadPoints > 0 ? row.original.dev.overloadPoints : '—'),
        meta: { align: 'right', numeric: true },
      },
      { id: 'open', header: 'Em aberto (SP)', accessorFn: (r) => r.dev.openPoints, meta: { align: 'right', numeric: true } },
    ],
    [],
  )

  const qaColumns = useMemo<ColumnDef<PersonSummaryRow, unknown>[]>(
    () => [
      { id: 'nome', header: 'Pessoa', accessorFn: (r) => r.person.nome },
      { id: 'cargo', header: 'Cargo', accessorFn: (r) => r.person.cargo },
      { id: 'executed', header: 'Executados', accessorFn: (r) => r.qa.executed, meta: { align: 'right', numeric: true } },
      {
        id: 'average',
        header: 'Testes/sprint',
        accessorFn: (r) => r.qa.averageExecutedPerSprint,
        meta: { align: 'right', numeric: true },
      },
      {
        id: 'passed',
        header: '% Passed',
        accessorFn: (r) => r.qa.passedPercent,
        cell: ({ row }) => `${row.original.qa.passedPercent}%`,
        meta: { align: 'right', numeric: true },
      },
      {
        id: 'failed',
        header: '% Failed',
        accessorFn: (r) => r.qa.failedPercent,
        cell: ({ row }) => `${row.original.qa.failedPercent}%`,
        meta: { align: 'right', numeric: true },
      },
      { id: 'testPoints', header: 'Test Points (SP)', accessorFn: (r) => r.qa.testPoints, meta: { align: 'right', numeric: true } },
      {
        id: 'adherence',
        header: 'Aderência',
        accessorFn: (r) => r.qa.capacityAdherence ?? -1,
        cell: ({ row }) => formatPercent(row.original.qa.capacityAdherence),
        meta: { align: 'right', numeric: true },
      },
      {
        id: 'overload',
        header: 'Acima do Max (SP)',
        accessorFn: (r) => r.qa.overloadPoints,
        cell: ({ row }) => (row.original.qa.overloadPoints > 0 ? row.original.qa.overloadPoints : '—'),
        meta: { align: 'right', numeric: true },
      },
      { id: 'testCases', header: 'Test Cases', accessorFn: (r) => r.qa.testCases, meta: { align: 'right', numeric: true } },
    ],
    [],
  )

  const sum = (pick: (r: PersonSummaryRow) => number) => round1(visible.reduce((total, r) => total + pick(r), 0))
  const delivered = sum((r) => r.dev.delivered)
  const delayed = sum((r) => r.dev.delayedPoints)
  const executed = sum((r) => r.qa.executed)

  return (
    <div className="flex flex-col gap-4">
      {view === 'dev' ? (
        <>
          <div className="flex justify-end">
            <SegmentedControl aria-label="Atribuição dos pontos" options={ATTRIBUTION_OPTIONS} value={mode} onChange={onModeChange} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <StatCard label="Pessoas" value={visible.length} info={INFO.people} />
            <StatCard
              label="SP entregues"
              value={delivered}
              hint={`${delayed} SP atrasados · ${percentOf(delayed, delivered)}%`}
              info={INFO.delivered}
            />
            <StatCard label="Média por pessoa" value={`${teamAverage} SP/sprint`} info={INFO.averageDev} />
            <StatCard
              label="Aderência do time"
              value={formatPercent(adherenceOf(visible.map((r) => r.dev)))}
              hint={`Capacity ${sum((r) => r.dev.capacity)} SP`}
              info={INFO.adherence}
            />
            <StatCard label="Em aberto" value={`${sum((r) => r.dev.openPoints)} SP`} info={INFO.open} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <StatCard label="Pessoas" value={visible.length} info={INFO.people} />
          <StatCard label="Testes executados" value={executed} info={INFO.executed} />
          <StatCard label="Média por pessoa" value={`${teamAverage} testes/sprint`} info={INFO.averageQa} />
          <StatCard
            label="% Passed do time"
            value={`${percentOf(sum((r) => r.qa.passed), executed)}%`}
            hint={`${sum((r) => r.qa.failed)} failed`}
            info={INFO.passed}
          />
          <StatCard
            label="Test Points"
            value={`${sum((r) => r.qa.testPoints)} SP`}
            hint={`Aderência do time: ${formatPercent(adherenceOf(visible.map((r) => r.qa)))}`}
            info={INFO.testPoints}
          />
        </div>
      )}

      <ChartCard
        title={view === 'dev' ? 'Story Points entregues por pessoa' : 'Testes executados por pessoa'}
        description={
          view === 'dev'
            ? 'SP fechados no período (no prazo + atrasados), de quem mais entregou para quem menos entregou.'
            : 'Resultados executados no período (passed/failed/outros), de quem mais executou para quem menos executou.'
        }
        isEmpty={ranked.length === 0}
        emptyMessage="Ninguém com entregas ou alocação nos filtros selecionados."
      >
        <ReactECharts option={rankingOption} style={{ height: rankingHeight }} notMerge />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={view === 'dev' ? 'Média de SP por sprint' : 'Média de testes por sprint'}
          description="Média de cada pessoa nas sprints em que entregou; a linha tracejada é a média do time."
          isEmpty={ranked.length === 0}
          emptyMessage="Sem dados nos filtros selecionados."
        >
          <ReactECharts option={averageOption} style={{ height: rankingHeight }} notMerge />
        </ChartCard>
        <ChartCard
          title="Aderência à capacity por pessoa"
          description="Entrega ÷ capacity nas sprints com alocação. A linha tracejada marca 100% (entregou o previsto)."
          isEmpty={withCapacity.length === 0}
          emptyMessage="Ninguém com alocação nos filtros selecionados."
        >
          <ReactECharts option={adherenceOption} style={{ height: Math.max(240, withCapacity.length * 28 + 80) }} notMerge />
        </ChartCard>
      </div>

      <ChartCard title="Pessoas" description="Clique numa pessoa para abrir o dashboard dela com os mesmos filtros.">
        <DataTable
          data={visible}
          columns={view === 'dev' ? devColumns : qaColumns}
          getRowId={(r) => r.person.id}
          onRowClick={(r) => onOpenPerson(r.person)}
          emptyMessage="Ninguém com entregas ou alocação nos filtros selecionados."
          pageResetKey={view}
        />
      </ChartCard>
    </div>
  )
}
