import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { formatDayMonth } from '../../../lib/dates'
import type { TestRunsSummary } from '../../../lib/azure/mappers'

export interface SprintTestRunsSummaryProps {
  summary: TestRunsSummary
  workingDays: string[]
}

export function SprintTestRunsSummary({ summary, workingDays }: SprintTestRunsSummaryProps) {
  const chart = useChartTheme()

  const option: EChartsOption = useMemo(() => {
    // Runs em fim de semana também aparecem, mesmo fora dos dias úteis.
    const days = [...new Set([...workingDays, ...Object.keys(summary.runsByDay)])].sort()
    return chart.baseOption({
      tooltip: { trigger: 'axis' },
      xAxis: chart.categoryAxis(days.map(formatDayMonth)),
      yAxis: chart.valueAxis({ minInterval: 1 }),
      series: [
        {
          name: 'Execuções',
          type: 'bar',
          data: days.map((day) => summary.runsByDay[day] ?? 0),
          itemStyle: { color: chart.palette[6], ...chart.paletteBorder },
          barMaxWidth: 28,
        },
      ],
    })
  }, [workingDays, summary.runsByDay, chart])

  return (
    <ChartCard title="Execuções de testes na sprint" description="Test Runs iniciados entre o início e o fim da sprint (projeto inteiro).">
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Execuções (runs)" value={summary.runCount} hint={`${summary.automatedRuns} automatizadas · ${summary.manualRuns} manuais`} />
        <StatCard label="Testes executados" value={summary.totalTests} />
        <StatCard label="Passed" value={summary.passed} />
        <StatCard label="Failed" value={summary.failed} />
        <StatCard label="Not run" value={summary.notRun} />
        <StatCard label="Not applicable" value={summary.notApplicable} />
      </div>
      {summary.runCount > 0 && <ReactECharts option={option} style={{ height: 260 }} notMerge />}
    </ChartCard>
  )
}
