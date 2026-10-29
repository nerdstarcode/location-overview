import { beforeEach, describe, expect, it } from 'vitest'
import { exportAllData, importBackup, parseBackup, previewBackup } from './backupStorage'
import { loadAzureConfig, saveAzureConfig, DEFAULT_AZURE_CONFIG } from './azure/azureConfigStorage'
import { loadCargos, saveCargos } from './cargosStorage'
import { readRaw, UI_STATE_PREFIX, writeRaw } from './localStore'
import { loadPeople, savePeople } from './peopleStorage'
import { loadTestReports, saveTestReports } from './testReportsStorage'

const PERSON = { id: 'p1', nome: 'Ada', email: 'ada@x.com', cargo: 'Dev', nivel: 'SR', squadIds: [] }
const CARGO = { id: 'c1', cargo: 'Dev', tipo: 'Dev' as const, nivel: 'SR' }
const REPORT = { id: 'r1', squadId: 'sq1', sprintId: 's1', testPoints: 40, runsPercent: 100, passedPercent: 90, failedPercent: 10, notRunCount: 0, pointsRatio: 3.5 }

beforeEach(() => window.localStorage.clear())

describe('exportAllData', () => {
  it('organiza dados, Azure (sem o PAT) e preferências', () => {
    savePeople([PERSON])
    saveCargos([CARGO])
    saveTestReports([REPORT])
    saveAzureConfig({ ...DEFAULT_AZURE_CONFIG, organization: 'contoso', pat: 'segredo' })
    writeRaw('theme', 'dark')
    writeRaw(`${UI_STATE_PREFIX}squads-page-active-tab`, '"sprints"')
    writeRaw('outra-app', 'x')

    const backup = exportAllData()
    expect(backup).toMatchObject({ app: 'location-overview', version: 2 })
    expect(backup.data).toMatchObject({ people: [PERSON], cargos: [CARGO], testReports: [REPORT] })
    expect(backup.azure.organization).toBe('contoso')
    expect(JSON.stringify(backup)).not.toContain('segredo')
    expect(backup.preferences).toEqual({ theme: 'dark', [`${UI_STATE_PREFIX}squads-page-active-tab`]: '"sprints"' })
  })
})

describe('parseBackup / importBackup', () => {
  it('ida e volta: o arquivo exportado restaura tudo e mantém o PAT local', () => {
    savePeople([PERSON])
    saveCargos([CARGO])
    saveAzureConfig({ ...DEFAULT_AZURE_CONFIG, organization: 'contoso', pat: 'antigo' })
    writeRaw('theme', 'dark')
    const file = JSON.parse(JSON.stringify(exportAllData()))

    window.localStorage.clear()
    saveAzureConfig({ ...DEFAULT_AZURE_CONFIG, pat: 'meu-token' })
    importBackup(parseBackup(file))

    expect(loadPeople()).toEqual([PERSON])
    expect(loadCargos()).toEqual([CARGO])
    expect(loadAzureConfig()).toMatchObject({ organization: 'contoso', pat: 'meu-token' })
    expect(readRaw('theme')).toBe('dark')
  })

  it('aceita o formato antigo (v1, listas na raiz) e só substitui as seções presentes', () => {
    saveCargos([CARGO])
    importBackup(parseBackup({ exportedAt: '2025-01-01', people: [PERSON] }))
    expect(loadPeople()).toEqual([PERSON])
    expect(loadCargos()).toEqual([CARGO])
  })

  it('ignora token, chaves estranhas e seções inválidas, avisando na prévia', () => {
    const parsed = parseBackup({
      version: 2,
      data: { people: [PERSON], squads: 'quebrado', hiddenWorkItems: [1, 'x'] },
      azure: { organization: 'contoso', pat: 'vazado' },
      preferences: { theme: 'light', 'location-overview:azure-config': '{"pat":"x"}', [`${UI_STATE_PREFIX}aba`]: 1 },
    })
    expect(previewBackup(parsed)).toMatchObject({
      version: 2,
      sections: [{ key: 'people', label: 'Pessoas', count: 1 }],
      azure: true,
      preferences: 1,
      warnings: ['Squads: formato inválido, ignorado.', 'Work Items ocultos: formato inválido, ignorado.'],
    })
    importBackup(parsed)
    expect(loadAzureConfig().pat).toBe('')
    expect(readRaw('location-overview:azure-config')).not.toContain('"pat":"x"')
    expect(loadTestReports()).toEqual([])
  })

  it('recusa arquivo sem nenhuma seção reconhecida', () => {
    expect(() => parseBackup([])).toThrow(/objeto JSON/)
    expect(() => parseBackup({ foo: 1 })).toThrow(/nenhuma seção/)
  })
})
