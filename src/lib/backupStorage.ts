import { loadAllocations, saveAllocations } from './allocationStorage'
import { DEFAULT_AZURE_CONFIG, loadAzureConfig, saveAzureConfig, type AzureConfig } from './azure/azureConfigStorage'
import { loadCargos, saveCargos } from './cargosStorage'
import { loadHiddenWorkItems, saveHiddenWorkItems } from './hiddenWorkItemsStorage'
import { loadLevels, saveLevels } from './levelsStorage'
import { listKeys, readRaw, UI_STATE_PREFIX, writeRaw } from './localStore'
import { loadPeople, savePeople } from './peopleStorage'
import { loadPersonAllocations, savePersonAllocations } from './personAllocationsStorage'
import { loadSprints, saveSprints } from './sprintsStorage'
import { loadSquads, saveSquads } from './squadsStorage'
import { loadTestExecutions, saveTestExecutions } from './testExecutionsStorage'
import { loadTestReports, saveTestReports } from './testReportsStorage'
import { loadWorkItems, saveWorkItems } from './workItemsStorage'

// Backup de tudo o que o app guarda no localStorage, num arquivo JSON organizado em 3 partes:
// `data` (os cadastros e bases de cada tela), `azure` (a configuração do Azure DevOps SEM o
// token/PAT) e `preferences` (tema, menu, abas e filtros). Importar substitui só as seções
// presentes no arquivo; backups antigos (v1, com as listas soltas na raiz) continuam aceitos.

export const BACKUP_APP = 'location-overview'
export const BACKUP_VERSION = 2

interface DataSection {
  key: string
  label: string
  load: () => unknown[]
  save: (rows: never[]) => void
  /** Valida cada item: objeto por padrão; ids numéricos nos work items ocultos. */
  isItem?: (item: unknown) => boolean
}

const isObject = (item: unknown) => typeof item === 'object' && item !== null && !Array.isArray(item)

/** Seções de dados, na ordem em que aparecem no arquivo e na prévia da importação. */
const DATA_SECTIONS: DataSection[] = [
  { key: 'people', label: 'Pessoas', load: loadPeople, save: savePeople },
  { key: 'cargos', label: 'Cargos', load: loadCargos, save: saveCargos },
  { key: 'levels', label: 'Níveis', load: loadLevels, save: saveLevels },
  { key: 'squads', label: 'Squads', load: loadSquads, save: saveSquads },
  { key: 'sprints', label: 'Sprints', load: loadSprints, save: saveSprints },
  { key: 'personAllocations', label: 'Alocações por pessoa', load: loadPersonAllocations, save: savePersonAllocations },
  { key: 'allocations', label: 'Alocação (planilha importada)', load: loadAllocations, save: saveAllocations },
  { key: 'workItems', label: 'Work Items', load: loadWorkItems, save: saveWorkItems },
  {
    key: 'hiddenWorkItems',
    label: 'Work Items ocultos',
    load: loadHiddenWorkItems,
    save: saveHiddenWorkItems,
    isItem: (item) => typeof item === 'number',
  },
  { key: 'testReports', label: 'Relatórios de teste', load: loadTestReports, save: saveTestReports },
  { key: 'testExecutions', label: 'Execuções de teste por pessoa', load: loadTestExecutions, save: saveTestExecutions },
]

/** Configuração do Azure que vai no arquivo: tudo menos o token (PAT). */
export type AzureBackup = Omit<AzureConfig, 'pat'>

/** Preferências fora do usePersistedState (que grava tudo sob UI_STATE_PREFIX). */
const PREFERENCE_KEYS = [
  'theme',
  'location-overview:sidebar-open',
  'location-overview:colorblind-mode',
  'location-overview:high-contrast-mode',
]

const isPreferenceKey = (key: string) => PREFERENCE_KEYS.includes(key) || key.startsWith(UI_STATE_PREFIX)

export interface AppBackup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: Record<string, unknown[]>
  azure: AzureBackup
  /** Valor bruto de cada chave (como está no localStorage). */
  preferences: Record<string, string>
}

