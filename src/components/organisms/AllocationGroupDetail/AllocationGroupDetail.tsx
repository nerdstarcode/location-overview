import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { EditableCell } from '../DataTable/EditableCell'
import { Button } from '../../atoms/Button/Button'
import { COMPACT_FIELD_CLASSES } from '../../atoms/Input/compactFieldClasses'
import { Select } from '../../atoms/Select/Select'
import type { LevelConfig } from '../../../lib/levelsStorage'
import type { Person } from '../../../lib/peopleStorage'
import type { Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, type Sprint } from '../../../lib/sprintsStorage'
import type { WorkItemRow } from '../../../lib/workItems'
import { personPoints } from '../../../lib/allocationWorkItems'
import {
  buildDefaultAllocation,
  computeAllocatedDays,
  pointsForEntry,
  remainingPercentage,
  type PersonAllocation,
} from '../../../lib/personAllocationsStorage'

/** Quanto tempo o "Desfazer" fica na tela depois de remover. */
const UNDO_TIMEOUT_MS = 8000

export interface AllocationGroupDetailProps {
  squad: Squad
  sprint: Sprint
  /** Alocações deste grupo (squad + sprint). */
  entries: PersonAllocation[]
  /** Todas as alocações, para calcular o que sobra para cada pessoa na sprint. */
  allocations: PersonAllocation[]
  people: Person[]
  squads: Squad[]
  levels: LevelConfig[]
  workItems: WorkItemRow[]
  summary: { capacityPoints: number; maxPoints: number; storyPoints: number }
  onBack: () => void
  /** As ações devolvem uma mensagem de erro, ou null quando deu certo. */
  onAdd: (entries: Omit<PersonAllocation, 'id'>[]) => string | null
  /** Remove e devolve as alocações removidas (para o Desfazer). */
  onRemove: (ids: string[]) => PersonAllocation[]
  onRestore: (entries: PersonAllocation[]) => void
  onSetPercentage: (ids: string[], percentage: number) => string | null
  onMove: (ids: string[], squadId: string) => string | null
  onEdit: (entry: PersonAllocation) => void
}

const percentInput = `${COMPACT_FIELD_CLASSES} w-24 text-right`
const fieldLabel = 'text-xs text-[var(--text)]'

