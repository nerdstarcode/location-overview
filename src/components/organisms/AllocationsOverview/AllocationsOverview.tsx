import { useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import { loadLevels, type LevelConfig } from '../../../lib/levelsStorage'
import { addPeopleToSquad, loadPeople, type Person } from '../../../lib/peopleStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, loadSprints, type Sprint } from '../../../lib/sprintsStorage'
import type { WorkItemRow } from '../../../lib/workItems'
import { loadWorkItems } from '../../../lib/workItemsStorage'
import { squadMatchesIterationPath } from '../../../lib/squadMatching'
import {
  computeAllocatedDays,
  deletePersonAllocation,
  loadPersonAllocations,
  moveAllocationsToSquad,
  pointsForEntry,
  sumPercentageForPersonInSprint,
  upsertPersonAllocation,
  type PersonAllocation,
} from '../../../lib/personAllocationsStorage'
import { createId } from '../../../lib/createId'

interface Draft {
  id: string
  personId: string
  squadId: string
  sprintId: string
  percentage: number
}

const EMPTY_DRAFT: Draft = { id: '', personId: '', squadId: '', sprintId: '', percentage: 0 }

/**
 * Work items cujo Iteration Path bata com a squad e cujo Sprint/Fiscal Year
 * batam com a sprint — opcionalmente também restrito ao email de uma pessoa.
 */
function matchingWorkItems(workItems: WorkItemRow[], squad: Squad, sprint: Sprint, email?: string): WorkItemRow[] {
  const sprintLabel = `Sprint ${String(sprint.number).padStart(2, '0')}`
  const fiscalYear = sprint.fiscalYear.toUpperCase()
  const normalizedEmail = email?.trim().toLowerCase()
  return workItems.filter(
    (item) =>
      squadMatchesIterationPath(squad, item.iterationPath) &&
      item.sprint === sprintLabel &&
      item.fiscalYear === fiscalYear &&
      (!normalizedEmail || item.email.trim().toLowerCase() === normalizedEmail),
  )
}

function matchedStoryPoints(workItems: WorkItemRow[], squad: Squad, sprint: Sprint): number {
  return matchingWorkItems(workItems, squad, sprint).reduce((sum, item) => sum + item.storyPoints, 0)
}

/** Soma Story Points e Pontos de Execução dos work items de uma pessoa (por email) que batem com a squad e a sprint. */
function personPoints(
  workItems: WorkItemRow[],
  squad: Squad,
  sprint: Sprint,
  person: Person | undefined,
): { storyPoints: number; pontoExecucao: number } {
  if (!person?.email.trim()) return { storyPoints: 0, pontoExecucao: 0 }
  const matches = matchingWorkItems(workItems, squad, sprint, person.email)
  return {
    storyPoints: matches.reduce((sum, item) => sum + item.storyPoints, 0),
    pontoExecucao: matches.reduce((sum, item) => sum + item.pontoExecucao, 0),
  }
}

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

// Visão geral de alocações agrupada por squad+sprint: capacity/max points
// (soma por pessoa, via nível) e Story Points batidos em Work Items pelo
// Iteration Path. Clicar num grupo abre o detalhamento por pessoa.
export function AllocationsOverview() {
  const [allocations, setAllocations] = useState<PersonAllocation[]>(loadPersonAllocations)
  const [people, setPeople] = useState<Person[]>(loadPeople)
  const [squads] = useState<Squad[]>(loadSquads)
  const [sprints] = useState<Sprint[]>(loadSprints)
  const [levels] = useState<LevelConfig[]>(loadLevels)
  const [workItems] = useState<WorkItemRow[]>(loadWorkItems)
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Squad destino ao mover todas as pessoas do grupo aberto; `null` = modal fechado. */
  const [moveSquadId, setMoveSquadId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const squadsById = useMemo(() => new Map(squads.map((s) => [s.id, s])), [squads])
  const sprintsById = useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints])

  const groups = useMemo<GroupSummary[]>(() => {
    const byKey = new Map<string, PersonAllocation[]>()
    for (const entry of allocations) {
      const key = `${entry.squadId}::${entry.sprintId}`
      byKey.set(key, [...(byKey.get(key) ?? []), entry])
    }
    return [...byKey.entries()]
      .map(([, entries]) => {
        const squad = squadsById.get(entries[0].squadId)
        const sprint = sprintsById.get(entries[0].sprintId)
        if (!squad || !sprint) return null
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
      })
      .filter((group): group is GroupSummary => group !== null)
      .sort((a, b) => a.squad.name.localeCompare(b.squad.name) || a.sprint.number - b.sprint.number)
  }, [allocations, squadsById, sprintsById, peopleById, levels, workItems])

  const activeGroup = selectedGroup
    ? groups.find((g) => g.squadId === selectedGroup.squadId && g.sprintId === selectedGroup.sprintId)
    : undefined

  const selectedPerson = draft ? peopleById.get(draft.personId) : undefined
  const availableSquads = selectedPerson ? squads.filter((squad) => selectedPerson.squadIds.includes(squad.id)) : []
  const selectedSprint = draft ? sprintsById.get(draft.sprintId) : undefined

  function openCreateModal(preset?: Partial<Draft>) {
    setDraft({ ...EMPTY_DRAFT, ...preset })
    setError(null)
  }

  function handleSave() {
    if (!draft) return
    if (!draft.personId || !draft.squadId || !draft.sprintId) {
      setError('Pessoa, Squad e Sprint são obrigatórios.')
      return
    }
    if (draft.percentage <= 0 || draft.percentage > 100) {
      setError('Porcentagem deve ser maior que 0 e no máximo 100.')
      return
    }
    const otherPercentage = sumPercentageForPersonInSprint(allocations, draft.personId, draft.sprintId, draft.id)
    if (otherPercentage + draft.percentage > 100) {
      setError(
        `Essa pessoa já tem ${otherPercentage}% alocados em outras squads nessa sprint — o total passaria de 100%.`,
      )
      return
    }
    const saved: PersonAllocation = { ...draft, id: draft.id || createId() }
    setAllocations(upsertPersonAllocation(saved))
    setDraft(null)
    setError(null)
  }

  function handleMoveGroup() {
    if (!activeGroup || !moveSquadId) {
      setMoveError('Selecione a squad destino.')
      return
    }
    const { allocations: next, conflicts } = moveAllocationsToSquad(
      activeGroup.entries.map((entry) => entry.id),
      moveSquadId,
    )
    if (conflicts.length > 0) {
      const names = conflicts.map((entry) => peopleById.get(entry.personId)?.nome ?? '—').join(', ')
      setMoveError(`Já alocados na squad destino nessa sprint: ${names}. Remova ou ajuste essas alocações antes.`)
      return
    }
    setPeople(addPeopleToSquad(moveSquadId, activeGroup.entries.map((entry) => entry.personId)))
    setAllocations(next)
    setSelectedGroup({ squadId: moveSquadId, sprintId: activeGroup.sprintId })
    setMoveSquadId(null)
    setMoveError(null)
  }

  function handleDelete(id: string) {
    setAllocations(deletePersonAllocation(id))
  }

  const groupColumns: ColumnDef<GroupSummary, unknown>[] = [
    { id: 'squad', header: 'Squad', cell: ({ row }) => row.original.squad.name },
    { id: 'sprint', header: 'Sprint', cell: ({ row }) => formatSprintLabel(row.original.sprint) },
    { id: 'capacity', header: 'Capacity Points', meta: { align: 'right', numeric: true }, cell: ({ row }) => row.original.capacityPoints.toFixed(1) },
    { id: 'max', header: 'Max Points', meta: { align: 'right', numeric: true }, cell: ({ row }) => row.original.maxPoints.toFixed(1) },
    { id: 'storyPoints', header: 'Story Points', meta: { align: 'right', numeric: true }, cell: ({ row }) => row.original.storyPoints },
  ]

  const entryColumns: ColumnDef<PersonAllocation, unknown>[] = [
    { id: 'person', header: 'Pessoa', cell: ({ row }) => peopleById.get(row.original.personId)?.nome ?? '—' },
    { accessorKey: 'percentage', header: '%', meta: { align: 'right', numeric: true } },
    {
      id: 'days',
      header: 'Dias',
      meta: { align: 'right', numeric: true },
      cell: ({ row }) => (activeGroup ? computeAllocatedDays(row.original.percentage, activeGroup.sprint.totalValidDays) : '—'),
    },
    {
      id: 'capacity',
      header: 'Capacity Points',
      meta: { align: 'right', numeric: true },
      cell: ({ row }) =>
        activeGroup
          ? pointsForEntry(row.original, activeGroup.sprint, peopleById.get(row.original.personId), levels).capacity.toFixed(1)
          : '—',
    },
    {
      id: 'max',
      header: 'Max Points',
      meta: { align: 'right', numeric: true },
      cell: ({ row }) =>
        activeGroup ? pointsForEntry(row.original, activeGroup.sprint, peopleById.get(row.original.personId), levels).max.toFixed(1) : '—',
    },
    {
      id: 'storyPoints',
      header: 'Story Points',
      meta: { align: 'right', numeric: true },
      cell: ({ row }) =>
        activeGroup ? personPoints(workItems, activeGroup.squad, activeGroup.sprint, peopleById.get(row.original.personId)).storyPoints : '—',
    },
    {
      id: 'pontoExecucao',
      header: 'Pontos de Execução',
      meta: { align: 'right', numeric: true },
      cell: ({ row }) =>
        activeGroup
          ? personPoints(workItems, activeGroup.squad, activeGroup.sprint, peopleById.get(row.original.personId)).pontoExecucao
          : '—',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...row.original })
              setError(null)
            }}
            aria-label="Editar"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.original.id)}
            aria-label="Excluir"
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-brand-action-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  const modal = (
    <Modal
      open={draft !== null}
      onClose={() => setDraft(null)}
      title={draft?.id ? 'Editar alocação' : 'Adicionar alocação'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Salvar
          </Button>
        </>
      }
    >
      {draft && (
        <div className="flex flex-col gap-4">
          {error && <p className="text-sm text-brand-action-danger">{error}</p>}

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Pessoa</label>
            <Select
              value={draft.personId}
              onChange={(e) => setDraft({ ...draft, personId: e.target.value, squadId: '' })}
              placeholder="Selecione uma pessoa"
              options={people.map((person) => ({ value: person.id, label: person.nome }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Squad</label>
            {selectedPerson && availableSquads.length === 0 ? (
              <p className="text-sm text-[var(--text)]">Pessoa sem squads vinculadas.</p>
            ) : (
              <Select
                value={draft.squadId}
                onChange={(e) => setDraft({ ...draft, squadId: e.target.value })}
                placeholder="Selecione uma squad"
                disabled={!selectedPerson}
                options={availableSquads.map((squad) => ({ value: squad.id, label: squad.name }))}
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Sprint</label>
            <Select
              value={draft.sprintId}
              onChange={(e) => setDraft({ ...draft, sprintId: e.target.value })}
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
              value={draft.percentage}
              onChange={(e) => setDraft({ ...draft, percentage: Number(e.target.value) })}
            />
          </div>

          {selectedSprint && (
            <p className="text-sm text-[var(--text)]">
              Dias calculados: {computeAllocatedDays(draft.percentage, selectedSprint.totalValidDays)} de{' '}
              {selectedSprint.totalValidDays}
            </p>
          )}
        </div>
      )}
    </Modal>
  )

  const moveModal = activeGroup && (
    <Modal
      open={moveSquadId !== null}
      onClose={() => setMoveSquadId(null)}
      title="Alterar squad de todos"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => setMoveSquadId(null)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleMoveGroup}>
            Mover {activeGroup.entries.length} {activeGroup.entries.length === 1 ? 'pessoa' : 'pessoas'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {moveError && <p className="text-sm text-brand-action-danger">{moveError}</p>}
        <p className="text-sm text-[var(--text)]">
          Todas as pessoas de {activeGroup.squad.name} em {formatSprintLabel(activeGroup.sprint)} passam para a squad
          escolhida, mantendo as porcentagens. Quem ainda não tiver vínculo com ela é vinculado automaticamente.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text)]">Nova squad</label>
          <Select
            value={moveSquadId ?? ''}
            onChange={(e) => setMoveSquadId(e.target.value)}
            placeholder="Selecione uma squad"
            options={squads
              .filter((squad) => squad.id !== activeGroup.squadId)
              .map((squad) => ({ value: squad.id, label: squad.name }))}
          />
        </div>
      </div>
    </Modal>
  )

  if (activeGroup) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              aria-label="Voltar"
              className="rounded-md p-1.5 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-[var(--text-h)]">
              {activeGroup.squad.name} — {formatSprintLabel(activeGroup.sprint)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={activeGroup.entries.length === 0}
              onClick={() => {
                setMoveSquadId('')
                setMoveError(null)
              }}
            >
              Alterar squad de todos
            </Button>
            <Button
              type="button"
              onClick={() => openCreateModal({ squadId: activeGroup.squadId, sprintId: activeGroup.sprintId })}
            >
              Adicionar pessoa
            </Button>
          </div>
        </div>

        <p className="text-sm text-[var(--text)]">
          Capacity Points: {activeGroup.capacityPoints.toFixed(1)} · Max Points: {activeGroup.maxPoints.toFixed(1)} · Story
          Points: {activeGroup.storyPoints}
        </p>

        <DataTable columns={entryColumns} data={activeGroup.entries} emptyMessage="Nenhuma pessoa alocada." />

        {modal}
        {moveModal}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text)]">
          Alocações agrupadas por squad e sprint — clique numa linha para ver o detalhamento por pessoa.
        </p>
        <Button type="button" onClick={() => openCreateModal()}>
          Adicionar alocação
        </Button>
      </div>

      <DataTable
        columns={groupColumns}
        data={groups}
        emptyMessage="Nenhuma alocação cadastrada."
        onRowClick={(group) => setSelectedGroup({ squadId: group.squadId, sprintId: group.sprintId })}
      />

      {modal}
    </div>
  )
}
