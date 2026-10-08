import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import type { PersonPoints } from '../../../lib/azure/sprintMetrics'

export interface SprintPointsByPersonProps {
  people: PersonPoints[]
  unassigned: PersonPoints
  totalPoints: number
}

const BAR_HEIGHT = 32

export function SprintPointsByPerson({ people, unassigned, totalPoints }: SprintPointsByPersonProps) {
  const chart = useChartTheme()
  const rows = useMemo(() => (unassigned.itemCount > 0 ? [...people, unassigned] : people), [people, unassigned])

  const option: EChartsOption = useMemo(() => {
    // Barras horizontais: o echarts desenha a primeira categoria embaixo, então invertemos para o maior ficar no topo.
    const ordered = [...rows].reverse()
    const barStyle = (color: string) => ({ itemStyle: { color, ...chart.paletteBorder }, stack: 'sp', barMaxWidth: 24 })
    return chart.baseOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: chart.textStyle },
      xAxis: chart.valueAxis(),
      yAxis: chart.categoryAxis(ordered.map((p) => p.name)),
      series: [
        { name: 'Entregues', type: 'bar', data: ordered.map((p) => p.deliveredPoints), ...barStyle(chart.palette[2]) },
        {
          name: 'Em aberto',
          type: 'bar',
          data: ordered.map((p) => round1(p.storyPoints - p.deliveredPoints)),
          ...barStyle(chart.palette[0]),
          label: { show: true, position: 'right', color: chart.theme.text, formatter: ({ dataIndex }) => String(ordered[dataIndex].storyPoints) },
        },
      ],
    })
  }, [rows, chart])

  return (
    <ChartCard
      title="Story Points por pessoa"
      description={`${totalPoints} SP na sprint · ${unassigned.storyPoints} SP sem responsável (${unassigned.itemCount} item(ns))`}
      isEmpty={rows.length === 0}
      emptyMessage="Nenhum item com story points nesta sprint."
    >
      <ReactECharts option={option} style={{ height: Math.max(220, rows.length * BAR_HEIGHT + 60) }} notMerge />
    </ChartCard>
  )
}