export function exportAllData(): AppBackup {
  // Desestruturado para o PAT nunca entrar no arquivo.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pat, ...azure } = loadAzureConfig()
  const preferences: Record<string, string> = {}
  for (const key of [...PREFERENCE_KEYS, ...listKeys(UI_STATE_PREFIX)]) {
    const value = readRaw(key)
    if (value !== null) preferences[key] = value
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(DATA_SECTIONS.map((section) => [section.key, section.load()])),
    azure,
    preferences,
  }
}

export interface ParsedBackup {
  version: number
  exportedAt?: string
  /** Só as seções válidas presentes no arquivo. */
  data: Map<string, unknown[]>
  azure: Partial<AzureBackup> | null
  preferences: Record<string, string>
  /** Seções ignoradas por formato inválido. */
  warnings: string[]
}

export interface BackupPreview {
  version: number
  exportedAt?: string
  sections: { key: string; label: string; count: number }[]
  azure: boolean
  preferences: number
  warnings: string[]
}

/** Lê o JSON (v2 ou v1), separando o que é válido; erro só se nada puder ser importado. */
export function parseBackup(raw: unknown): ParsedBackup {
  if (!isObject(raw)) throw new Error('Arquivo inválido: esperado um objeto JSON.')
  const file = raw as Record<string, unknown>
  const isV2 = isObject(file.data)
  // v1: as listas ficavam na raiz do arquivo.
  const source = (isV2 ? file.data : file) as Record<string, unknown>

  const data = new Map<string, unknown[]>()
  const warnings: string[] = []
  for (const section of DATA_SECTIONS) {
    const value = source[section.key]
    if (value === undefined) continue
    if (Array.isArray(value) && value.every(section.isItem ?? isObject)) data.set(section.key, value)
    else warnings.push(`${section.label}: formato inválido, ignorado.`)
  }

  let azure: Partial<AzureBackup> | null = null
  if (isObject(file.azure)) {
    // Mesmo que alguém tenha colocado um token no arquivo, ele não é importado.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pat, ...rest } = file.azure as Partial<AzureConfig>
    azure = rest
  }

  const preferences: Record<string, string> = {}
  if (isObject(file.preferences)) {
    for (const [key, value] of Object.entries(file.preferences as Record<string, unknown>)) {
      if (isPreferenceKey(key) && typeof value === 'string') preferences[key] = value
    }
  }

  if (data.size === 0 && !azure && Object.keys(preferences).length === 0) {
    throw new Error('O arquivo não tem nenhuma seção de backup reconhecida.')
  }
  return {
    version: typeof file.version === 'number' ? file.version : 1,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : undefined,
    data,
    azure,
    preferences,
    warnings,
  }
}

export function previewBackup(backup: ParsedBackup): BackupPreview {
  return {
    version: backup.version,
    exportedAt: backup.exportedAt,
    sections: DATA_SECTIONS.filter((s) => backup.data.has(s.key)).map((s) => ({
      key: s.key,
      label: s.label,
      count: backup.data.get(s.key)?.length ?? 0,
    })),
    azure: backup.azure !== null,
    preferences: Object.keys(backup.preferences).length,
    warnings: backup.warnings,
  }
}

/** Substitui as seções presentes no backup; a configuração do Azure mantém o token já salvo. */
export function importBackup(backup: ParsedBackup): void {
  for (const section of DATA_SECTIONS) {
    const rows = backup.data.get(section.key)
    if (rows) section.save(rows as never[])
  }
  if (backup.azure) {
    const current = loadAzureConfig()
    saveAzureConfig({ ...DEFAULT_AZURE_CONFIG, ...current, ...backup.azure, pat: current.pat })
  }
  for (const [key, value] of Object.entries(backup.preferences)) writeRaw(key, value)
}

/** Atalho: valida e importa de uma vez. */
export function importAllData(raw: unknown): void {
  importBackup(parseBackup(raw))
}
