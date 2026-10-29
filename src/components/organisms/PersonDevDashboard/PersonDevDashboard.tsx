import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnDef } from '@tanstack/react-table'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { SegmentedControl } from '../../molecules/SegmentedControl/SegmentedControl'
import { Checkbox } from '../../atoms/Checkbox/Checkbox'
import { Chip } from '../../atoms/Chip/Chip'
import { DataTable } from '../DataTable/DataTable'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import { CLOSED_STATES } from '../../../lib/workItems'
import {
  DELAY_REASON_LABEL,
  sizeDistribution,
  type DevAttribution,
  type PersonDevItem,
  type PersonDevMetrics,
} from '../../../lib/personMetrics'

const ATTRIBUTION_OPTIONS: { value: DevAttribution; label: string }[] = [
  { value: 'assigned', label: 'Assigned To' },
  { value: 'tasks', label: 'Rateio por Tasks' },
]

// Explicação resumida de cada card (tooltip ⓘ).
const INFO = {
  delivered:
    'Soma dos story points dos itens fechados (Closed/Done) da pessoa nas sprints do filtro, no prazo e atrasados. No Rateio por Tasks, conta só a fatia dela.',
  average:
    'SP entregues ÷ sprints em que a pessoa entregou algo (sprints sem entrega não entram). A média do time é a dos outros devs que dividem squad com ela.',
  averageDelayed:
    'SP atrasados ÷ sprints com entrega (sprint sem atraso conta 0). Atrasado = tag Delayed (conta na sprint da tag) ou fechado depois do fim da sprint planejada.',
  adherence:
    'SP entregues ÷ capacity × 100, só nas sprints em que a pessoa tem alocação (as outras não entram). Capacity = dias alocados (% × dias válidos) × capacity points/dia do nível atual, somada em todas as squads.',
  open: 'Itens da pessoa que ainda não estão Closed/Done nas sprints do filtro e os story points deles.',
  mix: 'Tipo de item com mais SP entregues; abaixo, os SP entregues por tipo (User Story, Bug, Enabler).',
}

export interface PersonDevDashboardProps {
  metrics: PersonDevMetrics
  /** Média de SP/sprint das outras pessoas Dev das squads da pessoa. */
  peerAverage: number
  mode: DevAttribution
  onModeChange: (mode: DevAttribution) => void
  onOpenItem: (item: PersonDevItem) => void
}

