import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, EyeOff } from 'lucide-react'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'
import { DataTable } from '../DataTable/DataTable'
import { useChartTheme } from '../../../hooks/useChartTheme'
import type { GroupPoints, UserStoryTasks } from '../../../lib/azure/sprintMetrics'

export interface SprintPointsByTypeChartProps {
  byType: GroupPoints[]
  userStories: UserStoryTasks[]
  /** Oculta/mostra o item: oculto fica apagado na tabela e sai dos KPIs e gráficos. */
  onToggleHidden?: (id: number) => void
}

const NUMERIC = { align: 'right', numeric: true } as const

function hideColumn(onToggleHidden: (id: number) => void): ColumnDef<UserStoryTasks, unknown> {
  return {
    id: 'hide',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const { id, hidden } = row.original
      const label = hidden ? 'Mostrar (voltar a contar nos KPIs e gráficos)' : 'Ocultar (tirar dos KPIs e gráficos)'
      return (
        <button
          type="button"
          onClick={() => onToggleHidden(id)}
          aria-label={`${hidden ? 'Mostrar' : 'Ocultar'} item ${id}`}
          aria-pressed={hidden}
          title={label}
          className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
        >
          {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )
    },
  }
}

const USER_STORY_COLUMNS: ColumnDef<UserStoryTasks, unknown>[] = [
  { accessorKey: 'id', header: 'ID', meta: { ...NUMERIC, headerAlign: 'left' } },
  { accessorKey: 'workItemType', header: 'Tipo' },
  { accessorKey: 'title', header: 'Título', meta: { minWidth: 240 } },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'assignedTo', header: 'Assigned To' },
  { accessorKey: 'storyPoints', header: 'Story Points', meta: NUMERIC },
  { accessorKey: 'effort', header: 'Effort', meta: NUMERIC },
  { accessorKey: 'timeCriticality', header: 'Time Criticality', meta: NUMERIC },
  { accessorKey: 'wsjf', header: 'WSJF', meta: NUMERIC },
  { accessorKey: 'tasks', header: 'Tasks', meta: NUMERIC },
  {
    id: 'tasksDone',
    header: 'Tasks fechadas',
    accessorFn: (row) => row.tasksDone,
    cell: ({ row }) => `${row.original.tasksDone}/${row.original.tasks}`,
    meta: NUMERIC,
  },
]

export function SprintPointsByTypeChart({ byType, userStories, onToggleHidden }: SprintPointsByTypeChartProps) {
  const chart = useChartTheme()
  const columns = useMemo(
    () => (onToggleHidden ? [hideColumn(onToggleHidden), ...USER_STORY_COLUMNS] : USER_STORY_COLUMNS),
    [onToggleHidden],
  )

  const option: EChartsOption = useMemo(
    () =>
      chart.baseOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, textStyle: chart.textStyle },
        xAxis: chart.categoryAxis(byType.map((t) => t.key)),
        yAxis: [chart.valueAxis({ name: 'SP' }), chart.valueAxis({ name: 'Itens', splitLine: { show: false } })],
        series: [
          {
            name: 'Story Points',
            type: 'bar',
            data: byType.map((t) => t.storyPoints),
            itemStyle: { color: chart.palette[0], ...chart.paletteBorder },
            label: { show: true, position: 'top', color: chart.theme.text },
            barMaxWidth: 40,
          },
          {
            name: 'Quantidade',
            type: 'bar',
            yAxisIndex: 1,
            data: byType.map((t) => t.count),
            itemStyle: { color: chart.palette[3], ...chart.paletteBorder },
            barMaxWidth: 40,
          },
        ],
      }),
    [byType, chart],
  )

  // Descrição conta só os visíveis; os ocultos aparecem à parte.
  const visible = userStories.filter((story) => !story.hidden)
  const hiddenCount = userStories.length - visible.length
  const totalTasks = visible.reduce((sum, story) => sum + story.tasks, 0)
  const countByType = [...visible.reduce((map, item) => map.set(item.workItemType, (map.get(item.workItemType) ?? 0) + 1), new Map<string, number>())]
    .map(([type, count]) => `${count} ${type}`)
    .join(' · ')
  const hiddenText = hiddenCount > 0 ? ` · ${hiddenCount} oculto(s), fora dos KPIs e gráficos` : ''

  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard title="Story Points por tipo de Work Item" isEmpty={byType.length === 0} emptyMessage="Nenhum work item nesta sprint.">
        <ReactECharts option={option} style={{ height: 320 }} notMerge />
      </ChartCard>
      <ChartCard
        title="Tasks por User Story, Bug e Enabler"
        description={`${countByType || 'Nenhum item'} · ${totalTasks} Task(s) atreladas nesta sprint${hiddenText}`}
      >
        <DataTable
          data={userStories}
          columns={columns}
          emptyMessage="Nenhuma User Story, Bug ou Enabler nesta sprint."
          getRowClassName={(row) => (row.hidden ? 'opacity-50' : undefined)}
        />
      </ChartCard>
    </div>
  )
}
