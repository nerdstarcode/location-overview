import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { usePersistedState } from '../../../hooks/usePersistedState'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { loadWorkItems } from '../../../lib/workItemsStorage'
import { CLOSED_STATES, splitTags, type WorkItemRow } from '../../../lib/workItems'
import { useColorblindMode } from '../../../hooks/useColorblindMode'
import { useHighContrastMode } from '../../../hooks/useHighContrastMode'
import { computeAllocatedDays, findLevelFor, loadPersonAllocations, type PersonAllocation } from '../../../lib/personAllocationsStorage'
import { formatSprintLabel, loadSprints, type Sprint } from '../../../lib/sprintsStorage'
import { loadPeople, type Person } from '../../../lib/peopleStorage'
import { loadLevels, type LevelConfig } from '../../../lib/levelsStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { findSquadNameForIterationPath } from '../../../lib/squadMatching'
import { loadCargos, type CargoConfig, type CargoTipo } from '../../../lib/cargosStorage'
import { DEFAULT_TEST_POINTS_RATIO, loadTestReports, type TestReport } from '../../../lib/testReportsStorage'
import { PALETTE } from '../../../lib/chartPalettes'
import { stateRank } from '../../../lib/stateColors'
import { useChartTheme } from '../../../hooks/useChartTheme'
import { ChartCard } from '../../molecules/ChartCard/ChartCard'

export interface WorkItemsDashboardProps {
  /** Uso reservado a Storybook/testes: quando informado, ignora o localStorage. */
  initialRows?: WorkItemRow[]
  /** Restringe o dataset base a esses Work Item Type (ex.: Dev Overview, QA Overview). */
  allowedTypes?: string[]
  /** Mensagem exibida quando não há linhas (após aplicar `allowedTypes`). */
  emptyMessage?: string
  /**
   * Restringe as linhas de Capacity/Max Points (Alocação) a pessoas cujo Cargo tenha
   * esse Tipo (Dev/QA/...) — undefined mostra o total de todas as pessoas.
   */
  cargoTipo?: CargoTipo
  /**
   * Quando informado, os filtros selecionados persistem em localStorage sob essa
   * chave — necessário para não perder os filtros ao trocar de tab (cada tab
   * desmonta a instância anterior de WorkItemsDashboard).
   */
  storageKey?: string
}


type ExecutionMetric = 'execucao' | 'testPoints'

const EXECUTION_METRIC_OPTIONS: { value: ExecutionMetric; label: string }[] = [
  { value: 'execucao', label: 'Pontos de Execução' },
  { value: 'testPoints', label: 'Test Points' },
]

interface FilterFieldDef {
  field: string
  label: string
  getValues: (row: WorkItemRow) => string[]
}

// Tags é uma lista separada por ";" — as opções/valores do filtro são os
// tokens individuais, não a string inteira (mesmo padrão de WorkItemsTable).
function buildFilterFields(squads: Squad[]): FilterFieldDef[] {
  return [
  { field: 'assignedTo', label: 'Assigned To', getValues: (row) => [row.assignedTo] },
  { field: 'workItemType', label: 'Work Item Type', getValues: (row) => [row.workItemType] },
  { field: 'state', label: 'State', getValues: (row) => [row.state] },
  { field: 'tags', label: 'Tags', getValues: (row) => splitTags(row.tags) },
  { field: 'iterationPath', label: 'Iteration Path', getValues: (row) => [row.iterationPath] },
  // Squad identificada pelo mesmo match usado em AllocationsOverview.tsx: o
  // nome de uma squad cadastrada aparece como segmento do Iteration Path.
  {
    field: 'squad',
    label: 'Squad',
    getValues: (row) => {
      const squadName = findSquadNameForIterationPath(squads, row.iterationPath)
      return squadName ? [squadName] : []
    },
  },
  { field: 'sprint', label: 'Sprint', getValues: (row) => [row.sprint] },
  { field: 'fiscalYear', label: 'Fiscal Year', getValues: (row) => [row.fiscalYear] },
  ]
}

function countBy(rows: WorkItemRow[], field: 'workItemType' | 'state'): [string, number][] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1)
  return [...counts.entries()]
}

