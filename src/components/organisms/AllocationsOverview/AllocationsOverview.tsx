import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { AllocationGroupDetail } from '../AllocationGroupDetail/AllocationGroupDetail'
import { NewSprintAllocationModal } from '../NewSprintAllocationModal/NewSprintAllocationModal'
import { Modal } from '../../molecules/Modal/Modal'
import { MultiSelectFilter } from '../../molecules/MultiSelectFilter/MultiSelectFilter'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import { loadLevels, type LevelConfig } from '../../../lib/levelsStorage'
import { addPeopleToSquad, loadPeople, type Person } from '../../../lib/peopleStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, loadSprints, type Sprint } from '../../../lib/sprintsStorage'
import type { WorkItemRow } from '../../../lib/workItems'
import { loadWorkItems } from '../../../lib/workItemsStorage'
import { matchedStoryPoints } from '../../../lib/allocationWorkItems'
import {
  addPersonAllocations,
  computeAllocatedDays,
  deletePersonAllocations,
  loadPersonAllocations,
  moveAllocationsToSquad,
  pointsForEntry,
  restorePersonAllocations,
  setAllocationsPercentage,
  sumPercentageForPersonInSprint,
  upsertPersonAllocation,
  type PersonAllocation,
} from '../../../lib/personAllocationsStorage'

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

