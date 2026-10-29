import { useMemo, useState } from 'react'
import { AllocationEditModal } from '../AllocationEditModal/AllocationEditModal'
import { AllocationGroupDetail } from '../AllocationGroupDetail/AllocationGroupDetail'
import { NewSprintAllocationModal } from '../NewSprintAllocationModal/NewSprintAllocationModal'
import { SprintFormModal } from '../SprintFormModal/SprintFormModal'
import { SprintSquadsPlan } from '../SprintSquadsPlan/SprintSquadsPlan'
import { SprintTimeline, type SprintPhaseFilter, type SprintTimelineRow } from '../SprintTimeline/SprintTimeline'
import { useAllocationActions } from '../../../hooks/useAllocationActions'
import { usePersistedState } from '../../../hooks/usePersistedState'
import { createId } from '../../../lib/createId'
import { loadLevels, type LevelConfig } from '../../../lib/levelsStorage'
import type { PersonAllocation } from '../../../lib/personAllocationsStorage'
import { sprintPlanSummary, sprintSquadPlans, type PlanBase } from '../../../lib/sprintPlanning'
import {
  DEFAULT_TOTAL_VALID_DAYS,
  deleteSprint,
  loadSprints,
  sprintPhase,
  upsertSprint,
  type Sprint,
} from '../../../lib/sprintsStorage'
import { loadSquads, type Squad } from '../../../lib/squadsStorage'
import type { WorkItemRow } from '../../../lib/workItems'
import { loadWorkItems } from '../../../lib/workItemsStorage'

const EMPTY_SPRINT: Sprint = { id: '', number: 1, fiscalYear: '', startDate: '', endDate: '', totalValidDays: DEFAULT_TOTAL_VALID_DAYS }

// Aba Sprints: a linha do tempo das sprints (fechada, atual, aberta) → a alocação de cada squad
// na sprint, com o planejado × previsto → o detalhe das pessoas da squad. O cadastro das sprints
// (nova, editar, excluir) fica na própria linha do tempo.
export function SprintsTable() {
  const actions = useAllocationActions()
  const { allocations, people } = actions
  const [sprints, setSprints] = useState<Sprint[]>(loadSprints)
  const [squads] = useState<Squad[]>(loadSquads)
  const [levels] = useState<LevelConfig[]>(loadLevels)
  const [workItems] = useState<WorkItemRow[]>(loadWorkItems)
  const [phaseFilter, setPhaseFilter] = usePersistedState<SprintPhaseFilter>('sprints-phase-filter', 'active')
  const [openSprintId, setOpenSprintId] = useState<string | null>(null)
  const [openSquadId, setOpenSquadId] = useState<string | null>(null)
  const [sprintDraft, setSprintDraft] = useState<Sprint | null>(null)
  const [defaultFor, setDefaultFor] = useState<Squad | null>(null)
  const [editing, setEditing] = useState<PersonAllocation | null>(null)

  const base: PlanBase = useMemo(() => ({ allocations, people, levels, workItems }), [allocations, people, levels, workItems])

  const timeline = useMemo<SprintTimelineRow[]>(() => {
    const today = new Date()
    return [...sprints]
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.fiscalYear.localeCompare(b.fiscalYear) || a.number - b.number)
      .map((sprint) => ({ sprint, phase: sprintPhase(sprint, today), plan: sprintPlanSummary(sprintSquadPlans(sprint, squads, base)) }))
  }, [sprints, squads, base])

  const openSprint = sprints.find((s) => s.id === openSprintId)
  const plans = useMemo(() => (openSprint ? sprintSquadPlans(openSprint, squads, base) : []), [openSprint, squads, base])
  const openSquadPlan = plans.find((p) => p.squad.id === openSquadId)

  function saveSprint(sprint: Sprint) {
    setSprints(upsertSprint({ ...sprint, id: sprint.id || createId() }))
    setSprintDraft(null)
  }

  const editModal = (
    <AllocationEditModal
      key={editing?.id ?? 'fechado'}
      entry={editing}
      person={editing ? people.find((p) => p.id === editing.personId) : undefined}
      squads={squads}
      sprints={sprints}
      onClose={() => setEditing(null)}
      onSave={actions.saveEdit}
    />
  )

  if (openSprint && openSquadPlan) {
    return (
      <>
        <AllocationGroupDetail
          squad={openSquadPlan.squad}
          sprint={openSprint}
          entries={openSquadPlan.entries}
          allocations={allocations}
          people={people}
          squads={squads}
          levels={levels}
          workItems={workItems}
          summary={{ capacityPoints: openSquadPlan.capacity, maxPoints: openSquadPlan.max, storyPoints: openSquadPlan.plannedPoints }}
          onBack={() => setOpenSquadId(null)}
          onAdd={actions.addEntries}
          onRemove={actions.removeEntries}
          onRestore={actions.restoreEntries}
          onSetPercentage={actions.setPercentage}
          onMove={(ids, squadId) => {
            const message = actions.moveEntries(ids, squadId)
            // Moveu a squad inteira: segue para a squad destino.
            if (message === null && ids.length === openSquadPlan.entries.length) setOpenSquadId(squadId)
            return message
          }}
          onEdit={(entry) => setEditing({ ...entry })}
        />
        {editModal}
      </>
    )
  }

  if (openSprint) {
    return (
      <>
        <SprintSquadsPlan
          sprint={openSprint}
          phase={sprintPhase(openSprint)}
          plans={plans}
          summary={sprintPlanSummary(plans)}
          onBack={() => setOpenSprintId(null)}
          onOpenSquad={(squad) => setOpenSquadId(squad.id)}
          onCreateDefault={setDefaultFor}
        />
        <NewSprintAllocationModal
          key={defaultFor?.id ?? 'fechado'}
          open={defaultFor !== null}
          onClose={() => setDefaultFor(null)}
          initialSquadId={defaultFor?.id}
          initialSprintId={openSprint.id}
          people={people}
          squads={squads}
          sprints={sprints}
          allocations={allocations}
          onSave={(entries) => {
            const message = actions.addEntries(entries)
            if (message === null) {
              setDefaultFor(null)
              setOpenSquadId(entries[0].squadId)
            }
            return message
          }}
          onOpenGroup={(squadId) => {
            setDefaultFor(null)
            setOpenSquadId(squadId)
          }}
        />
      </>
    )
  }

  return (
    <>
      <SprintTimeline
        rows={timeline}
        phaseFilter={phaseFilter}
        onPhaseFilterChange={setPhaseFilter}
        onOpen={(sprint) => setOpenSprintId(sprint.id)}
        onCreate={() => setSprintDraft(EMPTY_SPRINT)}
        onEdit={setSprintDraft}
        onDelete={(sprint) => setSprints(deleteSprint(sprint.id))}
      />
      <SprintFormModal key={sprintDraft?.id ?? (sprintDraft ? 'nova' : 'fechado')} sprint={sprintDraft} onClose={() => setSprintDraft(null)} onSave={saveSprint} />
    </>
  )
}
