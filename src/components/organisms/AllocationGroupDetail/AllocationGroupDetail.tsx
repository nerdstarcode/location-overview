import { useState, type FormEvent } from 'react'
import { ArrowLeft, HeartHandshake, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { EditableCell } from '../DataTable/EditableCell'
import { Button } from '../../atoms/Button/Button'
import { COMPACT_FIELD_CLASSES } from '../../atoms/Input/compactFieldClasses'
import { Select } from '../../atoms/Select/Select'
import { Chip } from '../../atoms/Chip/Chip'
import { Modal } from '../../molecules/Modal/Modal'
import { SupportForm } from '../../molecules/SupportForm/SupportForm'
import { UndoNotice } from '../../molecules/UndoNotice/UndoNotice'
import { useUndo } from '../../../hooks/useUndo'
import { round1 } from '../../../lib/numbers'
import { supportIssue, type PersonSupport, type SupportContext, type SupportDraft } from '../../../lib/personSupportsStorage'
import type { LevelConfig } from '../../../lib/levelsStorage'
import type { Person } from '../../../lib/peopleStorage'
import type { Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, type Sprint } from '../../../lib/sprintsStorage'
import type { WorkItemRow } from '../../../lib/workItems'
import { personPoints, personSprintStoryPoints } from '../../../lib/allocationWorkItems'
import {
  buildDefaultAllocation,
  computeAllocatedDays,
  pointsForEntry,
  remainingPercentage,
  type PersonAllocation,
} from '../../../lib/personAllocationsStorage'

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
  /** Apoios (mentoria) da sprint: mostra quem apoia quem e permite cadastrar pela linha. */
  support?: {
    supports: PersonSupport[]
    context: SupportContext
    onAdd: (draft: SupportDraft) => string | null
  }
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
  support,
}: AllocationGroupDetailProps) {
  const [newPersonId, setNewPersonId] = useState('')
  const [newPercentage, setNewPercentage] = useState(100)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPercentage, setBulkPercentage] = useState(100)
  const [moveSquadId, setMoveSquadId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { undo, offer, clear } = useUndo<PersonAllocation>()
  /** Muda quando uma edição inline é recusada, para a célula voltar ao valor salvo. */
  const [revision, setRevision] = useState(0)
  /** Pessoa da linha em que o atalho "Apoio" foi aberto. */
  const [supportFor, setSupportFor] = useState<string | null>(null)

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
    offer(removed, removed.length === 1 ? `${nameOf(removed[0].personId)} removido(a)` : `${removed.length} pessoas removidas`)
  }

  function handleUndo() {
    if (!undo) return
    onRestore(undo.items)
    clear()
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

  // Apoios válidos da sprint; o crédito de quem apoia é a % sobre os SP planejados do apoiado na sprint.
  const sprintSupports = support
    ? support.supports.filter((s) => s.sprintId === sprint.id && !supportIssue(s, support.context))
    : []
  const supportCredit = (s: PersonSupport) => round1((personSprintStoryPoints(workItems, sprint, peopleById.get(s.supportedId)) * s.percentage) / 100)
  const supportLabels = (personId: string) => [
    ...sprintSupports
      .filter((s) => s.supporterId === personId)
      .map((s) => `Apoia ${nameOf(s.supportedId)} (${s.percentage}%) · +${supportCredit(s)} SP`),
    ...sprintSupports.filter((s) => s.supportedId === personId).map((s) => `Apoiado por ${nameOf(s.supporterId)} (${s.percentage}%)`),
  ]
  const allocatedInSprint = new Set(allocations.filter((a) => a.sprintId === sprint.id && a.percentage > 0).map((a) => a.personId))

  const supportColumn: ColumnDef<PersonAllocation, unknown> = {
    id: 'support',
    header: 'Apoio',
    accessorFn: (entry) => supportLabels(entry.personId).join(' '),
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {supportLabels(row.original.personId).map((label) => (
          <Chip key={label} label={label} />
        ))}
      </div>
    ),
  }

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
    ...(support ? [supportColumn] : []),
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {support && (
            <button
              type="button"
              onClick={() => setSupportFor(row.original.personId)}
              aria-label={`Cadastrar apoio de ${nameOf(row.original.personId)}`}
              title="Apoio (mentoria)"
              className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
            >
              <HeartHandshake size={14} />
            </button>
          )}
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

      {undo && <UndoNotice label={undo.label} onUndo={handleUndo} onClose={clear} />}

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

      {support && (
        <Modal open={supportFor !== null} onClose={() => setSupportFor(null)} title={`Apoio de ${supportFor ? nameOf(supportFor) : ''} — ${formatSprintLabel(sprint)}`}>
          <SupportForm
            key={supportFor ?? 'fechado'}
            people={people.filter((p) => allocatedInSprint.has(p.id))}
            cargos={support.context.cargos}
            initialSupporterId={supportFor ?? ''}
            onSubmit={(draft) => {
              const message = support.onAdd({ ...draft, sprintId: sprint.id })
              if (message === null) setSupportFor(null)
              return message
            }}
          />
        </Modal>
      )}
    </div>
  )
}
