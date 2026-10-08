import { readJson, removeKey, writeJson } from '../localStore'

export interface AzureConfig {
  /** Nome da organização em https://dev.azure.com/{organization}. */
  organization: string
  pat: string
  /** Reference name do campo de story points — varia por processo (Agile/Scrum/customizado). */
  storyPointsField: string
  /** Reference name do campo WSJF (customizado na maioria dos processos); sem ele, qualquer campo "*.WSJF". */
  wsjfField: string
  /** Faixa de story points esperada para QA, em % do total de SP da sprint. */
  qaMinPercent: number
  qaMaxPercent: number
  /** Tasks/Test Cases ficam fora por padrão para não somar em dobro com a User Story. */
  pointTypes: string[]
}

export const DEFAULT_AZURE_CONFIG: AzureConfig = {
  organization: '',
  pat: '',
  storyPointsField: 'Microsoft.VSTS.Scheduling.StoryPoints',
  wsjfField: 'Custom.WSJF',
  qaMinPercent: 20,
  qaMaxPercent: 30,
  pointTypes: ['User Story', 'Bug', 'Enabler'],
}

// Fica fora de backupStorage de propósito: o backup é exportado como arquivo e não deve levar o PAT.
const STORAGE_KEY = 'location-overview:azure-config'

function isPartialConfig(value: unknown): value is Partial<AzureConfig> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function loadAzureConfig(): AzureConfig {
  return { ...DEFAULT_AZURE_CONFIG, ...readJson<Partial<AzureConfig>>(STORAGE_KEY, {}, isPartialConfig) }
}

export function saveAzureConfig(config: AzureConfig): void {
  writeJson(STORAGE_KEY, config)
}

export function clearAzureConfig(): void {
  removeKey(STORAGE_KEY)
}

export function isAzureConfigured(config: AzureConfig): boolean {
  return config.organization.trim() !== '' && config.pat.trim() !== ''
}