// Alocações em 3 passos: a lista por squad+sprint (com filtros), a "Nova alocação de sprint"
// (os membros da squad já vêm com o que sobra para cada um) e o detalhe do grupo, com adição,
// remoção (com Desfazer), edição da % e ações em lote sem abrir modal.
export function AllocationsOverview() {
  const [allocations, setAllocations] = useState<PersonAllocation[]>(loadPersonAllocations)
  const [people, setPeople] = useState<Person[]>(loadPeople)
  const [squads] = useState<Squad[]>(loadSquads)
  const [sprints] = useState<Sprint[]>(loadSprints)
  const [levels] = useState<LevelConfig[]>(loadLevels)
  const [workItems] = useState<WorkItemRow[]>(loadWorkItems)
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PersonAllocation | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [squadFilter, setSquadFilter] = useState<string[]>([])
  const [sprintFilter, setSprintFilter] = useState<string[]>([])

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const squadsById = useMemo(() => new Map(squads.map((s) => [s.id, s])), [squads])
  const sprintsById = useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints])
  const nameOf = (personId: string) => peopleById.get(personId)?.nome ?? '—'

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

  /** Grava um lote de alocações (todas da mesma squad/sprint); devolve o erro ou null. */
  function addEntries(entries: Omit<PersonAllocation, 'id'>[]): string | null {
    if (entries.length === 0) return null
    for (const entry of entries) {
      if (!(entry.percentage > 0 && entry.percentage <= 100)) return `${nameOf(entry.personId)}: a % deve ser maior que 0 e no máximo 100.`
      const used = sumPercentageForPersonInSprint(allocations, entry.personId, entry.sprintId)
      if (used + entry.percentage > 100) return `${nameOf(entry.personId)} já tem ${used}% nesta sprint; o total passaria de 100%.`
    }
    const { allocations: next, duplicates } = addPersonAllocations(entries)
    if (duplicates.length > 0) return `Já alocados nesta squad e sprint: ${duplicates.map((d) => nameOf(d.personId)).join(', ')}.`
    // Quem veio de fora da squad passa a ser membro dela.
    setPeople(addPeopleToSquad(entries[0].squadId, entries.map((e) => e.personId)))
    setAllocations(next)
    return null
  }

  function removeEntries(ids: string[]): PersonAllocation[] {
    const { allocations: next, removed } = deletePersonAllocations(ids)
    setAllocations(next)
    return removed
  }

  function setPercentage(ids: string[], percentage: number): string | null {
    const { allocations: next, errors } = setAllocationsPercentage(ids, percentage)
    if (errors.size > 0) return [...errors].map(([personId, message]) => `${nameOf(personId)}: ${message}`).join(' ')
    setAllocations(next)
    return null
  }

  function moveEntries(ids: string[], squadId: string): string | null {
    const { allocations: next, conflicts } = moveAllocationsToSquad(ids, squadId)
    if (conflicts.length > 0) {
      return `Já alocados na squad destino nessa sprint: ${conflicts.map((c) => nameOf(c.personId)).join(', ')}. Remova ou ajuste essas alocações antes.`
    }
    const moved = allocations.filter((a) => ids.includes(a.id))
    setPeople(addPeopleToSquad(squadId, moved.map((a) => a.personId)))
    setAllocations(next)
    // Moveu o grupo inteiro: segue para o grupo destino.
    if (activeGroup && moved.length === activeGroup.entries.length) setSelectedGroup({ squadId, sprintId: activeGroup.sprintId })
    return null
  }

  function handleSaveEdit() {
    if (!editing) return
    if (!editing.squadId || !editing.sprintId) return setEditError('Squad e Sprint são obrigatórios.')
    if (editing.percentage <= 0 || editing.percentage > 100) return setEditError('Porcentagem deve ser maior que 0 e no máximo 100.')
    const duplicate = allocations.some(
      (a) => a.id !== editing.id && a.personId === editing.personId && a.squadId === editing.squadId && a.sprintId === editing.sprintId,
    )
    if (duplicate) return setEditError('Essa pessoa já está alocada nessa squad e sprint.')
    const otherPercentage = sumPercentageForPersonInSprint(allocations, editing.personId, editing.sprintId, editing.id)
    if (otherPercentage + editing.percentage > 100) {
      return setEditError(`Essa pessoa já tem ${otherPercentage}% alocados em outras squads nessa sprint — o total passaria de 100%.`)
    }
    setAllocations(upsertPersonAllocation(editing))
    setPeople(addPeopleToSquad(editing.squadId, [editing.personId]))
    setEditing(null)
    setEditError(null)
  }

  const editingPerson = editing ? peopleById.get(editing.personId) : undefined
  const editingSprint = editing ? sprintsById.get(editing.sprintId) : undefined

  const editModal = (
    <Modal
      open={editing !== null}
      onClose={() => setEditing(null)}
      title={`Editar alocação${editingPerson ? ` — ${editingPerson.nome}` : ''}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSaveEdit}>
            Salvar
          </Button>
        </>
      }
    >
      {editing && (
        <div className="flex flex-col gap-4">
          {editError && <p className="text-sm text-brand-action-danger">{editError}</p>}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Squad</label>
            <Select
              value={editing.squadId}
              onChange={(value) => setEditing({ ...editing, squadId: value })}
              placeholder="Selecione uma squad"
              options={squads.map((squad) => ({ value: squad.id, label: squad.name }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Sprint</label>
            <Select
              value={editing.sprintId}
              onChange={(value) => setEditing({ ...editing, sprintId: value })}
              placeholder="Selecione uma sprint"
              options={sprints.map((sprint) => ({ value: sprint.id, label: formatSprintLabel(sprint) }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Porcentagem</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={editing.percentage}
              onChange={(e) => setEditing({ ...editing, percentage: Number(e.target.value) })}
            />
          </div>

          {editingSprint && (
            <p className="text-sm text-[var(--text)]">
              Dias calculados: {computeAllocatedDays(editing.percentage, editingSprint.totalValidDays)} de{' '}
              {editingSprint.totalValidDays}
            </p>
          )}
        </div>
      )}
    </Modal>
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
          onAdd={addEntries}
          onRemove={removeEntries}
          onRestore={(entries) => setAllocations(restorePersonAllocations(entries))}
          onSetPercentage={setPercentage}
          onMove={moveEntries}
          onEdit={(entry) => {
            setEditing({ ...entry })
            setEditError(null)
          }}
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
          const message = addEntries(entries)
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
