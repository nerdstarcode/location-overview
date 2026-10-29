import clsx from 'clsx'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { SprintPhaseChip } from '../SprintTimeline/SprintTimeline'
import { LoadStatusChip } from '../../molecules/LoadStatusChip/LoadStatusChip'
import { LOAD_STATUS_STYLE } from '../../molecules/LoadStatusChip/loadStatusStyle'
import { Button } from '../../atoms/Button/Button'
import type { SprintPlanTotals, SquadSprintPlan } from '../../../lib/sprintPlanning'
import { formatSprintLabel, type Sprint, type SprintPhase } from '../../../lib/sprintsStorage'
import type { Squad } from '../../../lib/squadsStorage'

export interface SprintSquadsPlanProps {
  sprint: Sprint
  phase: SprintPhase
  plans: SquadSprintPlan[]
  summary: SprintPlanTotals & { squads: number }
  onBack: () => void
  onOpenSquad: (squad: Squad) => void
  onCreateDefault: (squad: Squad) => void
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

/** Barra compacta: SP planejados × previsto (marca cheia), máximo (tracejada) e a extensão listrada. */
function PlanBar({ plan }: { plan: SquadSprintPlan }) {
  const scale = Math.max(plan.plannedPoints, plan.maxExtended) * 1.05 || 1
  const at = (value: number) => `${Math.min(100, (value / scale) * 100)}%`
  const fill = plan.status ? LOAD_STATUS_STYLE[plan.status].fill : 'bg-[var(--text)]'
  return (
    <div
      role="img"
      aria-label={`Planejado ${plan.plannedPoints} SP; previsto ${plan.capacity}; máximo ${plan.max}; máximo com extensão ${plan.maxExtended}`}
      className="relative h-2.5 w-full rounded-full bg-[var(--code-bg)]"
    >
      <div
        className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_122_0/0.4)_3px_5px)]"
        style={{ left: at(plan.max), width: `calc(${at(plan.maxExtended)} - ${at(plan.max)})` }}
      />
      <div className={clsx('absolute inset-y-0 left-0 rounded-full', fill)} style={{ width: at(plan.plannedPoints) }} />
      <span className="absolute -inset-y-1 w-0.5 bg-[var(--text-h)]" style={{ left: at(plan.capacity) }} />
      <span className="absolute -inset-y-1 border-l-2 border-dashed border-[var(--text-h)]" style={{ left: at(plan.max) }} />
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-[var(--text)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text-h)]">{value}</span>
    </div>
  )
}

// Alocação de uma sprint por squad: cada card compara os SP planejados da squad com o previsto da
// Alocação (abaixo, no esperado, acima, na extensão ou sobrecarga). Squad sem alocação oferece a
// alocação padrão com os membros dela.
export function SprintSquadsPlan({ sprint, phase, plans, summary, onBack, onOpenSquad, onCreateDefault }: SprintSquadsPlanProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="rounded-md p-1.5 text-[var(--text)] transition-colors hover:bg-[var(--code-bg)] hover:text-[var(--text-h)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--text-h)]">
              {formatSprintLabel(sprint)} <SprintPhaseChip phase={phase} />
            </h2>
            <p className="text-xs text-[var(--text)]">
              {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)} · {sprint.totalValidDays} dias válidos
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Figure label="Squads alocadas" value={`${summary.squads} de ${plans.length}`} />
          <Figure label="Pessoas" value={summary.people} />
          <Figure label="Previsto / Máximo" value={`${summary.capacity} / ${summary.max}`} />
          <Figure label="SP planejados" value={summary.plannedPoints} />
          <LoadStatusChip status={summary.status} />
        </div>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-[var(--text)]">Nenhuma squad cadastrada. Cadastre as squads na aba Squads.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Squads da sprint">
          {plans.map((plan) =>
            plan.people > 0 ? (
              <li key={plan.squad.id}>
                <button
                  type="button"
                  onClick={() => onOpenSquad(plan.squad)}
                  aria-label={`Abrir ${plan.squad.name}`}
                  className="flex h-full w-full flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-blue-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--text-h)]">{plan.squad.name}</p>
                      <p className="text-xs text-[var(--text)]">
                        {plan.people} {plan.people === 1 ? 'pessoa' : 'pessoas'} · {plan.percentage}% somados
                      </p>
                    </div>
                    <LoadStatusChip status={plan.status} />
                  </div>
                  <PlanBar plan={plan} />
                  <div className="grid grid-cols-4 gap-2">
                    <Figure label="Planejado" value={plan.plannedPoints} />
                    <Figure label="Previsto" value={plan.capacity} />
                    <Figure label="Máximo" value={plan.max} />
                    <Figure label="+ extensão" value={plan.maxExtended} />
                  </div>
                </button>
              </li>
            ) : (
              <li
                key={plan.squad.id}
                className="flex h-full flex-col gap-3 rounded-md border border-dashed border-[var(--border)] p-4"
                aria-label={`${plan.squad.name} sem alocação`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text-h)]">{plan.squad.name}</p>
                    <p className="text-xs text-[var(--text)]">
                      {plan.plannedPoints > 0 ? `${plan.plannedPoints} SP planejados sem previsto` : 'Sem itens planejados'}
                    </p>
                  </div>
                  <LoadStatusChip status={null} />
                </div>
                <Button type="button" variant="secondary" className="mt-auto h-10" onClick={() => onCreateDefault(plan.squad)}>
                  <UserPlus size={14} /> Criar alocação padrão
                </Button>
              </li>
            ),
          )}
        </ul>
      )}

      <p className="text-xs text-[var(--text)]">
        Planejado = SP de todos os itens da squad na sprint, em qualquer estado. Previsto = dias válidos alocados ×
        capacity/dia do nível; Máximo = carga cheia; a faixa listrada é a extensão de +3 dias úteis. No esperado: até 10%
        em volta do previsto.
      </p>
    </div>
  )
}