/** 36 pontos de execução equivalem a 1 story point. */
const EXECUTION_POINTS_PER_STORY_POINT = 36

interface PointsSums {
  storyPoints: number
  /** Story points de itens fechados com delay (tag "Delayed" + sprint diferente do Iteration Path). */
  delayedStoryPoints: number
  /** Pontos de execução já normalizados (÷36) para a escala de story points. */
  executionPoints: number
}

function sumPointsByGroup(
  rows: WorkItemRow[],
  keyOf: (row: WorkItemRow) => string | null,
  filter?: (row: WorkItemRow) => boolean,
): Map<string, PointsSums> {
  const sums = new Map<string, PointsSums>()
  for (const row of rows) {
    if (filter && !filter(row)) continue
    const key = keyOf(row)
    if (key === null) continue
    const entry = sums.get(key) ?? { storyPoints: 0, delayedStoryPoints: 0, executionPoints: 0 }
    if (row.isDelayed) entry.delayedStoryPoints += row.storyPoints
    else entry.storyPoints += row.storyPoints
    entry.executionPoints += (row.pontoExecucao * row.runs) / EXECUTION_POINTS_PER_STORY_POINT
    sums.set(key, entry)
  }
  return sums
}

function sortByStateOrder<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort((a, b) => stateRank(a[0]) - stateRank(b[0]) || a[0].localeCompare(b[0]))
}

/** Ordena "Sprint 01 - FY25-26" cronologicamente: por Fiscal Year e depois pelo número da sprint. */
function sortBySprintOrder<T>(entries: [string, T][]): [string, T][] {
  return [...entries].sort((a, b) => {
    const matchA = a[0].match(/Sprint (\d+) - (FY\d{2}-\d{2})/)
    const matchB = b[0].match(/Sprint (\d+) - (FY\d{2}-\d{2})/)
    if (!matchA || !matchB) return a[0].localeCompare(b[0])
    const fyCompare = matchA[2].localeCompare(matchB[2])
    if (fyCompare !== 0) return fyCompare
    return Number(matchA[1]) - Number(matchB[1])
  })
}

/** Média de uma métrica considerando só os grupos com valor > 0 (grupos "zerados" não entram no divisor). */
function averageOfScored(values: number[]): number {
  const scored = values.filter((value) => value > 0)
  return scored.length > 0 ? scored.reduce((sum, value) => sum + value, 0) / scored.length : 0
}

interface ForecastFilters {
  /** Restringe às pessoas com Cargo desse Tipo (Dev/QA/...) — undefined = total. */
  cargoTipo?: CargoTipo
  /** Nomes selecionados no filtro "Assigned To" do dashboard (vazio = todas as pessoas). */
  selectedPeopleNames: string[]
  /** Nomes selecionados no filtro "Squad" do dashboard (vazio = todas as squads). */
  selectedSquadNames: string[]
}

/**
 * Capacity/Max points previstos por sprint, a partir do painel de Alocação: dias
 * alocados × capacity/max points/day do nível de cada pessoa — mesma fórmula usada
 * em AllocationsOverview.tsx. Reage à visão Dev/QA/Total (via Cargo.tipo) e
 * aos filtros de pessoa/squad já selecionados no dashboard.
 */
