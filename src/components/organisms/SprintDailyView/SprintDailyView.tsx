import clsx from 'clsx'
import { createContext, useContext } from 'react'
import { ChevronRight } from 'lucide-react'
import type { DailyPerson, DailySquad, DailyStory, DailyView } from '../../../lib/azure/dailyView'
import { splitTags, type WorkItemRow } from '../../../lib/workItems'
import { businessDaysBetween, formatDuration } from '../../../lib/stateFlow'
import { usePersistedState } from '../../../hooks/usePersistedState'
import { Checkbox } from '../../atoms/Checkbox/Checkbox'
import { DailyPointsByPersonChart, DailyTestsByStoryChart } from './DailyCharts'

const ShowDescription = createContext(false)

/** Selo "Delayed" (tag) com a sprint de origem quando a tag traz outra sprint (ver resolveSprint). */
function DelayedBadge({ row }: { row: WorkItemRow }) {
  if (!splitTags(row.tags).some((tag) => tag.toLowerCase() === 'delayed')) return null
  const origin = row.isDelayed ? `${row.sprint} - ${row.fiscalYear}` : null
  return (
    <span
      className="shrink-0 rounded border border-[var(--danger,#dc2626)] px-1.5 py-0.5 text-xs text-[var(--danger,#dc2626)]"
      title={origin ? `Item atrasado: planejado na ${origin}` : 'Item com a tag Delayed'}
    >
      Delayed{origin ? ` · veio da ${origin}` : ''}
    </span>
  )
}

/** Tempo útil no State atual (desde System.StateChangeDate). */
function timeInState(task: WorkItemRow, now: Date): string | null {
  if (!task.stateChangedDate) return null
  return formatDuration(businessDaysBetween(task.stateChangedDate, now.toISOString()))
}

function TaskCard({ task, mine, onOpenItem }: { task: WorkItemRow; mine: boolean; onOpenItem?: (row: WorkItemRow) => void }) {
  const showDescription = useContext(ShowDescription)
  const age = timeInState(task, new Date())
  return (
    <div
      className={clsx(
        'rounded border bg-[var(--bg-elevated)] p-1.5 text-xs',
        mine ? 'border-[var(--accent)] border-l-4' : 'border-[var(--border)] opacity-80',
      )}
    >
      <ItemLink row={task} onOpenItem={onOpenItem} className="text-[var(--text-h)]" />
      <p className="mt-0.5 flex justify-between gap-2 text-[var(--text)]">
        <span className="truncate">{task.assignedTo || 'Sem responsável'}</span>
        {age && (
          <span className="shrink-0" title={`No State "${task.state}" desde ${new Date(task.stateChangedDate!).toLocaleString('pt-BR')} (tempo útil)`}>
            ⏱ {age}
          </span>
        )}
      </p>
      {showDescription && (
        <p className="mt-1 line-clamp-4 whitespace-pre-line border-t border-[var(--border)] pt-1 text-[var(--text)]" title={task.description}>
          {task.description || 'Sem descrição.'}
        </p>
      )}
    </div>
  )
}

export interface SprintDailyViewProps {
  view: DailyView
  onOpenItem?: (row: WorkItemRow) => void
}

const summaryClass =
  'flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden [&_svg.chev]:transition-transform group-open:[&_svg.chev]:rotate-90'

function ItemLink({ row, onOpenItem, className }: { row: WorkItemRow; onOpenItem?: (row: WorkItemRow) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        onOpenItem?.(row)
      }}
      className={clsx('text-left hover:underline', className)}
      title="Ver detalhes do item"
    >
      <span className="font-mono text-xs text-[var(--text)]">#{row.id}</span> {row.title}
    </button>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-[var(--text)]">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--code-bg)]" aria-hidden>
        <span className="block h-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
      </span>
      {total > 0 ? `${done}/${total} tasks` : 'sem tasks'}
    </span>
  )
}

