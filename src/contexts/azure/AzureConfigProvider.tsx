import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  clearAzureConfig,
  DEFAULT_AZURE_CONFIG,
  isAzureConfigured,
  loadAzureConfig,
  saveAzureConfig,
  type AzureConfig,
} from '../../lib/azure/azureConfigStorage'
import { listProjects } from '../../lib/azure/api'
import { AzureConfigContext, type AzureConfigContextValue } from './AzureConfigContext'

async function countVisibleProjects(config: AzureConfig): Promise<number> {
  return (await listProjects(config)).length
}

// Organização + PAT compartilhados por todas as rotas; os hooks de src/hooks/azure leem daqui.
export function AzureConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AzureConfig>(loadAzureConfig)

  const saveConfig = useCallback((next: AzureConfig) => {
    const normalized = { ...next, organization: next.organization.trim(), pat: next.pat.trim() }
    saveAzureConfig(normalized)
    setConfig(normalized)
  }, [])

  const clearConfig = useCallback(() => {
    clearAzureConfig()
    setConfig(DEFAULT_AZURE_CONFIG)
  }, [])

  const value = useMemo<AzureConfigContextValue>(
    () => ({ config, isConfigured: isAzureConfigured(config), saveConfig, clearConfig, testConnection: countVisibleProjects }),
    [config, saveConfig, clearConfig],
  )

  return <AzureConfigContext.Provider value={value}>{children}</AzureConfigContext.Provider>
}
