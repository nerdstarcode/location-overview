import { useState } from 'react'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { Select } from '../../atoms/Select/Select'
import type { Person } from '../../../lib/peopleStorage'
import type { Squad } from '../../../lib/squadsStorage'
import { formatSprintLabel, type Sprint } from '../../../lib/sprintsStorage'
import { computeAllocatedDays, type PersonAllocation } from '../../../lib/personAllocationsStorage'

export interface AllocationEditModalProps {
  /** Alocação em edição; null = fechado. Renderize com `key={entry?.id}` para recomeçar o rascunho. */
  entry: PersonAllocation | null
  person: Person | undefined
  squads: Squad[]
  sprints: Sprint[]
  onClose: () => void
  /** Devolve a mensagem de erro, ou null quando salvou. */
  onSave: (entry: PersonAllocation) => string | null
}

// Edição de uma alocação (trocar squad, sprint ou %); a criação é pelos fluxos de lote.
export function AllocationEditModal({ entry, person, squads, sprints, onClose, onSave }: AllocationEditModalProps) {
  const [draft, setDraft] = useState<PersonAllocation | null>(entry)
  const [error, setError] = useState<string | null>(null)
  const sprint = draft ? sprints.find((s) => s.id === draft.sprintId) : undefined

  function handleSave() {
    if (!draft) return
    const message = onSave(draft)
    if (message) setError(message)
    else onClose()
  }

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={`Editar alocação${person ? ` — ${person.nome}` : ''}`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
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
            <label className="text-xs text-[var(--text)]">Squad</label>
            <Select
              value={draft.squadId}
              onChange={(value) => setDraft({ ...draft, squadId: value })}
              placeholder="Selecione uma squad"
              options={squads.map((squad) => ({ value: squad.id, label: squad.name }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Sprint</label>
            <Select
              value={draft.sprintId}
              onChange={(value) => setDraft({ ...draft, sprintId: value })}
              placeholder="Selecione uma sprint"
              options={sprints.map((s) => ({ value: s.id, label: formatSprintLabel(s) }))}
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

          {sprint && (
            <p className="text-sm text-[var(--text)]">
              Dias calculados: {computeAllocatedDays(draft.percentage, sprint.totalValidDays)} de {sprint.totalValidDays}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
