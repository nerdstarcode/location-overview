import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { AllocationEditModal } from '../AllocationEditModal/AllocationEditModal'
import { AllocationGroupDetail } from '../AllocationGroupDetail/AllocationGroupDetail'
import { NewSprintAllocationModal } from '../NewSprintAllocationModal/NewSprintAllocationModal'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { Button } from '../../atoms/Button/Button'
import { useAllocationActions } from '../../../hooks/useAllocationActions'
import { loadLevels, type LevelConfig } from '../../../lib/levelsStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, loadSprints, type Sprint } from '../../../lib/sprintsStorage'
import type { WorkItemRow } from '../../../lib/workItems'
import { loadWorkItems } from '../../../lib/workItemsStorage'
import { matchedStoryPoints } from '../../../lib/allocationWorkItems'
import { pointsForEntry, type PersonAllocation } from '../../../lib/personAllocationsStorage'

interface GroupKey {
  squadId: string
  sprintId: string
}

interface GroupSummary extends GroupKey {
  squad: Squad
  sprint: Sprint
  entries: PersonAllocation[]
  capacityPoints: number
  maxPoints: number
  storyPoints: number
}

// Visão cruzada squad × sprint (com filtros), a "Nova alocação de sprint" e o detalhe do grupo.
// O fluxo principal, a partir da linha do tempo de sprints, fica na aba Sprints.
export function AllocationsOverview() {
  const actions = useAllocationActions()
  const { allocations, people } = actions
  const [squads] = useState<Squad[]>(loadSquads)
  const [sprints] = useState<Sprint[]>(loadSprints)
  const [levels] = useState<LevelConfig[]>(loadLevels)
  const [workItems] = useState<WorkItemRow[]>(loadWorkItems)
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PersonAllocation | null>(null)
  const [squadFilter, setSquadFilter] = useState<string[]>([])
  const [sprintFilter, setSprintFilter] = useState<string[]>([])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const squadsById = useMemo(() => new Map(squads.map((s) => [s.id, s])), [squads])
  const sprintsById = useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints])

  const summarize = useMemo(
    () =>
      (squad: Squad, sprint: Sprint, entries: PersonAllocation[]): GroupSummary => {
        const totals = entries.reduce(
          (acc, entry) => {
            const points = pointsForEntry(entry, sprint, peopleById.get(entry.personId), levels)
            return { capacity: acc.capacity + points.capacity, max: acc.max + points.max }
          },
          { capacity: 0, max: 0 },
        )
        return {
          squadId: squad.id,
          sprintId: sprint.id,
          squad,
          sprint,
          entries,
          capacityPoints: totals.capacity,
          maxPoints: totals.max,
          storyPoints: matchedStoryPoints(workItems, squad, sprint),
        }
      },
    [peopleById, levels, workItems],
  )

  const groups = useMemo<GroupSummary[]>(() => {
    const byKey = new Map<string, PersonAllocation[]>()
    for (const entry of allocations) {
      const key = `${entry.squadId}::${entry.sprintId}`
      byKey.set(key, [...(byKey.get(key) ?? []), entry])
    }
    return [...byKey.values()]
      .map((entries) => {
        const squad = squadsById.get(entries[0].squadId)
        const sprint = sprintsById.get(entries[0].sprintId)
        return squad && sprint ? summarize(squad, sprint, entries) : null
      })
      .filter((group): group is GroupSummary => group !== null)
      .sort((a, b) => a.squad.name.localeCompare(b.squad.name) || a.sprint.number - b.sprint.number)
  }, [allocations, squadsById, sprintsById, summarize])

  const filteredGroups = groups.filter(
    (g) =>
      (squadFilter.length === 0 || squadFilter.includes(g.squad.name)) &&
      (sprintFilter.length === 0 || sprintFilter.includes(formatSprintLabel(g.sprint))),
  )

  // O grupo aberto continua na tela mesmo vazio (ex.: removeu todo mundo e pode desfazer).
  const activeGroup = (() => {
    if (!selectedGroup) return undefined
    const found = groups.find((g) => g.squadId === selectedGroup.squadId && g.sprintId === selectedGroup.sprintId)
    if (found) return found
    const squad = squadsById.get(selectedGroup.squadId)
    const sprint = sprintsById.get(selectedGroup.sprintId)
    return squad && sprint ? summarize(squad, sprint, []) : undefined
  })()

  const editModal = (
    <AllocationEditModal
      key={editing?.id ?? 'fechado'}
      entry={editing}
      person={editing ? peopleById.get(editing.personId) : undefined}
      squads={squads}
      sprints={sprints}
      onClose={() => setEditing(null)}
      onSave={actions.saveEdit}
    />
  )

  if (activeGroup) {
    return (
      <>
        <AllocationGroupDetail
          squad={activeGroup.squad}
          sprint={activeGroup.sprint}
          entries={activeGroup.entries}
          allocations={allocations}
          people={people}
          squads={squads}
          levels={levels}
          workItems={workItems}
          summary={activeGroup}
          onBack={() => setSelectedGroup(null)}
          onAdd={actions.addEntries}
          onRemove={actions.removeEntries}
          onRestore={actions.restoreEntries}
          onSetPercentage={actions.setPercentage}
          onMove={(ids, squadId) => {
            const message = actions.moveEntries(ids, squadId)
            // Moveu o grupo inteiro: segue para o grupo destino.
            if (message === null && ids.length === activeGroup.entries.length) setSelectedGroup({ squadId, sprintId: activeGroup.sprintId })
            return message
          }}
          onEdit={(entry) => setEditing({ ...entry })}
        />
        {editModal}
      </>
    )
  }

  const groupColumns: ColumnDef<GroupSummary, unknown>[] = [
    derivedColumn('squad', 'Squad', (group) => group.squad.name),
    derivedColumn('sprint', 'Sprint', (group) => formatSprintLabel(group.sprint)),
    derivedColumn('people', 'Pessoas', (group) => String(group.entries.length), true),
    derivedColumn('percentage', '% total', (group) => `${group.entries.reduce((sum, e) => sum + e.percentage, 0)}%`, true),
    derivedColumn('capacity', 'Capacity Points', (group) => group.capacityPoints.toFixed(1), true),
    derivedColumn('max', 'Max Points', (group) => group.maxPoints.toFixed(1), true),
    derivedColumn('storyPoints', 'Story Points', (group) => String(group.storyPoints), true),
  ]

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text)]">
          Alocações por squad e sprint. Clique numa linha para ajustar as pessoas, ou crie a sprint de uma squad com os
          membros já preenchidos.
        </p>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus size={14} /> Nova alocação de sprint
        </Button>
      </div>

      <DataTable
        columns={groupColumns}
        data={filteredGroups}
        emptyMessage={groups.length === 0 ? 'Nenhuma alocação cadastrada.' : 'Nenhuma alocação nos filtros.'}
        onRowClick={(group) => setSelectedGroup({ squadId: group.squadId, sprintId: group.sprintId })}
        pageResetKey={`${squadFilter.join('|')}::${sprintFilter.join('|')}`}
        toolbar={
          <>
            <MultiSelectFilter
              label="Squad"
              options={[...new Set(groups.map((g) => g.squad.name))].sort()}
              selected={squadFilter}
              onChange={setSquadFilter}
            />
            <MultiSelectFilter
              label="Sprint"
              options={[...new Set(groups.map((g) => formatSprintLabel(g.sprint)))]}
              selected={sprintFilter}
              onChange={setSprintFilter}
            />
          </>
        }
      />

      <NewSprintAllocationModal
        open={creating}
        onClose={() => setCreating(false)}
        people={people}
        squads={squads}
        sprints={sprints}
        allocations={allocations}
        onSave={(entries) => {
          const message = actions.addEntries(entries)
          if (message === null) {
            setCreating(false)
            setSelectedGroup({ squadId: entries[0].squadId, sprintId: entries[0].sprintId })
          }
          return message
        }}
        onOpenGroup={(squadId, sprintId) => {
          setCreating(false)
          setSelectedGroup({ squadId, sprintId })
        }}
      />
      {editModal}
    </div>
  )
}

// Coluna só com texto derivado: o mesmo formatador alimenta a célula e a busca.
function derivedColumn<T>(id: string, header: string, format: (row: T) => string, numeric = false): ColumnDef<T, unknown> {
  return {
    id,
    header,
    cell: ({ row }) => format(row.original),
    meta: { searchValue: format, ...(numeric && { align: 'right', numeric: true }) },
  }
}
