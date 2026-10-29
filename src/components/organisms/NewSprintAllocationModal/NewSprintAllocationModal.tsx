import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Checkbox } from '../../atoms/Checkbox/Checkbox'
import { COMPACT_FIELD_CLASSES } from '../../atoms/Input/compactFieldClasses'
import { Select } from '../../atoms/Select/Select'
import type { Person } from '../../../lib/peopleStorage'
import type { Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, type Sprint } from '../../../lib/sprintsStorage'
import {
  buildDefaultAllocation,
  computeAllocatedDays,
  remainingPercentage,
  sumPercentageForPersonInSprint,
  validateAllocationPercentages,
  type AllocationDraft,
  type PersonAllocation,
} from '../../../lib/personAllocationsStorage'

export interface NewSprintAllocationModalProps {
  open: boolean
  onClose: () => void
  people: Person[]
  squads: Squad[]
  sprints: Sprint[]
  allocations: PersonAllocation[]
  /** Grava as alocações; devolve uma mensagem de erro ou null quando deu certo. */
  onSave: (entries: Omit<PersonAllocation, 'id'>[]) => string | null
  /** Abre o grupo squad/sprint que já existe. */
  onOpenGroup: (squadId: string, sprintId: string) => void
}

const percentInput = `${COMPACT_FIELD_CLASSES} w-24 text-right`