// Detalhe de uma squad numa sprint, feito para ajustes rápidos: adicionar pela linha do topo
// (autocomplete + % que sobra + Enter), puxar os membros da squad que faltam, editar a % na
// própria tabela, remover com "Desfazer" e agir em lote sobre as linhas marcadas.
export function AllocationGroupDetail({
  squad,
  sprint,
  entries,
  allocations,
  people,
  squads,
  levels,
  workItems,
  summary,
  onBack,
  onAdd,
  onRemove,
  onRestore,
  onSetPercentage,
  onMove,
  onEdit,
}: AllocationGroupDetailProps) {
  const [newPersonId, setNewPersonId] = useState('')
  const [newPercentage, setNewPercentage] = useState(100)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPercentage, setBulkPercentage] = useState(100)
  const [moveSquadId, setMoveSquadId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ entries: PersonAllocation[]; label: string } | null>(null)
  /** Muda quando uma edição inline é recusada, para a célula voltar ao valor salvo. */
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [undo])

  const peopleById = new Map(people.map((p) => [p.id, p]))
  const nameOf = (personId: string) => peopleById.get(personId)?.nome ?? '—'
  const inGroup = new Set(entries.map((e) => e.personId))
  // Selecionados que ainda existem (uma remoção ou mudança de squad tira linhas do grupo).
  const selected = entries.filter((e) => selectedIds.has(e.id))

  // Membros da squad primeiro, depois o resto, cada parte em ordem alfabética.
  const candidates = people
    .filter((p) => !inGroup.has(p.id))
    .sort((a, b) => Number(b.squadIds.includes(squad.id)) - Number(a.squadIds.includes(squad.id)) || a.nome.localeCompare(b.nome))
  const missingMembers = buildDefaultAllocation(people, allocations, squad.id, sprint.id).filter((d) => d.selected)

  function report(message: string | null): boolean {
    setError(message)
    return message === null
  }

  function selectPerson(personId: string) {
    setNewPersonId(personId)
    if (personId) setNewPercentage(remainingPercentage(allocations, personId, sprint.id))
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (!newPersonId) return report('Escolha a pessoa.')
    if (report(onAdd([{ personId: newPersonId, squadId: squad.id, sprintId: sprint.id, percentage: newPercentage }]))) {
      setNewPersonId('')
      setNewPercentage(100)
    }
  }

  function handleAddMembers() {
    report(onAdd(missingMembers.map((d) => ({ personId: d.personId, squadId: squad.id, sprintId: sprint.id, percentage: d.percentage }))))
  }

  function remove(ids: string[]) {
    const removed = onRemove(ids)
    if (removed.length === 0) return
    setSelectedIds(new Set())
    setError(null)
    setUndo({
      entries: removed,
      label: removed.length === 1 ? `${nameOf(removed[0].personId)} removido(a)` : `${removed.length} pessoas removidas`,
    })
  }

  function handleUndo() {
    if (!undo) return
    onRestore(undo.entries)
    setUndo(null)
  }

  function handleInlinePercentage(entry: PersonAllocation, value: string) {
    if (!report(onSetPercentage([entry.id], Number(value)))) setRevision((r) => r + 1)
  }

  function handleBulkPercentage() {
    if (report(onSetPercentage(selected.map((e) => e.id), bulkPercentage))) setSelectedIds(new Set())
  }

  function handleMove() {
    if (!moveSquadId) return report('Escolha a squad destino.')
    if (report(onMove(selected.map((e) => e.id), moveSquadId))) {
      setSelectedIds(new Set())
      setMoveSquadId('')
    }
  }

  function toggleRow(entry: PersonAllocation) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(entry.id)) next.delete(entry.id)
      else next.add(entry.id)
      return next
    })
  }

  function togglePage(rows: PersonAllocation[]) {
    setSelectedIds((current) => {
      const allOn = rows.every((r) => current.has(r.id))
      const next = new Set(current)
      for (const row of rows) {
        if (allOn) next.delete(row.id)
        else next.add(row.id)
      }
      return next
    })
  }

  const pointsOf = (entry: PersonAllocation) => pointsForEntry(entry, sprint, peopleById.get(entry.personId), levels)
  const workOf = (entry: PersonAllocation) => personPoints(workItems, squad, sprint, peopleById.get(entry.personId))

  const columns: ColumnDef<PersonAllocation, unknown>[] = [
    {
      id: 'person',
      header: 'Pessoa',
      cell: ({ row }) => nameOf(row.original.personId),
      meta: { searchValue: (entry: PersonAllocation) => nameOf(entry.personId) },
    },
    {
      accessorKey: 'percentage',
      header: '%',
      cell: ({ row }) => (
        <EditableCell
          key={`${row.original.id}-${row.original.percentage}-${revision}`}
          type="number"
          value={String(row.original.percentage)}
          onCommit={(value) => handleInlinePercentage(row.original, value)}
        />
      ),
      meta: { align: 'right', numeric: true },
    },
    { id: 'days', header: 'Dias', cell: ({ row }) => computeAllocatedDays(row.original.percentage, sprint.totalValidDays), meta: { align: 'right', numeric: true } },
    { id: 'capacity', header: 'Capacity Points', cell: ({ row }) => pointsOf(row.original).capacity.toFixed(1), meta: { align: 'right', numeric: true } },
    { id: 'max', header: 'Max Points', cell: ({ row }) => pointsOf(row.original).max.toFixed(1), meta: { align: 'right', numeric: true } },
    { id: 'storyPoints', header: 'Story Points', cell: ({ row }) => workOf(row.original).storyPoints, meta: { align: 'right', numeric: true } },
    { id: 'pontoExecucao', header: 'Pontos de Execução', cell: ({ row }) => workOf(row.original).pontoExecucao, meta: { align: 'right', numeric: true } },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(row.original)}
            aria-label={`Editar ${nameOf(row.original.personId)}`}
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => remove([row.original.id])}
            aria-label={`Remover ${nameOf(row.original.personId)}`}
            className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-brand-action-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  const totalPercentage = entries.reduce((sum, e) => sum + e.percentage, 0)

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="rounded-md p-1.5 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-[var(--text-h)]">
            {squad.name} — {formatSprintLabel(sprint)}
          </h2>
        </div>
        <Button type="button" variant="secondary" className="h-10" disabled={missingMembers.length === 0} onClick={handleAddMembers}>
          <UserPlus size={14} />
          {missingMembers.length > 0
            ? `Adicionar membros da squad (${missingMembers.length})`
            : 'Todos os membros da squad já estão aqui'}
        </Button>
      </div>

      <p className="text-sm text-[var(--text)]">
        {entries.length} {entries.length === 1 ? 'pessoa' : 'pessoas'} · {totalPercentage}% somados · Capacity Points:{' '}
        {summary.capacityPoints.toFixed(1)} · Max Points: {summary.maxPoints.toFixed(1)} · Story Points: {summary.storyPoints}
      </p>

      {/* Adição rápida: escolher a pessoa já preenche a % com o que sobra para ela na sprint. */}
      <form
        onSubmit={handleAdd}
        aria-label="Adicionar pessoa"
        className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--border)] p-3"
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <label className={fieldLabel}>Adicionar pessoa</label>
          <Select
            size="sm"
            aria-label="Pessoa para adicionar"
            value={newPersonId}
            onChange={selectPerson}
            placeholder="Buscar pessoa (membros da squad primeiro)"
            noOptionsText="Todo mundo já está alocado aqui"
            options={candidates.map((p) => ({
              value: p.id,
              label: p.squadIds.includes(squad.id) ? p.nome : `${p.nome} (fora da squad)`,
            }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabel}>%</label>
          <input
            type="number"
            min={0}
            max={100}
            aria-label="% da nova pessoa"
            value={newPercentage}
            onChange={(e) => setNewPercentage(Number(e.target.value))}
            className={percentInput}
          />
        </div>
        <Button type="submit" className="h-10" disabled={!newPersonId}>
          <Plus size={14} /> Adicionar
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-brand-action-danger">
          {error}
        </p>
      )}

      {undo && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-md bg-[var(--code-bg)] px-3 py-2 text-sm text-[var(--text-h)]">
          <span>{undo.label}</span>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="secondary" onClick={handleUndo}>
              Desfazer
            </Button>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setUndo(null)}
              className="rounded p-1 text-[var(--text)] hover:text-[var(--text-h)]"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Ações em lote"
          className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-md border border-blue-500/40 bg-blue-500/5 p-3"
        >
          <div className="flex flex-col gap-1">
            <span className={fieldLabel}>Seleção</span>
            <span className="flex h-10 items-center text-sm font-medium text-[var(--text-h)]">
              {selected.length} {selected.length === 1 ? 'selecionada' : 'selecionadas'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label className={fieldLabel}>Definir %</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                aria-label="% para as selecionadas"
                value={bulkPercentage}
                onChange={(e) => setBulkPercentage(Number(e.target.value))}
                className={percentInput}
              />
              <Button type="button" variant="secondary" className="h-10" onClick={handleBulkPercentage}>
                Aplicar
              </Button>
            </div>
          </div>
          <div className="flex min-w-64 flex-col gap-1">
            <label className={fieldLabel}>Mover para squad</label>
            <div className="flex gap-2">
              <Select
                size="sm"
                aria-label="Squad destino"
                value={moveSquadId}
                onChange={setMoveSquadId}
                placeholder="Escolha a squad"
                options={squads.filter((s) => s.id !== squad.id).map((s) => ({ value: s.id, label: s.name }))}
              />
              <Button type="button" variant="secondary" className="h-10" onClick={handleMove}>
                Mover
              </Button>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="secondary" className="h-10" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 hover:text-brand-action-danger"
              onClick={() => remove(selected.map((e) => e.id))}
            >
              <Trash2 size={14} /> Remover
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={entries}
        emptyMessage="Nenhuma pessoa alocada. Adicione acima ou puxe os membros da squad."
        selectable
        getRowId={(entry) => entry.id}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onTogglePage={togglePage}
        rowSelectionAriaLabel={(entry) => `Selecionar ${nameOf(entry.personId)}`}
      />
    </div>
  )
}