function computeForecastBySprint(
  personAllocations: PersonAllocation[],
  sprints: Sprint[],
  people: Person[],
  levels: LevelConfig[],
  squads: Squad[],
  cargos: CargoConfig[],
  filters: ForecastFilters,
): Map<string, { capacity: number; max: number }> {
  const sprintsById = new Map(sprints.map((s) => [s.id, s]))
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const squadsById = new Map(squads.map((s) => [s.id, s]))
  const cargoByName = new Map(cargos.map((c) => [c.cargo, c]))
  const forecast = new Map<string, { capacity: number; max: number }>()

  const selectedPeople = filters.selectedPeopleNames.map((n) => n.trim().toLowerCase())
  const selectedSquads = filters.selectedSquadNames.map((n) => n.trim().toLowerCase())

  for (const entry of personAllocations) {
    const sprint = sprintsById.get(entry.sprintId)
    if (!sprint) continue
    const person = peopleById.get(entry.personId)
    if (!person) continue
    const squad = squadsById.get(entry.squadId)
    if (!squad) continue

    if (selectedSquads.length > 0 && !selectedSquads.includes(squad.name.trim().toLowerCase())) continue
    if (selectedPeople.length > 0 && !selectedPeople.includes(person.nome.trim().toLowerCase())) continue
    if (filters.cargoTipo) {
      const cargo = cargoByName.get(person.cargo)
      if (!cargo || cargo.tipo !== filters.cargoTipo) continue
    }

    const level = findLevelFor(person, levels)
    if (!level) continue

    const dias = computeAllocatedDays(entry.percentage, sprint.totalValidDays)
    const label = formatSprintLabel(sprint)
    const acc = forecast.get(label) ?? { capacity: 0, max: 0 }
    acc.capacity += dias * level.capacityPointsDay
    acc.max += dias * level.maxPointsDay
    forecast.set(label, acc)
  }

  return forecast
}

/**
 * Soma Test Points já convertidos em story points (`testPoints / report.pointsRatio`,
 * cada relatório com sua própria proporção editável) por sprint (mesma chave
 * `formatSprintLabel` usada no forecast de Alocação), filtrando por squad
 * quando `selectedSquadNames` não estiver vazio — mesmo critério de
 * `computeForecastBySprint`.
 */
function computeTestPointsBySprint(
  testReports: TestReport[],
  sprints: Sprint[],
  squads: Squad[],
  selectedSquadNames: string[],
): Map<string, number> {
  const sprintsById = new Map(sprints.map((s) => [s.id, s]))
  const squadsById = new Map(squads.map((s) => [s.id, s]))
  const selectedSquads = selectedSquadNames.map((n) => n.trim().toLowerCase())
  const result = new Map<string, number>()

  for (const report of testReports) {
    const sprint = sprintsById.get(report.sprintId)
    if (!sprint) continue
    const squad = squadsById.get(report.squadId)
    if (!squad) continue
    if (selectedSquads.length > 0 && !selectedSquads.includes(squad.name.trim().toLowerCase())) continue

    const ratio = report.pointsRatio > 0 ? report.pointsRatio : DEFAULT_TEST_POINTS_RATIO
    const label = formatSprintLabel(sprint)
    result.set(label, (result.get(label) ?? 0) + report.testPoints / ratio)
  }

  return result
}

