import { useState } from 'react'
import { Select } from '../../components/atoms/Select/Select'
import { Tabs, type TabItem } from '../../components/molecules/Tabs/Tabs'
import { WorkItemsDashboard } from '../../components/organisms/WorkItemsDashboard/WorkItemsDashboard'
import { usePersistedState } from '../../hooks/usePersistedState'
import { loadSquads } from '../../lib/squadsStorage'

const DEV_TYPES = ['User Story', 'Bug', 'Enabler']
const QA_TYPES = ['Test Case', 'Test Plan']

const TABS: TabItem[] = [
  { id: 'general', label: 'Geral' },
  { id: 'dev', label: 'Dev Overview' },
  { id: 'qa', label: 'QA Overview' },
]

// Dashboard por Squad (`/dashboard/squad`): a squad escolhida no topo fixa o filtro de
// Squad das três abas; "Todas" mostra o conjunto inteiro, como antes.
export function SquadDashboardPage() {
  const [activeTab, setActiveTab] = usePersistedState('dashboard-page-active-tab', 'general')
  const [squadName, setSquadName] = usePersistedState('squad-dashboard-squad', '')
  const [squads] = useState(loadSquads)
  const selectedSquad = squads.some((squad) => squad.name === squadName) ? squadName : undefined

  return (
    <div className="flex w-full flex-col gap-4">
      <label className="flex w-full max-w-sm flex-col gap-1 text-sm font-medium text-[var(--text-h)]">
        Squad
        <Select
          value={selectedSquad ?? ''}
          onChange={(value) => setSquadName(value)}
          options={[
            { value: '', label: 'Todas as squads' },
            ...[...squads].sort((a, b) => a.name.localeCompare(b.name)).map((squad) => ({ value: squad.name, label: squad.name })),
          ]}
        />
      </label>

      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && <WorkItemsDashboard key="general" storageKey="shared" squadName={selectedSquad} />}
      {activeTab === 'dev' && (
        <WorkItemsDashboard
          key="dev"
          storageKey="shared"
          squadName={selectedSquad}
          allowedTypes={DEV_TYPES}
          cargoTipo="Dev"
          emptyMessage="Nenhum User Story, Bug ou Enabler encontrado nos work items importados."
        />
      )}
      {activeTab === 'qa' && (
        <WorkItemsDashboard
          key="qa"
          storageKey="shared"
          squadName={selectedSquad}
          allowedTypes={QA_TYPES}
          cargoTipo="QA"
          emptyMessage="Nenhum Test Case ou Test Plan encontrado nos work items importados."
        />
      )}
    </div>
  )
}
