import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import type { GroupPoints } from '../../../lib/azure/sprintMetrics'

export interface SprintPointsByStateChartProps {
  byState: GroupPoints[]
}

interface PieTooltipParams {
  name: string
  value: number
  percent: number
  dataIndex: number
}

export function SprintPointsByStateChart({ byState }: SprintPointsByStateChartProps) {
  const chart = useChartTheme()

  const option: EChartsOption = useMemo(() => {
    const colors = chart.stateColors(byState.map((state) => state.key))
    return chart.baseOption({
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            const { name, value, percent, dataIndex } = params as PieTooltipParams
            return `${name}<br/>${value} SP (${percent}%) · ${byState[dataIndex].count} item(ns)`
          },
        },
        legend: { bottom: 0, textStyle: chart.textStyle },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            data: byState.map((state, index) => ({
              name: state.key,
              value: state.storyPoints,
              itemStyle: { color: colors[index], ...chart.paletteBorder },
            })),
            label: { color: chart.theme.text, formatter: '{b}: {c}' },
          },
        ],
      })
  }, [byState, chart])

  return (
    <ChartCard title="Story Points por State" isEmpty={byState.length === 0} emptyMessage="Nenhum item com story points nesta sprint.">
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </ChartCard>
  )
}
