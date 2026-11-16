import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import type { PersonStatePoints, StoryTests } from '../../../lib/azure/dailyView'

/** SP do team atual por pessoa, empilhados por State. */
export function DailyPointsByPersonChart({ data, states }: { data: PersonStatePoints[]; states: string[] }) {
  const chart = useChartTheme()
  const option: EChartsOption = useMemo(() => {
    const colors = chart.stateColors(states)
    return chart.baseOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, textStyle: chart.textStyle },
      xAxis: chart.categoryAxis(data.map((p) => p.name), { axisLabel: { ...chart.textStyle, interval: 0, rotate: data.length > 6 ? 30 : 0 } }),
      yAxis: chart.valueAxis({ name: 'SP' }),
      series: states.map((state, index) => ({
        name: state,
        type: 'bar' as const,
        stack: 'sp',
        barMaxWidth: 48,
        data: data.map((p) => p.byState[state] ?? 0),
        itemStyle: { color: colors[index], ...chart.paletteBorder },
        label: { show: true, color: '#fff', formatter: (p: { value: unknown }) => (Number(p.value) > 0 ? String(p.value) : '') },
      })),
    })
  }, [data, states, chart])
  return (
    <ChartCard
      title="Story Points por pessoa e State"
      description="Distribuição dos SP da sprint (team atual) por responsável, empilhados pelo State de cada item."
      isEmpty={data.length === 0}
      emptyMessage="Nenhum item de pontos nesta sprint."
    >
      <ReactECharts option={option} style={{ height: 320 }} notMerge />
    </ChartCard>
  )
}

/** Execuções de teste por US, empilhadas por quem executou. */
export function DailyTestsByStoryChart({ data }: { data: StoryTests[] }) {
  const chart = useChartTheme()
  const testers = useMemo(() => [...new Set(data.flatMap((s) => s.byTester.map((t) => t.name)))], [data])
  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const story = data[(params as { dataIndex: number }[])[0].dataIndex]
            const lines = story.byTester.map((t) => `${t.name}: ${t.executed} (${t.passed} passed · ${t.failed} failed)`)
            return [`#${story.row.id} ${story.row.title}`, ...lines, `Total: ${story.total.executed}`].join('<br/>')
          },
        },
        legend: { top: 0, textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(data.map((s) => `#${s.row.id}`), { axisLabel: { ...chart.textStyle, interval: 0, rotate: data.length > 8 ? 45 : 0 } }),
        yAxis: chart.valueAxis({ name: 'Execuções' }),
        series: testers.map((name, index) => ({
          name,
          type: 'bar' as const,
          stack: 'tests',
          barMaxWidth: 40,
          data: data.map((s) => s.byTester.find((t) => t.name === name)?.executed ?? 0),
          itemStyle: { color: chart.palette[index % chart.palette.length], ...chart.paletteBorder },
        })),
      }),
    [data, testers, chart],
  )
  return (
    <ChartCard
      title="Testes executados por US"
      description="Execuções dos Test Cases ligados (Tested By) a cada US e às tasks dela nesta sprint, por quem executou. Vem das execuções salvas na base local."
      isEmpty={data.every((s) => s.total.executed === 0)}
      emptyMessage="Nenhuma execução de teste salva para esta sprint (salve a sprint na base para trazer os test results)."
    >
      <ReactECharts option={option} style={{ height: 340 }} notMerge />
    </ChartCard>
  )
}
