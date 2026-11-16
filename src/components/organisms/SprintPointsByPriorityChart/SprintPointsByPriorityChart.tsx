import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { SegmentedControl, type SegmentedOption } from '../../molecules/SegmentedControl/SegmentedControl'
import { useChartTheme } from '../../../hooks/useChartTheme'
import type { GroupPoints } from '../../../lib/azure/sprintMetrics'

type Measure = 'count' | 'storyPoints'

const MEASURE_OPTIONS: SegmentedOption<Measure>[] = [
  { value: 'count', label: 'Quantidade' },
  { value: 'storyPoints', label: 'Story Points' },
]

export interface SprintPointsByPriorityChartProps {
  byPriority: GroupPoints[]
}

interface BarTooltipParams {
  dataIndex: number
}

/** Itens de pontos da sprint pelo campo "Prioridade", alternando entre quantidade de itens e story points. */
export function SprintPointsByPriorityChart({ byPriority }: SprintPointsByPriorityChartProps) {
  const chart = useChartTheme()
  const [measure, setMeasure] = useState<Measure>('count')

  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const [first] = params as BarTooltipParams[]
            const group = byPriority[first.dataIndex]
            return `${group.key}<br/>${group.count} item(ns) · ${group.storyPoints} SP`
          },
        },
        xAxis: chart.categoryAxis(byPriority.map((group) => group.key)),
        yAxis: chart.valueAxis({ name: measure === 'count' ? 'Itens' : 'SP' }),
        series: [
          {
            name: measure === 'count' ? 'Quantidade' : 'Story Points',
            type: 'bar',
            data: byPriority.map((group) => group[measure]),
            itemStyle: { color: chart.palette[measure === 'count' ? 3 : 0], ...chart.paletteBorder },
            label: { show: true, position: 'top', color: chart.theme.text },
            barMaxWidth: 48,
          },
        ],
      }),
    [byPriority, measure, chart],
  )

  return (
    <ChartCard
      title={measure === 'count' ? 'Itens por Prioridade' : 'Story Points por Prioridade'}
      description="Itens que somam pontos, agrupados pelo campo Prioridade do Azure."
      actions={<SegmentedControl aria-label="Medida do gráfico de prioridade" options={MEASURE_OPTIONS} value={measure} onChange={setMeasure} />}
      isEmpty={byPriority.length === 0}
      emptyMessage="Nenhum item de pontos nesta sprint."
    >
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </ChartCard>
  )
}
