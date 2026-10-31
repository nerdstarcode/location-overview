import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { graphic, type CustomSeriesRenderItemAPI, type CustomSeriesRenderItemParams, type EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { formatDateBR } from '../../../lib/dates'
import {
  EVOLUTION_STAGES,
  FLOW_STAGE_LABEL,
  FLOW_STAGE_STATE,
  stageSummary,
  type FlowStage,
  type ItemTimeline,
} from '../../../lib/stateFlow'
import type { WorkItemRow } from '../../../lib/workItems'

const STAGES: FlowStage[] = ['active', 'testingQa', 'testingProd', 'onHold', 'fail', 'other']
const DONE_SERIES = 'Done / Closed'
/** Altura de cada item no gráfico; acima de MAX_VISIBLE itens, rola com o controle lateral. */
const ROW_HEIGHT = 26
const MAX_VISIBLE = 15
const TITLE_MAX = 32

const INFO = {
  stage: 'Média de dias úteis no estado, somando as passagens (ex.: voltou de Fail para Active), só dos itens que passaram por ele. O tempo em On Hold não entra.',
  cycle: 'Do primeiro Active até chegar em Done/Closed, em dias úteis, descontando o tempo em On Hold. Só itens que terminaram.',
  onHold: 'Dias úteis em On Hold somados de todos os itens; abaixo, a média por item que passou por On Hold.',
}

const shortTitle = (row: WorkItemRow) => {
  const title = row.title.length > TITLE_MAX ? `${row.title.slice(0, TITLE_MAX - 1)}…` : row.title
  return `#${row.id} ${title}`
}
const days = (value: number | null) => (value === null ? '—' : `${value} ${value === 1 ? 'dia' : 'dias'}`)

export interface ItemStateTimelineProps {
  timelines: ItemTimeline[]
  onOpenItem?: (row: WorkItemRow) => void
  title?: string
}

// Linha do tempo por item (Gantt): cada item numa linha, com os trechos em Active → Testing QA →
// Testing Prod e o ponto de Done/Closed; On Hold, Fail e outros estados com cores próprias. Acima,
// cards com a média de dias úteis em cada etapa (sem o On Hold) e o On Hold à parte.
export function ItemStateTimeline({ timelines, onOpenItem, title = 'Evolução por item' }: ItemStateTimelineProps) {
  const chart = useChartTheme()
  const summary = useMemo(() => stageSummary(timelines), [timelines])
  const colors = useMemo(() => {
    const list = chart.stateColors([...STAGES.map((stage) => FLOW_STAGE_STATE[stage]), 'Closed'])
    return { ...(Object.fromEntries(STAGES.map((stage, index) => [stage, list[index]])) as Record<FlowStage, string>), done: list[STAGES.length] }
  }, [chart])

  const option: EChartsOption = useMemo(() => {
    const labels = timelines.map((t) => shortTitle(t.row))
    const renderItem = (params: CustomSeriesRenderItemParams, api: CustomSeriesRenderItemAPI) => {
      const index = api.value(0) as number
      const start = api.coord([api.value(1), index])
      const end = api.coord([api.value(2), index])
      const height = (api.size?.([0, 1]) as number[])[1] * 0.6
      const coordSys = params.coordSys as unknown as { x: number; y: number; width: number; height: number }
      // Mínimo de 3px: trechos no mesmo dia continuam visíveis.
      const shape = graphic.clipRectByRect(
        { x: start[0], y: start[1] - height / 2, width: Math.max(end[0] - start[0], 3), height },
        { x: coordSys.x, y: coordSys.y, width: coordSys.width, height: coordSys.height },
      )
      return shape ? { type: 'rect' as const, shape, style: { fill: api.visual('color') as string } } : null
    }
    const scroll = timelines.length > MAX_VISIBLE
    return chart.baseOption({
      grid: { left: 8, right: scroll ? 40 : 16, top: 40, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'item',
        formatter: (raw: unknown) => {
          const p = raw as { seriesName: string; marker: string; value: [number, number, number, string, number, boolean] }
          const timeline = timelines[p.value[0]]
          if (!timeline) return ''
          const head = `<b>#${timeline.row.id}</b> ${timeline.row.title}`
          if (p.seriesName === DONE_SERIES) return `${head}<br/>${p.marker} Done/Closed em ${formatDateBR(timeline.doneAt)}`
          const [, start, end, state, businessDays, open] = p.value
          const until = open ? 'hoje (ainda no estado)' : formatDateBR(new Date(end).toISOString())
          return `${head}<br/>${p.marker} ${state}: ${formatDateBR(new Date(start).toISOString())} → ${until} · <b>${businessDays} dia(s) úteis</b>`
        },
      },
      legend: { top: 0, type: 'scroll', textStyle: chart.textStyle },
      xAxis: { type: 'time', axisLabel: { ...chart.textStyle, hideOverlap: true }, axisLine: chart.axisLine, splitLine: chart.splitLine },
      yAxis: { type: 'category', data: labels, inverse: true, axisLabel: chart.textStyle, axisLine: chart.axisLine },
      dataZoom: scroll ? [{ type: 'slider', yAxisIndex: 0, right: 8, width: 16, startValue: 0, endValue: MAX_VISIBLE - 1, filterMode: 'weakFilter' }] : [],
      series: [
        ...STAGES.map((stage) => ({
          name: FLOW_STAGE_LABEL[stage],
          type: 'custom' as const,
          renderItem,
          itemStyle: { color: colors[stage] },
          encode: { x: [1, 2], y: 0 },
          data: timelines.flatMap((t, index) =>
            t.segments
              .filter((s) => s.stage === stage)
              .map((s) => [index, Date.parse(s.start), Date.parse(s.end), s.state, s.days, s.open]),
          ),
        })),
        {
          name: DONE_SERIES,
          type: 'scatter' as const,
          symbol: 'diamond',
          symbolSize: 12,
          itemStyle: { color: colors.done, borderColor: chart.theme.textH, borderWidth: 1 },
          data: timelines.flatMap((t, index) => (t.doneAt ? [[Date.parse(t.doneAt), index]] : [])),
        },
      ],
    })
  }, [chart, timelines, colors])

  const chartHeight = Math.min(timelines.length, MAX_VISIBLE) * ROW_HEIGHT + 90
  const onEvents = useMemo(
    () => ({
      click: (params: { seriesName: string; value: unknown }) => {
        const value = params.value as number[]
        const index = params.seriesName === DONE_SERIES ? value[1] : value[0]
        const timeline = timelines[index]
        if (timeline && onOpenItem) onOpenItem(timeline.row)
      },
    }),
    [timelines, onOpenItem],
  )

  return (
    <ChartCard
      title={title}
      description="Passagem do tempo de cada item desde o primeiro Active: Active → Testing QA → Testing Prod → Done/Closed (◆). On Hold, Fail e outros estados aparecem com cores próprias. Passe o mouse para ver datas e dias úteis; clique para abrir o item."
      isEmpty={timelines.length === 0}
      emptyMessage="Nenhum item com histórico de estados a partir do Active."
    >
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {EVOLUTION_STAGES.map((stage) => (
          <StatCard
            key={stage}
            label={`Em ${FLOW_STAGE_LABEL[stage]}`}
            info={INFO.stage}
            value={days(summary.stages[stage].avgDays)}
            hint={`Média de ${summary.stages[stage].items} de ${summary.items} itens`}
          />
        ))}
        <StatCard label="Ciclo até Done (sem On Hold)" info={INFO.cycle} value={days(summary.cycle.avgDays)} hint={`Média de ${summary.cycle.items} item(ns) concluído(s)`} />
        <StatCard
          label="On Hold"
          info={INFO.onHold}
          value={days(summary.onHold.totalDays)}
          hint={summary.onHold.items > 0 ? `${summary.onHold.items} item(ns) · média ${days(summary.onHold.avgDays)}` : 'Nenhum item em On Hold'}
        />
        <StatCard label="Idas a Fail" value={summary.fails.total} hint={`Em ${summary.fails.items} item(ns)`} />
      </div>
      <ReactECharts option={option} style={{ height: chartHeight }} notMerge onEvents={onEvents} />
    </ChartCard>
  )
}
