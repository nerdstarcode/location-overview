import { Tabs, type TabItem } from '../components/molecules/Tabs/Tabs'
import { LevelsTable } from '../components/organisms/LevelsTable/LevelsTable'
import { CargosTable } from '../components/organisms/CargosTable/CargosTable'
import { usePersistedState } from '../hooks/usePersistedState'

const TABS: TabItem[] = [
  { id: 'niveis', label: 'Níveis' },
  { id: 'cargos', label: 'Cargos' },
]

export function LevelsPage() {
  const [activeTab, setActiveTab] = usePersistedState('levels-page-active-tab', 'niveis')

  return (
    <div className="flex w-full flex-col gap-4">
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      {activeTab === 'niveis' && <LevelsTable />}
      {activeTab === 'cargos' && <CargosTable />}
    </div>
  )
}
