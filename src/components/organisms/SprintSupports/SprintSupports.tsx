import { useState } from 'react'
import { AlertTriangle, Copy, HeartHandshake, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '../DataTable/DataTable'
import { EditableCell } from '../DataTable/EditableCell'
import { Button } from '../../atoms/Button/Button'
import { SupportForm } from '../../molecules/SupportForm/SupportForm'
import { UndoNotice } from '../../molecules/UndoNotice/UndoNotice'
import { useUndo } from '../../../hooks/useUndo'
import { supportIssue, type PersonSupport, type SupportContext, type SupportDraft } from '../../../lib/personSupportsStorage'
import { formatSprintLabel, type Sprint } from '../../../lib/sprintsStorage'

export interface SprintSupportsProps {
  sprint: Sprint
  /** Sprint anterior, de onde "Copiar apoios" traz os pares; sem ela, o botão fica desabilitado. */
  previousSprint?: Sprint
  /** Apoios desta sprint. */
  supports: PersonSupport[]
  context: SupportContext
  /** As ações devolvem uma mensagem de erro, ou null quando deu certo. */
  onAdd: (draft: SupportDraft) => string | null
  /** Remove e devolve os apoios removidos (para o Desfazer). */
  onRemove: (ids: string[]) => PersonSupport[]
  onRestore: (entries: PersonSupport[]) => void
  onSetPercentage: (id: string, percentage: number) => string | null
  /** Devolve quantos pares foram copiados. */
  onCopyPrevious: () => number
}

// "Apoios da sprint": quem está apoiando (mentorando) quem nesta sprint e com quanto, em % da carga do
// apoiado. Esse apoio entra como crédito no status "com apoio" de quem apoia, na visão da pessoa.
export function SprintSupports({
  sprint,
  previousSprint,
  supports,
  context,
  onAdd,
  onRemove,
  onRestore,
  onSetPercentage,
  onCopyPrevious,
}: SprintSupportsProps) {
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** Muda quando uma edição inline é recusada, para a célula voltar ao valor salvo. */
  const [revision, setRevision] = useState(0)
  const { undo, offer, clear } = useUndo<PersonSupport>()

  const nameOf = (personId: string) => context.people.find((p) => p.id === personId)?.nome ?? '—'
  const allocatedIds = new Set(context.allocations.filter((a) => a.sprintId === sprint.id && a.percentage > 0).map((a) => a.personId))
  const candidates = context.people.filter((p) => allocatedIds.has(p.id))

  function remove(support: PersonSupport) {
    const removed = onRemove([support.id])
    if (removed.length === 0) return
    offer(removed, `Apoio de ${nameOf(support.supporterId)} a ${nameOf(support.supportedId)} removido`)
  }

  function handlePercentage(support: PersonSupport, value: string) {
    const message = onSetPercentage(support.id, Number(value))
    setError(message)
    if (message !== null) setRevision((r) => r + 1)
  }

  function handleCopy() {
    const copied = onCopyPrevious()
    setNotice(copied > 0 ? `${copied} ${copied === 1 ? 'apoio copiado' : 'apoios copiados'} de ${previousSprint ? formatSprintLabel(previousSprint) : 'sprint anterior'}.` : 'Nenhum apoio novo para copiar.')
  }

  const columns: ColumnDef<PersonSupport, unknown>[] = [
    { id: 'supporter', header: 'Quem apoia', accessorFn: (s) => nameOf(s.supporterId) },
    { id: 'supported', header: 'Apoiado', accessorFn: (s) => nameOf(s.supportedId) },
    {
      accessorKey: 'percentage',
      header: '% do apoiado',
      cell: ({ row }) => (
        <EditableCell
          key={`${row.original.id}-${row.original.percentage}-${revision}`}
          type="number"
          value={String(row.original.percentage)}
          onCommit={(value) => handlePercentage(row.original, value)}
        />
      ),
      meta: { align: 'right', numeric: true },
    },
    {
      id: 'issue',
      header: 'Situação',
      accessorFn: (s) => supportIssue(s, context) ?? 'Valendo',
      cell: ({ row }) => {
        const issue = supportIssue(row.original, context)
        return issue ? (
          <span className="inline-flex items-center gap-1 text-xs text-brand-action-alert">
            <AlertTriangle size={12} aria-hidden="true" /> {issue} Fora do cálculo.
          </span>
        ) : (
          <span className="text-xs text-[var(--text)]">Valendo</span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => remove(row.original)}
          aria-label={`Remover apoio de ${nameOf(row.original.supporterId)} a ${nameOf(row.original.supportedId)}`}
          className="rounded p-1 text-[var(--text)] hover:bg-[var(--code-bg)] hover:text-brand-action-danger"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ]

  return (
    <section aria-label="Apoios da sprint" className="flex flex-col gap-3 rounded-md border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-h)]">
            <HeartHandshake size={16} aria-hidden="true" /> Apoios da sprint
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text)]">
            Quem está apoiando outra pessoa nesta sprint. A % vale sobre a carga do apoiado e entra como crédito no status "com
            apoio" de quem apoia; os números do apoiado não mudam.
          </p>
        </div>
        <Button type="button" variant="secondary" className="h-10" disabled={!previousSprint} onClick={handleCopy}>
          <Copy size={14} />
          {previousSprint ? `Copiar de ${formatSprintLabel(previousSprint)}` : 'Sem sprint anterior'}
        </Button>
      </div>

      <SupportForm people={candidates} cargos={context.cargos} onSubmit={(draft) => onAdd({ ...draft, sprintId: sprint.id })} />

      {notice && (
        <p aria-live="polite" className="text-sm text-[var(--text-h)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-brand-action-danger">
          {error}
        </p>
      )}
      {undo && (
        <UndoNotice
          label={undo.label}
          onUndo={() => {
            onRestore(undo.items)
            clear()
          }}
          onClose={clear}
        />
      )}

      <DataTable columns={columns} data={supports} getRowId={(s) => s.id} emptyMessage="Nenhum apoio cadastrado nesta sprint." />
    </section>
  )
}
