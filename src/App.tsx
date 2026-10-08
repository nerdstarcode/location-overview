import './App.css'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/templates/AppShell/AppShell'
import { AzureConfigProvider } from './contexts/azure/AzureConfigProvider'
import { AllocationPage } from './pages/AllocationPage'
import { DashboardPage } from './pages/DashboardPage'
import { LevelsPage } from './pages/LevelsPage'
import { PeoplePage } from './pages/PeoplePage'
import { SquadsPage } from './pages/SquadsPage'
import { WorkItemsPage } from './pages/WorkItemsPage'
import { AzureSettingsPage } from './pages/azure/AzureSettingsPage'
import { RequireAzureConfig } from './pages/azure/RequireAzureConfig'
import { AzureProjectsPage } from './pages/azure/AzureProjectsPage'
import { AzureProjectLayout } from './pages/azure/AzureProjectLayout'
import { AzureProjectPage } from './pages/azure/AzureProjectPage'
import { SprintAnalysisPage } from './pages/azure/SprintAnalysisPage'

function App() {
  return (
    <AzureConfigProvider>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<AllocationPage />} />
          <Route path="niveis" element={<LevelsPage />} />
          <Route path="work-items" element={<WorkItemsPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pessoas" element={<PeoplePage />} />
          <Route path="squads" element={<SquadsPage />} />
          <Route path="azure">
            <Route path="configuracao" element={<AzureSettingsPage />} />
            <Route element={<RequireAzureConfig />}>
              <Route index element={<AzureProjectsPage />} />
              <Route path=":projectId" element={<AzureProjectLayout />}>
                <Route index element={<AzureProjectPage />} />
                <Route path=":teamId/:iterationId" element={<SprintAnalysisPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </AzureConfigProvider>
  )
}

export default App
