import clsx from 'clsx'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
import { LOAD_STATUS_STYLE } from '../LoadStatusChip/loadStatusStyle'
import { round1 } from '../../../lib/numbers'
import { LOAD_STATUS_LABEL, SPRINT_EXTENSION_DAYS, type LoadStatus } from '../../../lib/personMetrics'

const STATUS_STYLE = LOAD_STATUS_STYLE

const STATUS_ORDER: LoadStatus[] = ['overload', 'extension', 'above', 'within', 'below']

/** Listras dos segmentos "em andamento": ainda não entregue, só comprometido. */
const STRIPES = 'bg-[repeating-linear-gradient(90deg,transparent_0_3px,rgb(255_255_255/0.35)_3px_5px)]'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const SPRINTS_LISTED = 3

/** "Sprint 08 - FY25-26, Sprint 09 - FY25-26, Sprint 10 - FY25-26 e mais 4". */
function listSprints(labels: string[]): string {
  const shown = labels.slice(0, SPRINTS_LISTED).join(', ')
  return labels.length > SPRINTS_LISTED ? `${shown} e mais ${labels.length - SPRINTS_LISTED}` : shown
}

/** Totais de entrega × alocação; Dev e QA expõem esses campos com os mesmos nomes. */
export interface CapacityLoad {
  loadStatus: LoadStatus | null
  /** Carga comprometida nas sprints com alocação: entregue + em andamento (atual e atrasado). */
  deliveredOnAllocatedSprintsRaw: number
  capacity: number
  /** Carga cheia nos dias válidos. */
  maxCapacity: number
  /** Carga cheia somando a extensão de +3 dias úteis (acima do Máximo). */
  maxExtendedCapacity: number
  allocatedSprints: number
  extensionUsedPoints: number
  extensionUsedSprints: number
  overloadPoints: number
  overloadSprints: string[]
  sprintStatusCounts: Record<LoadStatus, number>
  /** Em aberto na sprint atual (sprints com alocação); parte de deliveredOnAllocatedSprintsRaw. */
  inProgressOnAllocatedSprints?: number
  /** Em aberto em sprints já encerradas (sprints com alocação); parte de deliveredOnAllocatedSprintsRaw. */
  inProgressDelayedOnAllocatedSprints?: number
}

/** Uma frase com a leitura do status; com itens em aberto, deixa claro que o status soma tudo. */
function summaryOf(load: CapacityLoad, unit: string, parts: { delivered: number; open: number }): string {
  const total = load.deliveredOnAllocatedSprintsRaw
  const subject =
    parts.open > 0
      ? `Entregue (${parts.delivered}) + em andamento (${parts.open}) somam ${total} ${unit}`
      : `Entregou ${total} ${unit}`
  switch (load.loadStatus) {
    case 'below':
      return `${subject}, de ${load.capacity} previstos (${Math.round((total / load.capacity) * 100)}%).`
    case 'within':
      return `${subject}, em linha com os ${load.capacity} previstos.`
    case 'above':
      return `${subject}: acima do previsto (${load.capacity}), mas dentro do máximo (${load.maxCapacity}).`
    case 'extension':
      return `${subject}: passou do máximo (${load.maxCapacity}); ${load.extensionUsedPoints} cabem na extensão de +${SPRINT_EXTENSION_DAYS} dias úteis (até ${load.maxExtendedCapacity}).`
    case 'overload':
      return `${subject}, ${round1(total - load.maxExtendedCapacity)} acima até da extensão (${load.maxExtendedCapacity}).`
    default:
      return ''
  }
}

function Stat({ label, value, hint, swatch }: { label: string; value: string; hint?: string; swatch?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-[var(--text)]">
        {swatch && <span aria-hidden="true" className={clsx('inline-block h-2.5 w-3 rounded-sm', swatch)} />}
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-[var(--text-h)]">{value}</p>
      {hint && <p className="text-[11px] leading-snug text-[var(--text)]">{hint}</p>}
    </div>
  )
}

