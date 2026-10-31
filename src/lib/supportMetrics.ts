import { round1 } from './numbers'
import { allocationAdherence, type PersonDevMetrics, type PersonQaMetrics } from './personMetrics'
import { supportIssue, type PersonSupport, type SupportContext } from './personSupportsStorage'
import { formatSprintLabel, type Sprint } from './sprintsStorage'

// Status "com apoio" de quem mentora: em cada sprint, N% da carga de cada apoiado entra como
// crédito na carga de quem apoia, comparada com o mesmo Previsto/Máximo (que não mudam). Recebe
// as métricas já calculadas (de quem apoia e dos apoiados) e não altera as do apoiado.

/** Carga de uma pessoa por sprint ("Sprint NN - FYxx-yy" → pontos). */
export type LoadBySprint = Map<string, number>

/** Carga comprometida de dev por sprint: entregue + em andamento (atual e atrasado). */
export function devLoadBySprint(metrics: Pick<PersonDevMetrics, 'sprints'>): LoadBySprint {
  return new Map(metrics.sprints.map((s) => [s.label, s.onTime + s.delayed + s.inProgress + s.inProgressDelayed]))
}

/** Test Points executados por sprint. */
export function qaLoadBySprint(metrics: Pick<PersonQaMetrics, 'sprints'>): LoadBySprint {
  return new Map(metrics.sprints.map((s) => [s.label, s.testPoints]))
}

export interface SupportShare {
  personId: string
  nome: string
  percentage: number
  /** Carga do apoiado na sprint, base da %. */
  base: number
  points: number
}

export interface SprintSupport {
  points: number
  detail: SupportShare[]
}

/** Apoios válidos (ver `supportIssue`) dados por `supporterId`, por sprint, já em pontos. */
export function supportBySprint(
  supporterId: string,
  supports: PersonSupport[],
  sprints: Sprint[],
  context: SupportContext,
  loadOf: (personId: string) => LoadBySprint,
): Map<string, SprintSupport> {
  const sprintsById = new Map(sprints.map((s) => [s.id, s]))
  const result = new Map<string, SprintSupport>()
  for (const support of supports) {
    if (support.supporterId !== supporterId || supportIssue(support, context)) continue
    const sprint = sprintsById.get(support.sprintId)
    if (!sprint) continue
    const label = formatSprintLabel(sprint)
    const base = round1(loadOf(support.supportedId).get(label) ?? 0)
    const points = round1((base * support.percentage) / 100)
    const nome = context.people.find((p) => p.id === support.supportedId)?.nome ?? '—'
    const entry = result.get(label) ?? { points: 0, detail: [] }
    result.set(label, { points: round1(entry.points + points), detail: [...entry.detail, { personId: support.supportedId, nome, percentage: support.percentage, base, points }] })
  }
  return result
}

export interface SupportedBy {
  personId: string
  nome: string
  percentage: number
  sprintLabel: string
}

/** Quem apoia `personId` nas sprints `labels` (só apoios válidos), para o selo "Apoiado por". */
export function supportersOf(
  personId: string,
  supports: PersonSupport[],
  sprints: Sprint[],
  context: SupportContext,
  labels: Set<string>,
): SupportedBy[] {
  const sprintsById = new Map(sprints.map((s) => [s.id, s]))
  return supports.flatMap((support) => {
    const sprint = sprintsById.get(support.sprintId)
    if (support.supportedId !== personId || !sprint || supportIssue(support, context)) return []
    const sprintLabel = formatSprintLabel(sprint)
    if (!labels.has(sprintLabel)) return []
    const nome = context.people.find((p) => p.id === support.supporterId)?.nome ?? '—'
    return [{ personId: support.supporterId, nome, percentage: support.percentage, sprintLabel }]
  })
}

interface AdherenceSprint {
  label: string
  capacity: number
  max: number
  maxExtended: number
}

/**
 * Os mesmos totais de "Entrega × previsto" (status, aderência, contagem por situação, extensão e
 * sobrecarga) somando o apoio à carga de cada sprint; `supportPoints` é o apoio nas sprints com alocação.
 */
export function loadWithSupport<T extends AdherenceSprint>(
  sprints: T[],
  loadOf: (sprint: T) => number,
  support: Map<string, SprintSupport>,
) {
  const supportOf = (sprint: T) => support.get(sprint.label)?.points ?? 0
  return {
    ...allocationAdherence(sprints, (sprint) => loadOf(sprint) + supportOf(sprint)),
    supportPoints: round1(sprints.filter((s) => s.capacity > 0).reduce((total, s) => total + supportOf(s), 0)),
  }
}

/** Apoio total por apoiado no período, do maior para o menor ("Apoiou: Bia (3), Caio (2)"). */
export function supportTotalsByPerson(support: Map<string, SprintSupport>): { personId: string; nome: string; points: number }[] {
  const totals = new Map<string, { personId: string; nome: string; points: number }>()
  for (const { detail } of support.values()) {
    for (const share of detail) {
      const entry = totals.get(share.personId) ?? { personId: share.personId, nome: share.nome, points: 0 }
      totals.set(share.personId, { ...entry, points: round1(entry.points + share.points) })
    }
  }
  return [...totals.values()].sort((a, b) => b.points - a.points)
}

/**
 * Tudo o que a visão da pessoa mostra do apoio, restrito às sprints das métricas dela: o apoio que
 * deu (por sprint, o "com apoio" do card e por apoiado) e quem a apoiou. null sem apoio nenhum.
 */
export function personSupportView<T extends AdherenceSprint>(input: {
  personId: string
  supports: PersonSupport[]
  sprints: Sprint[]
  context: SupportContext
  /** Sprints das métricas da pessoa e a carga própria de cada uma. */
  metricsSprints: T[]
  loadOfSprint: (sprint: T) => number
  /** Carga de cada apoiado por sprint, na mesma métrica (SP ou Test Points). */
  loadOf: (personId: string) => LoadBySprint
}) {
  const labels = new Set(input.metricsSprints.map((s) => s.label))
  const given = supportBySprint(input.personId, input.supports, input.sprints, input.context, input.loadOf)
  const bySprint = new Map([...given].filter(([label]) => labels.has(label)))
  const receivedFrom = supportersOf(input.personId, input.supports, input.sprints, input.context, labels)
  if (bySprint.size === 0 && receivedFrom.length === 0) return null
  const { supportPoints, ...load } = loadWithSupport(input.metricsSprints, input.loadOfSprint, bySprint)
  return {
    bySprint,
    card: bySprint.size > 0 ? { load, points: supportPoints, given: supportTotalsByPerson(bySprint) } : null,
    receivedFrom,
  }
}

export type PersonSupportView = NonNullable<ReturnType<typeof personSupportView>>
