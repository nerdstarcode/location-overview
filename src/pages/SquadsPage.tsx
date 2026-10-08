import { Tabs, type TabItem } from '../components/molecules/Tabs/Tabs'
import { SquadsTable } from '../components/organisms/SquadsTable/SquadsTable'
import { SprintsTable } from '../components/organisms/SprintsTable/SprintsTable'
import { AllocationsOverview } from '../components/organisms/AllocationsOverview/AllocationsOverview'
import { TestReportsTable } from '../components/organisms/TestReportsTable/TestReportsTable'
import { usePersistedState } from '../hooks/usePersistedState'

const TABS: TabItem[] = [
  { id: 'squads', label: 'Squads' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'alocacao', label: 'Alocação' },
  { id: 'testes', label: 'Relatório de Testes' },
]

export function SquadsPage() {
  const [activeTab, setActiveTab] = usePersistedState('squads-page-active-tab', 'squads')

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      {activeTab === 'squads' && <SquadsTable />}
      {activeTab === 'sprints' && <SprintsTable />}
      {activeTab === 'alocacao' && <AllocationsOverview />}
      {activeTab === 'testes' && <TestReportsTable />}
    </div>
  )
}