// Passo "Nova alocação de sprint": escolhe squad e sprint e já traz os membros da squad com o
// que sobra para cada um na sprint (100% menos o que já têm em outras squads). Dá para
// desmarcar, ajustar a %, incluir alguém de fora da squad e salvar todos de uma vez.
export function NewSprintAllocationModal({
  open,
  onClose,
  people,
  squads,
  sprints,
  allocations,
  onSave,
  onOpenGroup,
}: NewSprintAllocationModalProps) {
  const [squadId, setSquadId] = useState('')
  const [sprintId, setSprintId] = useState('')
  const [drafts, setDrafts] = useState<AllocationDraft[]>([])
  const [error, setError] = useState<string | null>(null)

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const sprint = sprints.find((s) => s.id === sprintId)
  const squad = squads.find((s) => s.id === squadId)
  const existingCount = allocations.filter((a) => a.squadId === squadId && a.sprintId === sprintId).length

  function reset(nextSquadId: string, nextSprintId: string) {
    setSquadId(nextSquadId)
    setSprintId(nextSprintId)
    setDrafts(nextSquadId && nextSprintId ? buildDefaultAllocation(people, allocations, nextSquadId, nextSprintId) : [])
    setError(null)
  }

  function close() {
    reset('', '')
    onClose()
  }

  function updateDraft(personId: string, patch: Partial<AllocationDraft>) {
    setDrafts((current) => current.map((d) => (d.personId === personId ? { ...d, ...patch } : d)))
  }

  const selected = drafts.filter((d) => d.selected)
  const errors = validateAllocationPercentages(
    allocations,
    selected.map((d) => ({ id: '', personId: d.personId, sprintId, percentage: d.percentage })),
  )

  // Pessoas de fora da lista e do grupo, para incluir à mão.
  const inGroup = new Set(allocations.filter((a) => a.squadId === squadId && a.sprintId === sprintId).map((a) => a.personId))
  const extraOptions = people
    .filter((p) => !inGroup.has(p.id) && !drafts.some((d) => d.personId === p.id))
    .map((p) => ({ value: p.id, label: p.nome }))

  function addExtra(personId: string) {
    if (!personId) return
    const used = sumPercentageForPersonInSprint(allocations, personId, sprintId)
    const percentage = remainingPercentage(allocations, personId, sprintId)
    setDrafts((current) => [...current, { personId, percentage, used, selected: true }])
  }

  function handleSave() {
    if (!squadId || !sprintId) return setError('Escolha a squad e a sprint.')
    if (selected.length === 0) return setError('Marque ao menos uma pessoa.')
    if (errors.size > 0) return setError('Ajuste as % marcadas em vermelho.')
    const message = onSave(selected.map((d) => ({ personId: d.personId, squadId, sprintId, percentage: d.percentage })))
    if (message) return setError(message)
    reset('', '')
  }

  const allSelected = drafts.length > 0 && drafts.every((d) => d.selected)

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Nova alocação de sprint"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={selected.length === 0}>
            Alocar {selected.length} {selected.length === 1 ? 'pessoa' : 'pessoas'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-brand-action-danger">{error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Squad</label>
            <Select
              aria-label="Squad"
              value={squadId}
              onChange={(value) => reset(value, sprintId)}
              placeholder="Selecione uma squad"
              options={squads.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Sprint</label>
            <Select
              aria-label="Sprint"
              value={sprintId}
              onChange={(value) => reset(squadId, value)}
              placeholder="Selecione uma sprint"
              options={sprints.map((s) => ({ value: s.id, label: formatSprintLabel(s) }))}
            />
          </div>
        </div>

        {squad && sprint && (
          <>
            {existingCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--code-bg)] px-3 py-2 text-sm text-[var(--text)]">
                <span>
                  {squad.name} já tem {existingCount} {existingCount === 1 ? 'pessoa alocada' : 'pessoas alocadas'} nesta sprint;
                  aqui aparece só quem falta.
                </span>
                <Button type="button" size="sm" variant="secondary" onClick={() => onOpenGroup(squadId, sprintId)}>
                  Abrir alocação existente
                </Button>
              </div>
            )}

            <p className="text-sm text-[var(--text)]">
              Membros de {squad.name} com o que sobra para cada um na sprint ({sprint.totalValidDays} dias válidos). Quem
              já está 100% em outras squads vem desmarcado.
            </p>

            {drafts.length === 0 ? (
              <p className="text-sm text-[var(--text)]">
                Nenhum membro de {squad.name} para alocar. Vincule pessoas à squad ou inclua alguém abaixo.
              </p>
            ) : (
              <table className="w-full text-sm" aria-label="Pessoas da alocação">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text)]">
                    <th className="w-8 py-2">
                      <Checkbox
                        aria-label="Marcar todos"
                        checked={allSelected}
                        indeterminate={!allSelected && selected.length > 0}
                        onChange={() => setDrafts((current) => current.map((d) => ({ ...d, selected: !allSelected })))}
                      />
                    </th>
                    <th className="py-2">Pessoa</th>
                    <th className="py-2 text-right">Em outras squads</th>
                    <th className="py-2 text-right">%</th>
                    <th className="py-2 text-right">Dias</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => {
                    const person = peopleById.get(draft.personId)
                    const rowError = draft.selected ? errors.get(draft.personId) : undefined
                    const isMember = person?.squadIds.includes(squadId)
                    return (
                      <tr key={draft.personId} className="border-b border-[var(--border)] last:border-0">
                        <td className="py-2">
                          <Checkbox
                            aria-label={`Alocar ${person?.nome ?? ''}`}
                            checked={draft.selected}
                            onChange={() => updateDraft(draft.personId, { selected: !draft.selected })}
                          />
                        </td>
                        <td className="py-2 text-[var(--text-h)]">
                          {person?.nome ?? '—'}
                          <span className="ml-2 text-xs text-[var(--text)]">
                            {person?.nivel}
                            {!isMember && ' · fora da squad'}
                          </span>
                          {rowError && <p className="text-xs text-brand-action-danger">{rowError}</p>}
                        </td>
                        <td className="py-2 text-right text-[var(--text)]">{draft.used > 0 ? `${draft.used}%` : '—'}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`% de ${person?.nome ?? ''}`}
                            value={draft.percentage}
                            disabled={!draft.selected}
                            onChange={(e) => updateDraft(draft.personId, { percentage: Number(e.target.value) })}
                            className={`${percentInput} ${rowError ? 'border-brand-action-danger' : ''}`}
                          />
                        </td>
                        <td className="py-2 text-right text-[var(--text)]">
                          {computeAllocatedDays(draft.selected ? draft.percentage : 0, sprint.totalValidDays)}
                        </td>
                        <td className="py-2 text-right">
                          {!isMember && (
                            <button
                              type="button"
                              aria-label={`Tirar ${person?.nome ?? ''} da lista`}
                              onClick={() => setDrafts((current) => current.filter((d) => d.personId !== draft.personId))}
                              className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-brand-action-danger"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Incluir outra pessoa</label>
              <Select
                aria-label="Incluir outra pessoa"
                value=""
                onChange={addExtra}
                placeholder="Buscar pessoa de fora da squad"
                noOptionsText="Todo mundo já está na lista"
                options={extraOptions}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
