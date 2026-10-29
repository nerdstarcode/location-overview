import { useState } from 'react'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import { isValidFiscalYear, type Sprint } from '../../../lib/sprintsStorage'

export interface SprintFormModalProps {
  /** Sprint em edição (id vazio = nova); null = fechado. Renderize com `key` para recomeçar o rascunho. */
  sprint: Sprint | null
  onClose: () => void
  onSave: (sprint: Sprint) => void
}

// Cadastro de uma sprint: número, Fiscal Year, datas e dias válidos.
export function SprintFormModal({ sprint, onClose, onSave }: SprintFormModalProps) {
  const [draft, setDraft] = useState<Sprint | null>(sprint)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!draft) return
    if (!isValidFiscalYear(draft.fiscalYear)) return setError('Fiscal Year deve estar no formato FY25-26.')
    if (!draft.startDate || !draft.endDate) return setError('Data de início e fim são obrigatórias.')
    if (draft.startDate > draft.endDate) return setError('Data de início não pode ser depois da data de fim.')
    onSave({ ...draft, fiscalYear: draft.fiscalYear.trim().toUpperCase() })
  }

  return (
    <Modal
      open={sprint !== null}
      onClose={onClose}
      title={sprint?.id ? 'Editar sprint' : 'Adicionar sprint'}
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
            <label className="text-xs text-[var(--text)]">Número da sprint</label>
            <Input type="number" min={1} value={draft.number} onChange={(e) => setDraft({ ...draft, number: Number(e.target.value) })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Fiscal Year (ex.: FY25-26)</label>
            <Input value={draft.fiscalYear} onChange={(e) => setDraft({ ...draft, fiscalYear: e.target.value })} placeholder="FY25-26" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Data de início</label>
            <Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Data de fim</label>
            <Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text)]">Dias válidos</label>
            <Input
              type="number"
              min={0}
              value={draft.totalValidDays}
              onChange={(e) => setDraft({ ...draft, totalValidDays: Number(e.target.value) })}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
