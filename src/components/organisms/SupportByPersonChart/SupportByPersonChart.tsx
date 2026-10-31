import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import { supportTotalsByPerson, type SprintSupport } from '../../../lib/supportMetrics'

export interface SupportByPersonChartProps {
  /** Sprints das métricas da pessoa, em ordem; só as que têm apoio entram no gráfico. */
  sprintLabels: string[]
  bySprint: Map<string, SprintSupport>
  /** Unidade dos pontos: SP (dev) ou SP de Test Points (QA). */
  unit: string
}

// "Apoio por pessoa e sprint": quanto do crédito de apoio (mentoria) veio de cada apoiado, sprint a
// sprint, numa barra empilhada por pessoa. O tooltip detalha a % e a carga do apoiado que deu a base.
export function SupportByPersonChart({ sprintLabels, bySprint, unit }: SupportByPersonChartProps) {
  const chart = useChartTheme()
  const labels = useMemo(() => sprintLabels.filter((label) => (bySprint.get(label)?.points ?? 0) > 0), [sprintLabels, bySprint])
  const people = useMemo(() => supportTotalsByPerson(bySprint), [bySprint])

  const option: EChartsOption = useMemo(() => {
    const shareOf = (label: string, personId: string) => bySprint.get(label)?.detail.find((d) => d.personId === personId)
    return chart.baseOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const params = (Array.isArray(raw) ? raw : [raw]) as { marker: string; dataIndex: number; seriesIndex: number; axisValueLabel: string }[]
          const label = labels[params[0]?.dataIndex ?? 0]
          if (!label) return ''
          const lines = params.flatMap((p) => {
            const person = people[p.seriesIndex]
            const share = person && shareOf(label, person.personId)
            return share && share.points > 0 ? [`${p.marker} ${share.nome}: ${share.points} ${unit} (${share.percentage}% de ${share.base})`] : []
          })
          return [params[0].axisValueLabel, ...lines, `<b>Total: ${round1(bySprint.get(label)?.points ?? 0)} ${unit}</b>`].join('<br/>')
        },
      },
      legend: { top: 0, type: 'scroll', textStyle: chart.textStyle },
      xAxis: chart.sprintAxis(labels),
      yAxis: chart.valueAxis(),
      series: people.map((person, index) => ({
        name: person.nome,
        type: 'bar',
        stack: 'support',
        data: labels.map((label) => shareOf(label, person.personId)?.points ?? 0),
        itemStyle: { color: chart.palette[index % chart.palette.length], ...chart.paletteBorder },
        barMaxWidth: 40,
      })),
    })
  }, [chart, labels, people, bySprint, unit])

  return (
    <ChartCard
      title="Apoio por pessoa e sprint"
      description={`Crédito de apoio (mentoria) que a pessoa recebeu por apoiar cada colega: a % do apoio sobre a carga do apoiado na sprint, em ${unit}.`}
      isEmpty={labels.length === 0}
      emptyMessage="Nenhum apoio nas sprints selecionadas."
    >
      <ReactECharts option={option} style={{ height: 300 }} notMerge />
    </ChartCard>
  )
}