export interface CapacityLoadCardProps {
  label: string
  info?: string
  /** Unidade da entrega: SP (dev) ou PE (QA, Pontos de Execução). */
  unit: string
  load: CapacityLoad
}

// Painel "Entrega × previsto": status em palavras + frase de leitura, barra com o entregue e o
// em andamento (atual e atrasado) separados, as marcas de Previsto e Máximo e a extensão de +3 dias
// úteis acima do Máximo (a gordurinha), os números-chave e as sprints por situação.
export function CapacityLoadCard({ label, info, unit, load }: CapacityLoadCardProps) {
  const status = load.loadStatus
  const total = load.deliveredOnAllocatedSprintsRaw
  const inProgress = load.inProgressOnAllocatedSprints ?? 0
  const inProgressDelayed = load.inProgressDelayedOnAllocatedSprints ?? 0
  const delivered = round1(total - inProgress - inProgressDelayed)
  const style = status ? STATUS_STYLE[status] : null

  // Escala com folga para a marca do Máximo nunca encostar na borda.
  const scale = Math.max(total, load.maxExtendedCapacity) * 1.05 || 1
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
  const span = (from: number, to: number) => ({ left: at(from), width: `calc(${at(to)} - ${at(from)})` })
  // Segmentos em sequência (entregue → em andamento → em andamento atrasado), cortados no fim da
  // extensão; o que passa até da extensão fica vermelho.
  const limit = load.maxExtendedCapacity
  const deliveredEnd = Math.min(delivered, limit)
  const inProgressEnd = Math.min(delivered + inProgress, limit)
  const delayedEnd = Math.min(total, limit)
  const perSprint = (value: number) => (load.allocatedSprints > 0 ? round1(value / load.allocatedSprints) : 0)

  const deliveredSwatch = style ? clsx('opacity-90', style.fill) : ''
  const inProgressSwatch = style ? clsx('opacity-40', STRIPES, style.fill) : ''
  const delayedSwatch = clsx('opacity-60', STRIPES, 'bg-brand-action-alert')

  return (
    <section className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-4 sm:px-5">
      <p className="flex items-center gap-1 text-xs font-medium text-[var(--text)]">
        {label}
        {info && <InfoTooltip label={label} text={info} />}
      </p>

      {!status || !style ? (
        <>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-h)]">—</p>
          <p className="mt-0.5 text-xs text-[var(--text)]">Sem alocação nas sprints do filtro</p>
        </>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className={clsx('flex items-center gap-2 text-2xl font-semibold', style.text)}>
              <style.icon size={22} aria-hidden="true" />
              {LOAD_STATUS_LABEL[status]}
            </p>
            <p className="text-sm text-[var(--text-h)]">{summaryOf(load, unit, { delivered, open: inProgress + inProgressDelayed })}</p>
          </div>

          <div
            role="img"
            aria-label={[
              `Entregue ${delivered} ${unit}`,
              inProgress > 0 ? `em andamento ${inProgress}` : '',
              inProgressDelayed > 0 ? `em andamento atrasado ${inProgressDelayed}` : '',
              `previsto ${load.capacity}`,
              `máximo ${load.maxCapacity}`,
              `máximo com extensão ${load.maxExtendedCapacity}`,
            ]
              .filter(Boolean)
              .join('; ')}
            className="relative mt-4 h-3.5 rounded-full bg-[var(--code-bg)]"
          >
            {/* Extensão (gordurinha): do Máximo até o Máximo com os +3 dias úteis. */}
            <div
              className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(255_122_0/0.4)_4px_7px)]"
              style={span(load.maxCapacity, load.maxExtendedCapacity)}
            />
            <div className={clsx('absolute inset-y-0 left-0 rounded-l-full', deliveredSwatch)} style={{ width: at(deliveredEnd) }} />
            {inProgressEnd > deliveredEnd && <div className={clsx('absolute inset-y-0', inProgressSwatch)} style={span(deliveredEnd, inProgressEnd)} />}
            {delayedEnd > inProgressEnd && <div className={clsx('absolute inset-y-0', delayedSwatch)} style={span(inProgressEnd, delayedEnd)} />}
            {total > limit && <div className="absolute inset-y-0 rounded-r-full bg-brand-action-danger" style={span(limit, total)} />}
            <span className="absolute -inset-y-1 w-0.5 bg-[var(--text-h)]" style={{ left: at(load.capacity) }} />
            <span className="absolute -inset-y-1 border-l-2 border-dashed border-[var(--text-h)]" style={{ left: at(load.maxCapacity) }} />
            <span className="absolute -inset-y-1 border-l-2 border-dotted border-[var(--text-h)]" style={{ left: at(limit) }} />
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text)]">
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-2.5 w-0.5 bg-[var(--text-h)]" /> Previsto
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true" className="inline-block h-2.5 border-l-2 border-dashed border-[var(--text-h)]" /> Máximo
              (carga cheia)
            </span>
            <span className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-3 rounded-sm bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(255_122_0/0.6)_2px_4px)]"
              />{' '}
              Extensão: +{SPRINT_EXTENSION_DAYS} dias úteis acima do máximo
            </span>
            {total > limit && (
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="inline-block h-2.5 w-3 rounded-sm bg-brand-action-danger" /> Acima até da extensão
              </span>
            )}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-3 sm:grid-cols-4 xl:grid-cols-8">
            <Stat
              label="Entregue"
              swatch={deliveredSwatch}
              value={`${delivered} ${unit}`}
              hint={`${perSprint(delivered)} ${unit}/sprint · itens fechados`}
            />
            <Stat
              label="Em andamento"
              swatch={inProgressSwatch}
              value={`${inProgress} ${unit}`}
              hint="Em aberto na sprint atual"
            />
            <Stat
              label="Em andamento atrasado"
              swatch={delayedSwatch}
              value={`${inProgressDelayed} ${unit}`}
              hint="Ainda aberto após o fim da sprint"
            />
            <Stat label="Previsto" value={`${load.capacity}`} hint={`${perSprint(load.capacity)}/sprint · dias válidos`} />
            <Stat label="Máximo" value={`${load.maxCapacity}`} hint="Carga cheia (8h/dia) nos dias válidos" />
            <Stat
              label="Máximo + extensão"
              value={`${load.maxExtendedCapacity}`}
              hint={`+${SPRINT_EXTENSION_DAYS} dias úteis acima do máximo`}
            />
            <Stat
              label="Gordurinha usada"
              value={`${load.extensionUsedPoints} ${unit}`}
              hint={load.extensionUsedSprints > 0 ? `Acima do máximo em ${plural(load.extensionUsedSprints, 'sprint')}` : 'Não precisou da extensão'}
            />
            <Stat label="Sprints com alocação" value={`${load.allocatedSprints}`} hint="Base da comparação" />
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-h)]" aria-label="Sprints por situação">
            {STATUS_ORDER.filter((s) => load.sprintStatusCounts[s] > 0).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={clsx('inline-block h-2 w-2 rounded-full', STATUS_STYLE[s].dot)} />
                {plural(load.sprintStatusCounts[s], 'sprint')}: {LOAD_STATUS_LABEL[s].toLowerCase()}
              </li>
            ))}
          </ul>

          {load.overloadPoints > 0 && (
            <p className="mt-3 rounded-r border-l-2 border-brand-action-danger bg-[var(--code-bg)] px-2 py-1 text-xs leading-snug text-[var(--text-h)]">
              {load.overloadPoints} {unit} acima até da extensão em {plural(load.overloadSprints.length, 'sprint')} (
              {listSprints(load.overloadSprints)}): sobrecarga ou entrega acima do nível cadastrado.
            </p>
          )}
        </>
      )}
    </section>
  )
}