/** "" destaca as tasks sem responsável (seção final). */
function StoryBlock({ entry, highlight, onOpenItem }: { entry: DailyStory; highlight: string; onOpenItem?: (row: WorkItemRow) => void }) {
  const isMine = (task: WorkItemRow) => task.email.trim().toLowerCase() === highlight
  const showDescription = useContext(ShowDescription)
  return (
    <details className="group rounded-md border border-[var(--border)] p-2">
      <summary className={summaryClass}>
        <ChevronRight size={14} className="chev shrink-0" />
        {entry.row ? (
          <>
            <span
              className="shrink-0 rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-xs"
              title={entry.row.stateChangedDate ? `No State "${entry.row.state}" desde ${new Date(entry.row.stateChangedDate).toLocaleString('pt-BR')} (tempo útil)` : undefined}
            >
              {entry.row.state}
              {timeInState(entry.row, new Date()) && <> · ⏱ {timeInState(entry.row, new Date())}</>}
            </span>
            <DelayedBadge row={entry.row} />
            <ItemLink row={entry.row} onOpenItem={onOpenItem} className="min-w-0 truncate text-sm text-[var(--text-h)]" />
            {entry.row.assignedTo && <span className="shrink-0 text-xs text-[var(--text)]">· {entry.row.assignedTo}</span>}
          </>
        ) : (
          <span className="text-sm text-[var(--text-h)]">Sem US (tasks soltas)</span>
        )}
        <Progress done={entry.done} total={entry.total} />
      </summary>

      {showDescription && entry.row && (
        <p className="mt-2 line-clamp-6 whitespace-pre-line rounded bg-[var(--code-bg)] p-2 text-xs text-[var(--text)]" title={entry.row.description}>
          {entry.row.description || 'Sem descrição.'}
        </p>
      )}

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {entry.columns.length === 0 && <p className="text-xs text-[var(--text)]">Nenhuma task.</p>}
        {entry.columns.map((column) => (
          <div key={column.state} className="flex w-56 shrink-0 flex-col gap-1.5 rounded-md bg-[var(--code-bg)] p-2">
            <p className="text-xs font-medium text-[var(--text-h)]">
              {column.state} <span className="text-[var(--text)]">({column.tasks.length})</span>
            </p>
            {column.tasks.map((task) => (
              <TaskCard key={task.id} task={task} mine={isMine(task)} onOpenItem={onOpenItem} />
            ))}
          </div>
        ))}
      </div>

      {entry.testCases && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-[var(--text-h)]">Test Cases ({entry.testCases.length})</p>
          {entry.testCases.length === 0 ? (
            <p className="text-xs text-[var(--text)]">Nenhum Test Case ligado (Tested By).</p>
          ) : (
            <ul className="flex flex-col gap-0.5 text-xs">
              {entry.testCases.map((tc) => (
                <li key={tc.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[var(--text)]">#{tc.id}</span>
                  <span className="text-[var(--text-h)]">{tc.title || 'Test Case'}</span>
                  {tc.state && <span className="rounded bg-[var(--code-bg)] px-1">{tc.state}</span>}
                  <span className={clsx(tc.email.trim().toLowerCase() === highlight ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text)]')}>
                    {tc.assignedTo || 'Sem responsável'}
                  </span>
                  <span className="ml-auto text-[var(--text)]">
                    {tc.executed > 0 ? `${tc.executed} exec. · ${tc.passed} passed · ${tc.failed} failed` : 'sem execução na sprint'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  )
}

const STATUS_LABEL: Record<string, string> = { abaixo: 'abaixo', dentro: 'dentro', acima: 'acima' }
const STATUS_CLASS: Record<string, string> = {
  abaixo: 'border-[var(--warning,#d97706)] text-[var(--warning,#d97706)]',
  dentro: 'border-[var(--success,#16a34a)] text-[var(--success,#16a34a)]',
  acima: 'border-[var(--danger,#dc2626)] text-[var(--danger,#dc2626)]',
}

type Load = Pick<DailySquad, 'capacity' | 'max' | 'assigned' | 'expectedMin' | 'expectedMax' | 'executed'> & { status?: DailySquad['status'] }

/** "Cap 8 · Max 10 · Atribuído 9 SP" (Dev) ou "Cap 8 · Max 10 · Faixa QA 4–6 de 12 SP com testes" (QA). */
function LoadLine({ load, isQa }: { load: Load; isQa: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text)]">
      <span>
        Capacity <b className="text-[var(--text-h)]">{load.capacity}</b> · Max <b className="text-[var(--text-h)]">{load.max}</b> ·{' '}
        {isQa ? (
          <>
            Faixa QA <b className="text-[var(--text-h)]">{load.expectedMin}–{load.expectedMax}</b> ({load.assigned} SP com Test Cases dele)
            {load.executed && (
              <>
                {' '}
                · Executou <b className="text-[var(--text-h)]">{load.executed.executed}</b> teste(s) ({load.executed.passed} passed ·{' '}
                {load.executed.failed} failed)
              </>
            )}
          </>
        ) : (
          <>
            Atribuído <b className="text-[var(--text-h)]">{load.assigned}</b> SP
          </>
        )}
      </span>
      {load.status && STATUS_LABEL[load.status] && (
        <span className={clsx('rounded-full border px-1.5', STATUS_CLASS[load.status])}>{STATUS_LABEL[load.status]}</span>
      )}
    </span>
  )
}

function SquadChip({ squad }: { squad: DailySquad }) {
  return (
    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-h)]">
      {squad.name} · {squad.percentage !== null ? `${squad.percentage}%` : 'sem alocação'} ·{' '}
      {squad.hasData ? `${squad.openTasks}/${squad.totalTasks} tasks abertas` : 'sem work items sincronizados'}
    </span>
  )
}

function PersonCard({ person, onOpenItem }: { person: DailyPerson; onOpenItem?: (row: WorkItemRow) => void }) {
  const highlight = person.email.trim().toLowerCase()
  return (
    <details open className="group rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <summary className={clsx(summaryClass, 'flex-wrap')}>
        <ChevronRight size={16} className="chev shrink-0" />
        <span className="font-medium text-[var(--text-h)]">{person.name}</span>
        {person.isQa && <span className="rounded bg-[var(--code-bg)] px-1.5 text-xs">QA</span>}
        <span className="rounded-md bg-[var(--code-bg)] px-2 py-0.5">
          <LoadLine load={person.totals} isQa={person.isQa} />
        </span>
        <span className="flex flex-wrap gap-1.5">
          {person.squads.map((squad) => (
            <SquadChip key={squad.key} squad={squad} />
          ))}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {person.squads.map((squad) => (
          <section key={squad.key}>
            <h4 className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-h)]">
              <span>
                {squad.name} {!squad.live && <span className="text-xs font-normal text-[var(--text)]">(base local)</span>}
              </span>
              <LoadLine load={squad} isQa={person.isQa} />
            </h4>
            {squad.stories.length === 0 ? (
              <p className="text-xs text-[var(--text)]">{squad.hasData ? 'Nenhum item nesta squad.' : 'Sem work items sincronizados desta squad/sprint.'}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {squad.stories.map((entry) => (
                  <StoryBlock key={entry.row?.id ?? 'sem-us'} entry={entry} highlight={highlight} onOpenItem={onOpenItem} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </details>
  )
}

/** Passagem da daily: pessoa a pessoa (squads → USs → tasks por State) e, no fim, o que está sem responsável. */
export function SprintDailyView({ view, onOpenItem }: SprintDailyViewProps) {
  const [showDescription, setShowDescription] = usePersistedState('sprint-daily-show-description', false)
  const [showTestsChart, setShowTestsChart] = usePersistedState('sprint-daily-show-tests-chart', false)
  return (
    <ShowDescription.Provider value={showDescription}>
    <div className="flex flex-col gap-3">
      <DailyPointsByPersonChart data={view.pointsByPerson} states={view.states} />
      {showTestsChart && <DailyTestsByStoryChart data={view.testsByStory} />}
      <div className="flex flex-wrap items-center justify-end gap-4">
      <label className="flex items-center gap-2 text-sm text-[var(--text-h)]">
        <Checkbox checked={showTestsChart} onChange={(e) => setShowTestsChart(e.target.checked)} />
        Mostrar gráfico de testes por US
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--text-h)]">
        <Checkbox checked={showDescription} onChange={(e) => setShowDescription(e.target.checked)} />
        Mostrar descrição (USs e tasks)
      </label>
      </div>
      {view.people.length === 0 && <p className="text-sm text-[var(--text)]">Ninguém com itens ou alocação nesta sprint.</p>}
      {view.people.map((person) => (
        <PersonCard key={person.key} person={person} onOpenItem={onOpenItem} />
      ))}
      <section className="rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <h3 className="mb-2 font-medium text-[var(--text-h)]">Sem ninguém alocado</h3>
        {view.unassigned.length === 0 ? (
          <p className="text-sm text-[var(--text)]">Todas as USs e tasks abertas têm responsável.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {view.unassigned.map((entry) => (
              <StoryBlock key={entry.row?.id ?? 'sem-us'} entry={entry} highlight="" onOpenItem={onOpenItem} />
            ))}
          </div>
        )}
      </section>
    </div>
    </ShowDescription.Provider>
  )
}