// Dashboard de Work Items: gráficos de quantidade por tipo, quantidade por
// state e story points por state, todos reagindo aos mesmos filtros
// (Assigned To / Work Item Type / State), reaproveitando MultiSelectFilter.
export function WorkItemsDashboard({
  initialRows,
  allowedTypes,
  emptyMessage,
  cargoTipo,
  storageKey,
}: WorkItemsDashboardProps) {
  const [rows] = useState<WorkItemRow[]>(() => {
    const base = initialRows ?? loadWorkItems()
    return allowedTypes ? base.filter((row) => allowedTypes.includes(row.workItemType)) : base
  })
  const [filters, setFilters] = usePersistedState<Record<string, string[]>>(
    `work-items-dashboard-filters:${storageKey ?? 'default'}`,
    {},
  )
  const [personAllocations] = useState<PersonAllocation[]>(loadPersonAllocations)
  const [sprintsCatalog] = useState<Sprint[]>(loadSprints)
  const [peopleCatalog] = useState<Person[]>(loadPeople)
  const [levelsCatalog] = useState<LevelConfig[]>(loadLevels)
  const [squads] = useState<Squad[]>(loadSquads)
  const [cargosCatalog] = useState<CargoConfig[]>(loadCargos)
  const [testReportsCatalog] = useState<TestReport[]>(loadTestReports)
  const [executionMetric, setExecutionMetric] = useState<ExecutionMetric>('execucao')
  const { theme, palette, paletteBorder, stateColors: stateColorsFor } = useChartTheme()
  const colorblind = useColorblindMode()
  const highContrast = useHighContrastMode()
  // Paleta Okabe-Ito (segura para daltonismo) + estilo/marcador distintos, para
  // não depender só de cor — usada quando o toggle de daltonismo está ativo. No
  // tema escuro usa a variante clara (branco/cinza claro) em vez dos tons mais
  // escuros do Okabe-Ito, que perdem contraste contra o fundo escuro.
  const minMaxStyle = highContrast
    ? theme.isDark
      ? {
          capacity: { color: '#FFFFFF', lineType: 'solid' as const, symbol: 'circle' },
          max: { color: '#FFD84D', lineType: 'dashed' as const, symbol: 'triangle' },
        }
      : {
          capacity: { color: '#000000', lineType: 'solid' as const, symbol: 'circle' },
          max: { color: '#7A0000', lineType: 'dashed' as const, symbol: 'triangle' },
        }
    : colorblind
      ? theme.isDark
        ? {
            capacity: { color: '#FFFFFF', lineType: 'solid' as const, symbol: 'circle' },
            max: { color: '#BFBFBF', lineType: 'dashed' as const, symbol: 'triangle' },
          }
        : {
            capacity: { color: '#0072B2', lineType: 'solid' as const, symbol: 'circle' },
            max: { color: '#E69F00', lineType: 'dashed' as const, symbol: 'triangle' },
          }
      : {
          capacity: { color: PALETTE[2], lineType: 'solid' as const, symbol: 'circle' },
          max: { color: PALETTE[5], lineType: 'solid' as const, symbol: 'circle' },
        }

  const forecastBySprintLabel = useMemo(
    () =>
      computeForecastBySprint(personAllocations, sprintsCatalog, peopleCatalog, levelsCatalog, squads, cargosCatalog, {
        cargoTipo,
        selectedPeopleNames: filters.assignedTo ?? [],
        selectedSquadNames: filters.squad ?? [],
      }),
    [personAllocations, sprintsCatalog, peopleCatalog, levelsCatalog, squads, cargosCatalog, cargoTipo, filters.assignedTo, filters.squad],
  )

  const testPointsBySprintLabel = useMemo(
    () => computeTestPointsBySprint(testReportsCatalog, sprintsCatalog, squads, filters.squad ?? []),
    [testReportsCatalog, sprintsCatalog, squads, filters.squad],
  )

  const filterFields = useMemo(() => buildFilterFields(squads), [squads])

  const filterOptions = useMemo(() => {
    const options: Record<string, string[]> = {}
    for (const { field, getValues } of filterFields) {
      options[field] = [...new Set(rows.flatMap(getValues).filter(Boolean))].sort()
    }
    return options
  }, [rows, filterFields])

  const filteredRows = useMemo(() => {
    const activeFilters = filterFields.map((def) => ({ def, values: filters[def.field] ?? [] })).filter(
      ({ values }) => values.length > 0,
    )
    if (activeFilters.length === 0) return rows
    return rows.filter((row) =>
      activeFilters.every(({ def, values }) => def.getValues(row).some((value) => values.includes(value))),
    )
  }, [rows, filters, filterFields])

  function handleFilterChange(field: string, values: string[]) {
    setFilters((prev) => ({ ...prev, [field]: values }))
  }

  const baseTextStyle = { color: theme.text }
  const axisLineStyle = { lineStyle: { color: theme.border } }
  const baseGrid = { left: 8, right: 16, top: 32, bottom: 8, containLabel: true }

  const typeOption: EChartsOption = useMemo(() => {
    const entries = countBy(filteredRows, 'workItemType').sort((a, b) => b[1] - a[1])
    return {
      backgroundColor: 'transparent',
      textStyle: baseTextStyle,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: baseTextStyle },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: entries.map(([name, value], index) => ({
            name,
            value,
            itemStyle: { color: palette[index % palette.length], ...paletteBorder },
          })),
          label: { color: theme.text },
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, theme, palette, paletteBorder])

  const stateCountOption: EChartsOption = useMemo(() => {
    const entries = sortByStateOrder(countBy(filteredRows, 'state'))
    const colors = stateColorsFor(entries.map(([name]) => name))
    return {
      backgroundColor: 'transparent',
      textStyle: baseTextStyle,
      tooltip: { trigger: 'axis' },
      grid: baseGrid,
      xAxis: { type: 'category', data: entries.map(([name]) => name), axisLabel: baseTextStyle, axisLine: axisLineStyle },
      yAxis: { type: 'value', axisLabel: baseTextStyle, axisLine: axisLineStyle, splitLine: { lineStyle: { color: theme.border } } },
      series: [
        {
          type: 'bar',
          data: entries.map(([, value], index) => ({
            value,
            itemStyle: { color: colors[index], ...paletteBorder },
          })),
          barMaxWidth: 40,
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, theme, palette, paletteBorder])

  const storyPointsOption: EChartsOption = useMemo(() => {
    const entries = sortByStateOrder([...sumPointsByGroup(filteredRows, (row) => row.state).entries()])
    return {
      backgroundColor: 'transparent',
      textStyle: baseTextStyle,
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: baseTextStyle },
      grid: { ...baseGrid, bottom: 32 },
      xAxis: { type: 'category', data: entries.map(([name]) => name), axisLabel: baseTextStyle, axisLine: axisLineStyle },
      yAxis: { type: 'value', axisLabel: baseTextStyle, axisLine: axisLineStyle, splitLine: { lineStyle: { color: theme.border } } },
      series: [
        {
          name: 'Story Points',
          type: 'bar',
          stack: 'total',
          data: entries.map(([, sums]) => sums.storyPoints + sums.delayedStoryPoints),
          itemStyle: { color: palette[3], ...paletteBorder },
          barMaxWidth: 40,
        },
        {
          name: 'Pontos de Execução',
          type: 'bar',
          stack: 'total',
          data: entries.map(([, sums]) => sums.executionPoints),
          itemStyle: { color: palette[4], ...paletteBorder },
          barMaxWidth: 40,
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, theme, palette, paletteBorder])

  const closedStoryPointsBySprintOption: EChartsOption = useMemo(() => {
    const entries = sortBySprintOrder([
      ...sumPointsByGroup(
        filteredRows,
        (row) => (row.sprint && row.fiscalYear ? `${row.sprint} - ${row.fiscalYear}` : null),
        (row) => CLOSED_STATES.has(row.state),
      ).entries(),
    ])
    // Cada média considera só os grupos com pontuação (> 0) na própria métrica; a
    // média de story points inclui o que foi fechado com delay.
    const averageStoryPoints = averageOfScored(entries.map(([, sums]) => sums.storyPoints + sums.delayedStoryPoints))

    const executionValues =
      executionMetric === 'execucao'
        ? entries.map(([, sums]) => sums.executionPoints)
        : entries.map(([label]) => testPointsBySprintLabel.get(label) ?? 0)
    const averageExecutionMetric = averageOfScored(executionValues)
    const executionSeriesName =
      executionMetric === 'execucao' ? 'Pontos de Execução (Closed)' : 'Test Points (Closed)'
    const executionAverageLabel = executionMetric === 'execucao' ? 'Média PE' : 'Média TP'

    return {
      backgroundColor: 'transparent',
      textStyle: baseTextStyle,
      tooltip: {
        trigger: 'axis',
        backgroundColor: theme.bgElevated,
        borderColor: theme.border,
        textStyle: { color: theme.textH },
        formatter: (rawParams: unknown) => {
          const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as Array<{
            marker: string
            seriesName: string
            value: number
            axisValueLabel: string
          }>
          const title = params[0]?.axisValueLabel ?? ''
          const lines = params.map((p) => `${p.marker} ${p.seriesName}: ${p.value.toFixed(2)}`)
          lines.push(`— Média SP: ${averageStoryPoints.toFixed(2)}`)
          lines.push(`— ${executionAverageLabel}: ${averageExecutionMetric.toFixed(2)}`)
          return [title, ...lines].join('<br/>')
        },
      },
      legend: { bottom: 0, textStyle: baseTextStyle },
      grid: { ...baseGrid, bottom: 32 },
      xAxis: { type: 'category', data: entries.map(([name]) => name), axisLabel: baseTextStyle, axisLine: axisLineStyle },
      yAxis: { type: 'value', axisLabel: baseTextStyle, axisLine: axisLineStyle, splitLine: { lineStyle: { color: theme.border } } },
      series: [
        {
          name: 'Story Points (Closed)',
          type: 'bar',
          stack: 'total',
          data: entries.map(([, sums]) => sums.storyPoints),
          itemStyle: { color: palette[0], ...paletteBorder },
          barMaxWidth: 40,
          markLine: {
            symbol: 'none',
            label: { color: theme.text, formatter: 'Média SP: {c}' },
            lineStyle: { color: palette[0], type: 'dashed' },
            data: [{ yAxis: averageStoryPoints, name: 'Média SP' }],
          },
        },
        {
          name: 'Story Points (Closed, Delayed)',
          type: 'bar',
          stack: 'total',
          data: entries.map(([, sums]) => sums.delayedStoryPoints),
          itemStyle: {
            color: palette[5],
            ...paletteBorder,
            decal: { symbol: 'line', dashArrayX: [4, 2], rotation: Math.PI / 4 },
          },
          barMaxWidth: 40,
        },
        {
          name: executionSeriesName,
          type: 'bar',
          stack: 'total',
          data: executionValues,
          itemStyle: { color: palette[4], ...paletteBorder },
          barMaxWidth: 40,
          markLine: {
            symbol: 'none',
            label: { color: theme.text, formatter: `${executionAverageLabel}: {c}` },
            lineStyle: { color: palette[4], type: 'dashed' },
            data: [{ yAxis: averageExecutionMetric, name: executionAverageLabel }],
          },
        },
        {
          name: 'Capacity Points (Alocação)',
          type: 'line',
          data: entries.map(([label]) => forecastBySprintLabel.get(label)?.capacity ?? 0),
          itemStyle: { color: minMaxStyle.capacity.color },
          lineStyle: { color: minMaxStyle.capacity.color, type: minMaxStyle.capacity.lineType },
          symbol: minMaxStyle.capacity.symbol,
          symbolSize: 7,
        },
        {
          name: 'Max Points (Alocação)',
          type: 'line',
          data: entries.map(([label]) => forecastBySprintLabel.get(label)?.max ?? 0),
          itemStyle: { color: minMaxStyle.max.color },
          lineStyle: { color: minMaxStyle.max.color, type: minMaxStyle.max.lineType },
          symbol: minMaxStyle.max.symbol,
          symbolSize: 7,
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filteredRows,
    theme,
    forecastBySprintLabel,
    minMaxStyle,
    palette,
    paletteBorder,
    executionMetric,
    testPointsBySprintLabel,
  ])

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] p-10 text-center">
        <p className="text-sm text-[var(--text)]">
          {emptyMessage ??
            'Nenhum work item importado. Importe dados na página de Work Items para visualizar o dashboard.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterFields.map(({ field, label }) => (
          <MultiSelectFilter
            key={field}
            label={label}
            options={filterOptions[field] ?? []}
            selected={filters[field] ?? []}
            onChange={(values) => handleFilterChange(field, values)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Work Items por Tipo">
          <ReactECharts option={typeOption} style={{ height: 320 }} notMerge />
        </ChartCard>

        <ChartCard title="Work Items por State">
          <ReactECharts option={stateCountOption} style={{ height: 320 }} notMerge />
        </ChartCard>

        <ChartCard title="Story Points por State" className="lg:col-span-2">
          <ReactECharts option={storyPointsOption} style={{ height: 320 }} notMerge />
        </ChartCard>

        <ChartCard
          title="Story Points Closed por Sprint"
          className="lg:col-span-2"
          actions={
            <div className="flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5 text-xs">
              {EXECUTION_METRIC_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExecutionMetric(option.value)}
                  className={`rounded px-2 py-1 transition-colors ${
                    executionMetric === option.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text)] hover:bg-[var(--code-bg)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          <ReactECharts option={closedStoryPointsBySprintOption} style={{ height: 320 }} notMerge />
        </ChartCard>
      </div>
    </div>
  )
}
