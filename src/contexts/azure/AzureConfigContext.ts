import { createContext, useContext } from 'react'
import type { AzureConfig } from '../../lib/azure/azureConfigStorage'

export interface AzureConfigContextValue {
  config: AzureConfig
  isConfigured: boolean
  saveConfig: (config: AzureConfig) => void
  clearConfig: () => void
  /** Valida organização + PAT listando os projetos; resolve com a quantidade encontrada. */
  testConnection: (config: AzureConfig) => Promise<number>
}

export const AzureConfigContext = createContext<AzureConfigContextValue | null>(null)

export function useAzureConfig(): AzureConfigContextValue {
  const value = useContext(AzureConfigContext)
  if (!value) throw new Error('useAzureConfig precisa estar dentro de <AzureConfigProvider>.')
  return value
}
