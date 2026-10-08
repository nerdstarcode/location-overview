import { describe, expect, it } from 'vitest'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import { azureWorkItemToRow, iterationSprintInfo, summarizeTestRuns, testRunsToReportFields } from './mappers'
import { FIXTURE_ITERATION, FIXTURE_TEST_RUNS } from './sprintFixtures'
import type { AzureWorkItem } from './types'

function workItem(fields: Record<string, unknown>): AzureWorkItem {
  return {
    id: 42,
    fields: {
      'System.WorkItemType': 'User Story',
      'System.Title': 'Login',
      'System.State': 'Active',
      'System.IterationPath': 'Portal\\Sprint 08 - FY25-26',
      ...fields,
    },
  }
}

describe('azureWorkItemToRow', () => {
  it('converte identidade, sprint e story points', () => {
    const row = azureWorkItemToRow(
      workItem({
        'System.AssignedTo': { displayName: 'Ada Lovelace', uniqueName: 'ada@example.com' },
        'Microsoft.VSTS.Scheduling.StoryPoints': 5,
        'System.Parent': 7,
      }),
      DEFAULT_AZURE_CONFIG,
    )
    expect(row).toMatchObject({
      id: 42,
      assignedTo: 'Ada Lovelace',
      email: 'ada@example.com',
      sprint: 'Sprint 08',
      fiscalYear: 'FY25-26',
      storyPoints: 5,
      parentId: 7,
      closedDate: undefined,
    })
  })

  it('lê Effort, Time Criticality e WSJF (configurado ou qualquer campo *.WSJF)', () => {
    const row = azureWorkItemToRow(
      workItem({
        'Microsoft.VSTS.Scheduling.Effort': 13,
        'Microsoft.VSTS.Common.TimeCriticality': 8,
        'Custom.WSJF': 4.5,
      }),
      DEFAULT_AZURE_CONFIG,
    )
    expect(row).toMatchObject({ effort: 13, timeCriticality: 8, wsjf: 4.5 })
    expect(azureWorkItemToRow(workItem({ 'MyOrg.Wsjf': 2 }), DEFAULT_AZURE_CONFIG).wsjf).toBe(2)
    expect(azureWorkItemToRow(workItem({}), DEFAULT_AZURE_CONFIG)).toMatchObject({ timeCriticality: 0, wsjf: 0 })
  })

  it('usa o campo de SP configurado e cai para o padrão quando ele não existe', () => {
    const config = { ...DEFAULT_AZURE_CONFIG, storyPointsField: 'Custom.Points' }
    expect(azureWorkItemToRow(workItem({ 'Custom.Points': 8 }), config).storyPoints).toBe(8)
    expect(azureWorkItemToRow(workItem({ 'Microsoft.VSTS.Scheduling.StoryPoints': 3 }), config).storyPoints).toBe(3)
  })

  it('só preenche closedDate em itens fechados, com fallback para ResolvedDate', () => {
    const closed = workItem({ 'System.State': 'Closed', 'Microsoft.VSTS.Common.ResolvedDate': '2025-09-03T10:00:00Z' })
    expect(azureWorkItemToRow(closed, DEFAULT_AZURE_CONFIG).closedDate).toBe('2025-09-03T10:00:00Z')
    const active = workItem({ 'Microsoft.VSTS.Common.ClosedDate': '2025-09-03T10:00:00Z' })
    expect(azureWorkItemToRow(active, DEFAULT_AZURE_CONFIG).closedDate).toBeUndefined()
  })
})

describe('iterationSprintInfo', () => {
  it('lê número e fiscal year do nome', () => {
    expect(iterationSprintInfo(FIXTURE_ITERATION)).toEqual({ number: 8, fiscalYear: 'FY25-26' })
  })

  it('usa o path quando o nome não segue o padrão', () => {
    expect(iterationSprintInfo({ ...FIXTURE_ITERATION, name: 'Iteração 8' })).toEqual({ number: 8, fiscalYear: 'FY25-26' })
  })

  it('retorna null sem padrão reconhecível', () => {
    expect(iterationSprintInfo({ ...FIXTURE_ITERATION, name: 'Backlog', path: 'Portal\\Backlog' })).toBeNull()
  })
})

describe('test runs', () => {
  it('resume execuções e resultados', () => {
    const summary = summarizeTestRuns(FIXTURE_TEST_RUNS)
    expect(summary).toMatchObject({ runCount: 3, automatedRuns: 2, manualRuns: 1, totalTests: 90, passed: 84, failed: 3, notRun: 2 })
    expect(summary.runsByDay).toEqual({ '2025-09-02': 2, '2025-09-09': 1 })
  })

  it('gera os percentuais do relatório de testes', () => {
    expect(testRunsToReportFields(summarizeTestRuns(FIXTURE_TEST_RUNS))).toEqual({
      testPoints: 90,
      runsPercent: 97.8,
      passedPercent: 93.3,
      failedPercent: 3.3,
      notRunCount: 2,
    })
  })
})