export function PersonDevDashboard({ metrics, peerAverage, mode, onModeChange, onOpenItem }: PersonDevDashboardProps) {
  const chart = useChartTheme()
  const [onlyDelayed, setOnlyDelayed] = useState(false)
  const { sprints } = metrics

  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(sprints.map((s) => s.label)),
        yAxis: chart.valueAxis(),
        series: [
          {
            name: 'No prazo',
            type: 'bar',
            stack: 'delivered',
            data: sprints.map((s) => s.onTime),
            itemStyle: { color: chart.palette[0], ...chart.paletteBorder },
            barMaxWidth: 40,
            markLine: {
              symbol: 'none',
              // Dentro da área do gráfico: na ponta direita padrão o rótulo era cortado.
              label: { color: chart.theme.text, formatter: 'Média: {c}', position: 'insideEndTop' },
              lineStyle: { color: chart.palette[0], type: 'dashed' },
              data: [{ yAxis: metrics.averagePerSprint, name: 'Média' }],
            },
          },
          {
            name: 'Atrasados',
            type: 'bar',
            stack: 'delivered',
            data: sprints.map((s) => s.delayed),
            itemStyle: {
              color: chart.palette[5],
              ...chart.paletteBorder,
              decal: { symbol: 'line', dashArrayX: [4, 2], rotation: Math.PI / 4 },
            },
            barMaxWidth: 40,
            // Última série da pilha: o rótulo no topo mostra o total entregue na sprint.
            label: {
              show: true,
              position: 'top',
              color: chart.theme.textH,
              fontWeight: 'bold',
              formatter: ({ dataIndex }: { dataIndex: number }) => {
                const total = round1(sprints[dataIndex].onTime + sprints[dataIndex].delayed)
                return total > 0 ? String(total) : ''
              },
            },
          },
          {
            name: 'Capacity (Alocação)',
            type: 'line',
            // null = sem alocação na sprint: sem ponto, em vez de puxar a linha para 0.
            data: sprints.map((s) => (s.capacity > 0 ? s.capacity : null)),
            itemStyle: { color: chart.palette[2] },
            symbol: 'circle',
          },
          {
            name: 'Max (Alocação)',
            type: 'line',
            data: sprints.map((s) => (s.max > 0 ? s.max : null)),
            itemStyle: { color: chart.palette[4] },
            lineStyle: { type: 'dashed' },
            symbol: 'triangle',
          },
        ],
      }),
    [sprints, metrics.averagePerSprint, chart],
  )

  // Só as sprints com entrega: as que têm apenas alocação ficariam com o grupo vazio.
  const squadOption: EChartsOption = useMemo(() => {
    const delivered = sprints.filter((s) => s.onTime + s.delayed > 0)
    return chart.baseOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, type: 'scroll', textStyle: chart.textStyle },
      xAxis: chart.categoryAxis(delivered.map((s) => s.label)),
      yAxis: chart.valueAxis(),
      series: metrics.squadNames.map((squad, index) => ({
        name: squad,
        type: 'bar',
        data: delivered.map((s) => s.bySquad[squad] ?? 0),
        itemStyle: { color: chart.palette[index % chart.palette.length], ...chart.paletteBorder },
        barMaxWidth: 28,
      })),
    })
  }, [sprints, metrics.squadNames, chart])

  const deliveredSprints = useMemo(() => sprints.filter((s) => s.onTime + s.delayed > 0), [sprints])

  const typeOption: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, type: 'scroll', textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(deliveredSprints.map((s) => s.label)),
        yAxis: chart.valueAxis(),
        series: metrics.byType.map(({ type }, index) => ({
          name: type,
          type: 'bar',
          stack: 'type',
          data: deliveredSprints.map((s) => s.byType[type] ?? 0),
          itemStyle: { color: chart.palette[index % chart.palette.length], ...chart.paletteBorder },
          barMaxWidth: 40,
        })),
      }),
    [deliveredSprints, metrics.byType, chart],
  )

  // Acumulado sprint a sprint: mostra se a entrega acompanha a capacity ao longo do tempo.
  const cumulativeOption: EChartsOption = useMemo(() => {
    const points = sprints.reduce<{ delivered: number; capacity: number }[]>((acc, s) => {
      const previous = acc[acc.length - 1] ?? { delivered: 0, capacity: 0 }
      return [...acc, { delivered: round1(previous.delivered + s.onTime + s.delayed), capacity: round1(previous.capacity + s.capacity) }]
    }, [])
    return chart.baseOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: chart.textStyle },
      xAxis: chart.categoryAxis(sprints.map((s) => s.label)),
      yAxis: chart.valueAxis(),
      series: [
        {
          name: 'Entregue (acumulado)',
          type: 'line',
          data: points.map((p) => p.delivered),
          itemStyle: { color: chart.palette[0] },
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.15 },
          symbol: 'circle',
        },
        {
          name: 'Capacity (acumulada)',
          type: 'line',
          data: points.map((p) => p.capacity),
          itemStyle: { color: chart.palette[2] },
          lineStyle: { type: 'dashed' },
          symbol: 'none',
        },
      ],
    })
  }, [sprints, chart])

  const sizes = useMemo(() => sizeDistribution(metrics.items), [metrics.items])
  const sizeOption: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: chart.categoryAxis(sizes.map((s) => s.bucket), { name: 'SP do item', nameLocation: 'middle', nameGap: 28 }),
        yAxis: chart.valueAxis({ minInterval: 1 }),
        series: [
          {
            name: 'Itens entregues',
            type: 'bar',
            data: sizes.map((s) => s.count),
            itemStyle: { color: chart.palette[3], ...chart.paletteBorder },
            barMaxWidth: 40,
            label: { show: true, position: 'top', color: chart.theme.text, formatter: ({ dataIndex }: { dataIndex: number }) => (sizes[dataIndex].count ? String(sizes[dataIndex].count) : '') },
          },
        ],
      }),
    [sizes, chart],
  )

  const columns = useMemo<ColumnDef<PersonDevItem, unknown>[]>(
    () => [
      { id: 'id', header: 'ID', accessorFn: (item) => item.row.id, meta: { align: 'right', headerAlign: 'left', numeric: true } },
      { id: 'type', header: 'Tipo', accessorFn: (item) => item.row.workItemType },
      { id: 'title', header: 'Título', accessorFn: (item) => item.row.title },
      { id: 'state', header: 'Estado', accessorFn: (item) => item.row.state },
      {
        id: 'points',
        header: mode === 'tasks' ? 'SP (fatia)' : 'SP',
        accessorFn: (item) => item.points,
        cell: ({ row }) =>
          row.original.share < 1 ? `${round1(row.original.points)} de ${row.original.row.storyPoints}` : row.original.points,
        meta: { align: 'right', numeric: true },
      },
      { id: 'planned', header: 'Sprint planejada', accessorFn: (item) => item.delay.plannedSprint },
      { id: 'delivery', header: 'Sprint de entrega', accessorFn: (item) => item.delay.deliverySprint },
      {
        id: 'daysLate',
        header: 'Dias de atraso',
        accessorFn: (item) => item.delay.daysLate ?? -1,
        cell: ({ row }) => row.original.delay.daysLate ?? '—',
        meta: { align: 'right', numeric: true },
      },
      {
        id: 'delay',
        header: 'Atraso',
        accessorFn: (item) => (item.delay.reason ? DELAY_REASON_LABEL[item.delay.reason] : ''),
        cell: ({ row }) => (row.original.delay.reason ? <Chip label={DELAY_REASON_LABEL[row.original.delay.reason]} /> : null),
      },
    ],
    [mode],
  )

  const tableItems = onlyDelayed ? metrics.items.filter((item) => item.delay.delayed) : metrics.items
  const capacityHint =
    metrics.allocatedSprints > 0
      ? `${metrics.deliveredOnAllocatedSprints} SP em ${metrics.allocatedSprints} sprint(s) com alocação · capacity ${metrics.capacity} SP`
      : 'Sem alocação nas sprints'
  const comparison = peerAverage > 0 ? `Média do time: ${peerAverage} SP/sprint` : 'Sem outros devs para comparar'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--text)]">
          {mode === 'assigned'
            ? 'Pontos dos User Stories/Bugs/Enablers com a pessoa no Assigned To.'
            : 'Pontos de cada item divididos pelo Effort das Tasks filhas de cada pessoa (sem Tasks, vale o Assigned To).'}
        </p>
        <SegmentedControl aria-label="Atribuição dos pontos" options={ATTRIBUTION_OPTIONS} value={mode} onChange={onModeChange} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="SP entregues" info={INFO.delivered} value={metrics.delivered} hint={`${metrics.itemsDelivered} item(ns) fechados`} />
        <StatCard label="Média de entrega" info={INFO.average} value={`${metrics.averagePerSprint} SP/sprint`} hint={comparison} />
        <StatCard
          label="Média de SP atrasados" info={INFO.averageDelayed}
          value={`${metrics.averageDelayedPerSprint} SP/sprint`}
          hint={`${metrics.delayedPoints} SP atrasados · ${metrics.delayedPercent}% do entregue`}
        />
        <StatCard
          label="Aderência à capacity" info={INFO.adherence}
          value={metrics.capacityAdherence === null ? '—' : `${metrics.capacityAdherence}%`}
          hint={capacityHint}
        />
        <StatCard label="Em aberto" info={INFO.open} value={`${metrics.openPoints} SP`} hint={`${metrics.itemsOpen} item(ns) não fechados`} />
        <StatCard
          label="Mix entregue" info={INFO.mix}
          value={metrics.byType[0]?.type ?? '—'}
          hint={metrics.byType.map((t) => `${t.type}: ${t.points}`).join(' · ') || 'Nada entregue'}
        />
      </div>

      <ChartCard
        title="Story Points entregues por sprint"
        description="Pela coluna Sprint, como no Dashboard por Squad: itens com tag Delayed contam como atrasados na sprint da tag (a planejada). Linhas: capacity/max da pessoa na Alocação."
        isEmpty={sprints.length === 0}
        emptyMessage="Nenhuma entrega ou alocação nas sprints selecionadas."
      >
        <ReactECharts option={option} style={{ height: 320 }} notMerge />
      </ChartCard>

      <ChartCard
        title="Story Points entregues por sprint e squad"
        description="SP fechados pela pessoa (no prazo + atrasados), uma barra por squad. A squad vem do Iteration Path do item."
        isEmpty={metrics.squadNames.length === 0}
        emptyMessage="Nenhuma entrega nas sprints selecionadas."
      >
        <ReactECharts option={squadOption} style={{ height: 320 }} notMerge />
      </ChartCard>

      <ChartCard
        title="Story Points entregues por tipo e sprint"
        description="SP fechados por Work Item Type (User Story, Bug, Enabler…) em cada sprint."
        isEmpty={deliveredSprints.length === 0}
        emptyMessage="Nenhuma entrega nas sprints selecionadas."
      >
        <ReactECharts option={typeOption} style={{ height: 320 }} notMerge />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Entrega × capacity acumuladas"
          description="Soma sprint a sprint do que foi entregue e da capacity da Alocação. Entrega acima da linha = acima do previsto."
          isEmpty={sprints.length === 0}
          emptyMessage="Nenhuma entrega ou alocação nas sprints selecionadas."
        >
          <ReactECharts option={cumulativeOption} style={{ height: 300 }} notMerge />
        </ChartCard>

        <ChartCard
          title="Tamanho dos itens entregues"
          description="Quantidade de itens fechados por faixa de story points (do item inteiro). Muitos itens grandes ou sem SP merecem atenção."
          isEmpty={metrics.itemsDelivered === 0}
          emptyMessage="Nenhum item entregue nas sprints selecionadas."
        >
          <ReactECharts option={sizeOption} style={{ height: 300 }} notMerge />
        </ChartCard>
      </div>

      <ChartCard title="Itens" description="Clique num item para ver o detalhe e buscar o histórico no Azure.">
        <DataTable
          data={tableItems}
          columns={columns}
          getRowId={(item) => String(item.row.id)}
          onRowClick={onOpenItem}
          getRowClassName={(item) => (CLOSED_STATES.has(item.row.state) ? undefined : 'opacity-70')}
          emptyMessage={onlyDelayed ? 'Nenhum item atrasado.' : 'Nenhum item desta pessoa.'}
          pageResetKey={String(onlyDelayed)}
          toolbar={
            <label className="flex items-center gap-2 text-sm text-[var(--text-h)]">
              <Checkbox checked={onlyDelayed} onChange={(e) => setOnlyDelayed(e.target.checked)} />
              Só atrasados
            </label>
          }
        />
      </ChartCard>
    </div>
  )
}
