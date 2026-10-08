import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { formatDayMonth } from '../../../lib/dates'
import type { BurnupPoint } from '../../../lib/azure/sprintMetrics'

export interface SprintBurnupChartProps {
  points: BurnupPoint[]
}

export function SprintBurnupChart({ points }: SprintBurnupChartProps) {
  const chart = useChartTheme()

  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(points.map((p) => formatDayMonth(p.day))),
        yAxis: chart.valueAxis(),
        series: [
          {
            name: 'Entregues no dia',
            type: 'bar',
            data: points.map((p) => p.delivered),
            itemStyle: { color: chart.palette[1], ...chart.paletteBorder },
            barMaxWidth: 28,
          },
          {
            name: 'Entregues (acumulado)',
            type: 'line',
            data: points.map((p) => p.cumulative),
            itemStyle: { color: chart.palette[2] },
            lineStyle: { width: 3 },
            symbol: 'circle',
          },
          {
            name: 'Ideal',
            type: 'line',
            data: points.map((p) => p.ideal),
            itemStyle: { color: chart.theme.text },
            lineStyle: { type: 'dashed' },
            symbol: 'none',
          },
          {
            name: 'Escopo',
            type: 'line',
            data: points.map((p) => p.scope),
            itemStyle: { color: chart.palette[5] },
            lineStyle: { type: 'dotted' },
            symbol: 'none',
          },
        ],
      }),
    [points, chart],
  )

  return (
    <ChartCard
      title="Story Points entregues por dia"
      description="Itens fechados (Closed/Done) pela data de fechamento; fins de semana e days off do team entram no próximo dia útil."
      isEmpty={points.length === 0}
      emptyMessage="A sprint não tem datas de início/fim configuradas."
    >
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </ChartCard>
  )
}
