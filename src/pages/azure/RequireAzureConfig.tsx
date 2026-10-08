import { Navigate, Outlet } from 'react-router-dom'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'

/** Rotas do Azure DevOps só abrem com organização + PAT configurados. */
export function RequireAzureConfig() {
  const { isConfigured } = useAzureConfig()
  return isConfigured ? <Outlet /> : <Navigate to="/azure/configuracao" replace />
}
