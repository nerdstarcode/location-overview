import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Input } from '../../atoms/Input/Input'
import {
  DEFAULT_TOTAL_VALID_DAYS,
  deleteSprint,
  formatSprintLabel,
  isValidFiscalYear,
  loadSprints,
  upsertSprint,
  type Sprint,
} from '../../../lib/sprintsStorage'
import { createId } from '../../../lib/createId'

const EMPTY_DRAFT: Sprint = {
  id: '',
  number: 1,
  fiscalYear: '',
  startDate: '',
  endDate: '',
  totalValidDays: DEFAULT_TOTAL_VALID_DAYS,
}

// Catálogo global de sprints (Número, Fiscal Year, datas e dias válidos),
// persistido em localStorage via sprintsStorage.ts.
export function SprintsTable() {
  const [sprints, setSprints] = useState<Sprint[]>(loadSprints)
  const [draft, setDraft] = useState<Sprint | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!draft) return
    if (!isValidFiscalYear(draft.fiscalYear)) {
      setError('Fiscal Year deve estar no formato FY25-26.')
      return
    }
    if (!draft.startDate || !draft.endDate) {
      setError('Data de início e fim são obrigatórias.')
      return
    }
    if (draft.startDate > draft.endDate) {
      setError('Data de início não pode ser depois da data de fim.')
      return
    }
    const saved: Sprint = { ...draft, id: draft.id || createId(), fiscalYear: draft.fiscalYear.trim().toUpperCase() }
    setSprints(upsertSprint(saved))
    setDraft(null)
    setError(null)
  }

  function handleDelete(id: string) {
    setSprints(deleteSprint(id))
  }

  const columns: ColumnDef<Sprint, unknown>[] = [
    { accessorKey: 'number', header: 'Sprint', meta: { align: 'right', headerAlign: 'left', numeric: true }, cell: ({ row }) => formatSprintLabel(row.original) },
    { accessorKey: 'startDate', header: 'Início' },
    { accessorKey: 'endDate', header: 'Fim' },
    { accessorKey: 'totalValidDays', header: 'Dias válidos', meta: { align: 'right', numeric: true } },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setDraft(row.original)
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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text)]">
          Catálogo global de sprints: Fiscal Year, data de início/fim e dias válidos.
        </p>
        <Button
          type="button"
          onClick={() => {
            setDraft(EMPTY_DRAFT)
            setError(null)
          }}
        >
          Adicionar sprint
        </Button>
      </div>

      <DataTable columns={columns} data={sprints} emptyMessage="Nenhuma sprint cadastrada." />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Editar sprint' : 'Adicionar sprint'}
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
              <label className="text-xs text-[var(--text)]">Número da sprint</label>
              <Input
                type="number"
                min={1}
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text)]">Fiscal Year (ex.: FY25-26)</label>
              <Input
                value={draft.fiscalYear}
                onChange={(e) => setDraft({ ...draft, fiscalYear: e.target.value })}
                placeholder="FY25-26"
              />
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
    </div>
  )
}
