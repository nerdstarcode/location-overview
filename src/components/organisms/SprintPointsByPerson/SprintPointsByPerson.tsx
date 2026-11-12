import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { stateRank } from '../../../lib/stateColors'
import type { PersonPoints } from '../../../lib/azure/sprintMetrics'

export interface SprintPointsByPersonProps {
  people: PersonPoints[]
  unassigned: PersonPoints
  totalPoints: number
}

const BAR_HEIGHT = 32

// SP de cada pessoa empilhados por State, na ordem do fluxo (New → … → Closed), para ver o andamento.
export function SprintPointsByPerson({ people, unassigned, totalPoints }: SprintPointsByPersonProps) {
  const chart = useChartTheme()
  const rows = useMemo(() => (unassigned.itemCount > 0 ? [...people, unassigned] : people), [people, unassigned])

  const option: EChartsOption = useMemo(() => {
    // Barras horizontais: o echarts desenha a primeira categoria embaixo, então invertemos para o maior ficar no topo.
    const ordered = [...rows].reverse()
    const states = [...new Set(rows.flatMap((p) => Object.keys(p.byState ?? {})))].sort(
      (a, b) => stateRank(a) - stateRank(b) || a.localeCompare(b),
    )
    const colors = chart.stateColors(states)
    return chart.baseOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: chart.textStyle },
      xAxis: chart.valueAxis(),
      yAxis: chart.categoryAxis(ordered.map((p) => p.name)),
      series: states.map((state, index) => ({
        name: state,
        type: 'bar',
        stack: 'sp',
        barMaxWidth: 24,
        itemStyle: { color: colors[index], ...chart.paletteBorder },
        data: ordered.map((p) => p.byState?.[state] ?? 0),
        // Total no fim da barra (só na última série da pilha).
        ...(index === states.length - 1
          ? { label: { show: true, position: 'right', color: chart.theme.text, formatter: ({ dataIndex }: { dataIndex: number }) => String(ordered[dataIndex].storyPoints) } }
          : {}),
      })),
    })
  }, [rows, chart])

  return (
    <ChartCard
      title="Story Points por pessoa"
      description={`${totalPoints} SP na sprint · ${unassigned.storyPoints} SP sem responsável (${unassigned.itemCount} item(ns)) · andamento por status`}
      isEmpty={rows.length === 0}
      emptyMessage="Nenhum item com story points nesta sprint."
    >
      <ReactECharts option={option} style={{ height: Math.max(220, rows.length * BAR_HEIGHT + 60) }} notMerge />
    </ChartCard>
  )
}
