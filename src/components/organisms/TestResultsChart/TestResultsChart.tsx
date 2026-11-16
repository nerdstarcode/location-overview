import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { SegmentedControl } from '../../molecules/SegmentedControl/SegmentedControl'
import { StatCard } from '../../molecules/StatCard/StatCard'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { round1 } from '../../../lib/numbers'
import { executionsBySprint, executionsSummary, type ItemExecutions } from '../../../lib/testExecutionsPerPoint'
import type { WorkItemRow } from '../../../lib/workItems'

type View = 'sprint' | 'item'

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'sprint', label: 'Por sprint' },
  { value: 'item', label: 'Por item' },
]

const INFO = {
  passRate: 'Passed ÷ (passed + failed) de todos os resultados executados no período, contando os re-testes.',
  failsPerItem: 'Failed ÷ itens testados: quantas vezes, em média, um item falhou antes (ou depois) de passar.',
}

/** % de passed sobre passed + failed; null sem resultado. */
const passRateOf = (passed: number, failed: number): number | null =>
  passed + failed > 0 ? round1((passed / (passed + failed)) * 100) : null

const percent = (value: number | null) => (value === null ? '—' : `${value}%`)

interface Bucket {
  label: string
  passed: number
  failed: number
  row?: WorkItemRow
}

export interface TestResultsChartProps {
  items: ItemExecutions[]
  description?: string
  onOpenItem?: (row: WorkItemRow) => void
}

// Resultados de teste (passed × failed) por sprint da execução ou por item (US/Bug com os Test Cases
// dele e das Tasks filhas), com a taxa de aprovação de cada um e a média geral do período.
export function TestResultsChart({
  items,
  description = 'Quantos testes passaram e falharam por sprint (data da execução) ou por item, com a taxa de aprovação e a média geral.',
  onOpenItem,
}: TestResultsChartProps) {
  const chart = useChartTheme()
  const [view, setView] = useState<View>('sprint')
  const summary = useMemo(() => executionsSummary(items), [items])
  const average = passRateOf(summary.passed, summary.failed)

  const buckets = useMemo<Bucket[]>(() => {
    if (view === 'sprint') {
      return executionsBySprint(items)
        .filter((s) => s.summary.passed + s.summary.failed > 0)
        .map((s) => ({ label: s.label, passed: s.summary.passed, failed: s.summary.failed }))
    }
    // Por item: os que mais falharam primeiro (barras horizontais desenham de baixo para cima).
    return items
      .filter((item) => item.passed + item.failed > 0)
      .sort((a, b) => b.failed - a.failed || b.passed + b.failed - (a.passed + a.failed))
      .map((item) => ({ label: `#${item.row.id} ${item.row.title}`, passed: item.passed, failed: item.failed, row: item.row }))
      .reverse()
  }, [items, view])

  const option: EChartsOption = useMemo(() => {
    const [passedColor, failedColor] = chart.stateColors(['Closed', 'Fail'])
    const horizontal = view === 'item'
    const categories = buckets.map((b) => b.label)
    const bar = (name: string, color: string, pick: (b: Bucket) => number) => ({
      name,
      type: 'bar' as const,
      stack: 'results',
      barMaxWidth: horizontal ? 20 : 36,
      itemStyle: { color, ...chart.paletteBorder },
      data: buckets.map(pick),
    })
    return chart.baseOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (raw: unknown) => {
          const params = (Array.isArray(raw) ? raw : [raw]) as { dataIndex: number }[]
          const bucket = buckets[params[0]?.dataIndex ?? 0]
          if (!bucket) return ''
          return [
            `<b>${bucket.label}</b>`,
            `Passed: ${bucket.passed} · Failed: ${bucket.failed}`,
            `Aprovação: <b>${percent(passRateOf(bucket.passed, bucket.failed))}</b> (média ${percent(average)})`,
          ].join('<br/>')
        },
      },
      legend: { top: 0, textStyle: chart.textStyle },
      ...(horizontal
        ? {
            xAxis: chart.valueAxis({ minInterval: 1 }),
            yAxis: { ...chart.categoryAxis(categories), axisLabel: { color: chart.theme.text, width: 220, overflow: 'truncate' } },
          }
        : {
            xAxis: chart.sprintAxis(categories),
            yAxis: [
              chart.valueAxis({ name: 'Resultados', nameTextStyle: chart.textStyle, minInterval: 1 }),
              chart.valueAxis({ name: 'Aprovação %', nameTextStyle: chart.textStyle, min: 0, max: 100, splitLine: { show: false } }),
            ],
          }),
      series: [
        bar('Passed', passedColor, (b) => b.passed),
        {
          ...bar('Failed', failedColor, (b) => b.failed),
          label: {
            show: true,
            position: horizontal ? 'right' : 'top',
            color: chart.theme.text,
            formatter: ({ dataIndex }: { dataIndex: number }) => percent(passRateOf(buckets[dataIndex].passed, buckets[dataIndex].failed)),
          },
        },
        ...(horizontal
          ? []
          : [
              {
                name: 'Aprovação %',
                type: 'line' as const,
                yAxisIndex: 1,
                symbol: 'circle',
                itemStyle: { color: chart.palette[0] },
                data: buckets.map((b) => passRateOf(b.passed, b.failed)),
                markLine:
                  average === null
                    ? undefined
                    : {
                        symbol: 'none',
                        label: { color: chart.theme.text, formatter: `Média: ${average}%`, position: 'insideEndTop' as const },
                        lineStyle: { color: chart.palette[0], type: 'dashed' as const },
                        data: [{ yAxis: average }],
                      },
              },
            ]),
      ],
    })
  }, [buckets, chart, view, average])

  const onEvents = useMemo(
    () => ({
      click: ({ dataIndex }: { dataIndex: number }) => {
        const row = buckets[dataIndex]?.row
        if (row && onOpenItem) onOpenItem(row)
      },
    }),
    [buckets, onOpenItem],
  )

  return (
    <ChartCard
      title="Resultados de teste"
      description={description}
      isEmpty={summary.passed + summary.failed === 0}
      emptyMessage="Nenhum resultado de teste (passed/failed) nos itens do filtro. Sincronize as sprints pelo Azure DevOps para trazer os test results."
      actions={<SegmentedControl aria-label="Agrupar resultados" options={VIEW_OPTIONS} value={view} onChange={setView} />}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Aprovação média" info={INFO.passRate} value={percent(average)} hint={`${summary.passed + summary.failed} resultados`} />
        <StatCard label="Passed" value={summary.passed} />
        <StatCard label="Failed" value={summary.failed} />
        <StatCard
          label="Falhas por item"
          info={INFO.failsPerItem}
          value={summary.testedItems > 0 ? round1(summary.failed / summary.testedItems) : '—'}
          hint={`${summary.testedItems} item(ns) testado(s)`}
        />
      </div>
      <ReactECharts
        option={option}
        style={{ height: view === 'item' ? Math.max(240, buckets.length * 28 + 60) : 320 }}
        onEvents={onEvents}
        notMerge
      />
    </ChartCard>
  )
}
