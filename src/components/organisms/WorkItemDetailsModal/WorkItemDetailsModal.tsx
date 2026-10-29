import { useMemo, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Modal } from '../../molecules/Modal/Modal'
import { Button } from '../../atoms/Button/Button'
import { Chip } from '../../atoms/Chip/Chip'
import { RequestState } from '../../molecules/RequestState/RequestState'
import { useAzureConfig } from '../../../contexts/azure/AzureConfigContext'
import { useAzureRequest } from '../../../hooks/azure/useAzureRequest'
import { getWorkItemComments, getWorkItemUpdates } from '../../../lib/azure/api'
import { workItemTimeline, type WorkItemEvent, type WorkItemEventKind } from '../../../lib/azure/mappers'
import { formatDateBR } from '../../../lib/dates'
import { DELAY_REASON_LABEL, type DelayInfo } from '../../../lib/personMetrics'
import { splitTags, type WorkItemRow } from '../../../lib/workItems'

const EVENT_LABEL: Record<WorkItemEventKind, string> = {
  state: 'Estado',
  iteration: 'Sprint (Iteration Path)',
  assignee: 'Responsável',
  points: 'Story Points',
  tags: 'Tags',
  comment: 'Comentário',
}

/** O projeto é o primeiro segmento do Iteration Path ("Portal\\Sprint 08" → "Portal"). */
function projectOf(row: WorkItemRow): string {
  return row.iterationPath.split('\\')[0]?.trim() ?? ''
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text)]">{label}</dt>
      <dd className="text-sm text-[var(--text-h)]">{children || '—'}</dd>
    </div>
  )
}

function TimelineItem({ event }: { event: WorkItemEvent }) {
  const highlight = event.kind === 'iteration' || event.kind === 'points'
  return (
    <li className="border-l-2 border-[var(--border)] pl-3">
      <p className="text-xs text-[var(--text)]">
        {formatDateBR(event.date)} · {event.author || '—'}
      </p>
      <p className={`text-sm text-[var(--text-h)] ${highlight ? 'font-semibold' : ''}`}>
        {EVENT_LABEL[event.kind]}
        {event.kind === 'comment' ? '' : `: ${event.from || '∅'} → ${event.to || '∅'}`}
      </p>
      {event.text && <p className="whitespace-pre-line text-sm text-[var(--text-h)]">{event.text}</p>}
    </li>
  )
}

function WorkItemHistory({ row }: { row: WorkItemRow }) {
  const project = projectOf(row)
  const history = useAzureRequest({
    key: `history|${project}|${row.id}`,
    fetch: async (cfg, signal) => {
      const [updates, comments] = await Promise.all([
        getWorkItemUpdates(cfg, row.id, signal),
        getWorkItemComments(cfg, project, row.id, signal),
      ])
      return workItemTimeline(updates, comments, cfg.storyPointsField)
    },
  })
  const sprintMoves = history.data?.filter((e) => e.kind === 'iteration' && e.from).length ?? 0
  const pointChanges = history.data?.filter((e) => e.kind === 'points' && e.from).length ?? 0

  return (
    <RequestState
      loading={history.loading}
      error={history.error}
      empty={!history.data || history.data.length === 0}
      emptyMessage="Sem mudanças de estado, sprint ou comentários no histórico."
      loadingMessage="Buscando histórico no Azure…"
      onRetry={history.reload}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip label={`Trocou de sprint ${sprintMoves}×`} />
          <Chip label={`Story Points alterados ${pointChanges}×`} />
          <Chip label={`${history.data?.filter((e) => e.kind === 'comment').length ?? 0} comentário(s)`} />
        </div>
        <ol className="flex flex-col gap-2">
          {(history.data ?? []).map((event, index) => (
            <TimelineItem key={index} event={event} />
          ))}
        </ol>
      </div>
    </RequestState>
  )
}

export interface WorkItemDetailsModalProps {
  /** Item aberto; null fecha o modal. */
  row: WorkItemRow | null
  delay?: DelayInfo
  /** Base completa, para achar o item pai e as Tasks filhas. */
  allRows: WorkItemRow[]
  onClose: () => void
}

// Detalhe de um work item para entender um atraso: o que a base local já sabe (sprint
// planejada × de entrega, pai, tasks) e, sob demanda, o histórico e os comentários no Azure.
export function WorkItemDetailsModal({ row, delay, allRows, onClose }: WorkItemDetailsModalProps) {
  const { config, isConfigured } = useAzureConfig()
  const [historyFor, setHistoryFor] = useState<number | null>(null)

  const parent = useMemo(() => (row?.parentId ? allRows.find((r) => r.id === row.parentId) : undefined), [row, allRows])
  const children = useMemo(() => (row ? allRows.filter((r) => r.parentId === row.id) : []), [row, allRows])

  if (!row) return null
  const project = projectOf(row)
  const azureUrl =
    config.organization && project
      ? `https://dev.azure.com/${encodeURIComponent(config.organization)}/${encodeURIComponent(project)}/_workitems/edit/${row.id}`
      : null

  return (
    <Modal open onClose={onClose} title={`#${row.id} · ${row.title}`} size="lg">
      <div className="flex flex-col gap-4">
        {delay?.delayed && delay.reason && (
          <p role="status" className="rounded-md border border-[var(--border)] bg-[var(--code-bg)] p-3 text-sm text-[var(--text-h)]">
            Atrasado: {DELAY_REASON_LABEL[delay.reason]}
            {delay.daysLate ? ` · ${delay.daysLate} dia(s) depois do fim da sprint planejada` : ''}.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Tipo">{row.workItemType}</Field>
          <Field label="Estado">{row.state}</Field>
          <Field label="Responsável">{row.assignedTo}</Field>
          <Field label="Story Points">{row.storyPoints}</Field>
          <Field label="Effort">{row.effort}</Field>
          <Field label="Fechado em">{row.closedDate ? formatDateBR(row.closedDate) : ''}</Field>
          <Field label="Sprint planejada">{delay?.plannedSprint}</Field>
          <Field label="Sprint de entrega">{delay?.deliverySprint}</Field>
          <Field label="Iteration Path">{row.iterationPath}</Field>
        </dl>

        {row.tags && (
          <div className="flex flex-wrap gap-1.5">
            {splitTags(row.tags).map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </div>
        )}

        {parent && (
          <p className="text-sm text-[var(--text-h)]">
            Item pai: #{parent.id} · {parent.workItemType} · {parent.title} ({parent.state})
          </p>
        )}

        {children.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold text-[var(--text-h)]">Itens filhos ({children.length})</h3>
            <ul className="flex flex-col gap-1 text-sm text-[var(--text-h)]">
              {children.map((child) => (
                <li key={child.id}>
                  #{child.id} · {child.workItemType} · {child.title} — {child.assignedTo || 'sem responsável'} · {child.state}
                  {child.effort ? ` · effort ${child.effort}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {isConfigured && historyFor !== row.id && (
            <Button type="button" variant="secondary" onClick={() => setHistoryFor(row.id)}>
              Buscar histórico no Azure
            </Button>
          )}
          {!isConfigured && <p className="text-xs text-[var(--text)]">Configure o Azure DevOps para buscar o histórico do item.</p>}
          {azureUrl && (
            <a
              href={azureUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
            >
              Abrir no Azure DevOps <ExternalLink size={14} />
            </a>
          )}
        </div>

        {historyFor === row.id && <WorkItemHistory row={row} />}
      </div>
    </Modal>
  )
}
