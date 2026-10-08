import { Tabs, type TabItem } from '../components/molecules/Tabs/Tabs'
import { WorkItemsDashboard } from '../components/organisms/WorkItemsDashboard/WorkItemsDashboard'
import { usePersistedState } from '../hooks/usePersistedState'

const DEV_TYPES = ['User Story', 'Bug', 'Enabler']
const QA_TYPES = ['Test Case', 'Test Plan']

const TABS: TabItem[] = [
  { id: 'general', label: 'Geral' },
  { id: 'dev', label: 'Dev Overview' },
  { id: 'qa', label: 'QA Overview' },
]

export function DashboardPage() {
  const [activeTab, setActiveTab] = usePersistedState('dashboard-page-active-tab', 'general')

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && <WorkItemsDashboard key="general" storageKey="shared" />}
      {activeTab === 'dev' && (
        <WorkItemsDashboard
          key="dev"
          storageKey="shared"
          allowedTypes={DEV_TYPES}
          cargoTipo="Dev"
          emptyMessage="Nenhum User Story, Bug ou Enabler encontrado nos work items importados."
        />
      )}
      {activeTab === 'qa' && (
        <WorkItemsDashboard
          key="qa"
          storageKey="shared"
          allowedTypes={QA_TYPES}
          cargoTipo="QA"
          emptyMessage="Nenhum Test Case ou Test Plan encontrado nos work items importados."
        />
      )}
    </div>
  )
}
