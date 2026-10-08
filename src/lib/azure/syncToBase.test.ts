import { describe, expect, it } from 'vitest'
import { loadPeople, savePeople } from '../peopleStorage'
import { loadSprints, saveSprints } from '../sprintsStorage'
import { loadSquads, saveSquads } from '../squadsStorage'
import { loadTestReports, saveTestReports } from '../testReportsStorage'
import { loadWorkItems } from '../workItemsStorage'
import { FIXTURE_ITERATION, FIXTURE_MEMBERS, FIXTURE_TEST_RUNS_SUMMARY, FIXTURE_WORK_ITEMS } from './sprintFixtures'
import {
  syncSprintToBase,
  upsertPeopleFromTeam,
  upsertSprintFromIteration,
  upsertSquadByName,
  upsertTestReportFromRuns,
} from './syncToBase'

describe('upsertSquadByName', () => {
  it('reaproveita a squad de mesmo nome, sem diferenciar maiúsculas', () => {
    saveSquads([{ id: 'sq1', name: 'Portal' }])
    expect(upsertSquadByName(' portal ')).toEqual({ squad: { id: 'sq1', name: 'Portal' }, created: false })
    expect(upsertSquadByName('Backoffice').created).toBe(true)
    expect(loadSquads()).toHaveLength(2)
  })

  it('reconhece o Team pelo nome alternativo da squad', () => {
    saveSquads([{ id: 'sq1', name: 'Renewals', aliases: ['Renewals Team'] }])
    expect(upsertSquadByName('Renewals Team')).toMatchObject({ squad: { id: 'sq1' }, created: false })
  })
})

describe('upsertPeopleFromTeam', () => {
  it('vincula pessoas existentes por email sem apagar cargo/nível e cria as novas', () => {
    savePeople([{ id: 'p1', nome: 'Ada', email: 'ADA@example.com', cargo: 'Dev', nivel: 'SR', squadIds: [] }])
    expect(upsertPeopleFromTeam('sq1', FIXTURE_MEMBERS)).toEqual({ created: 2, linked: 1 })
    const ada = loadPeople().find((p) => p.id === 'p1')
    expect(ada).toMatchObject({ cargo: 'Dev', nivel: 'SR', squadIds: ['sq1'] })
    expect(upsertPeopleFromTeam('sq1', FIXTURE_MEMBERS)).toEqual({ created: 0, linked: 0 })
  })
})

describe('upsertSprintFromIteration', () => {
  it('cria a sprint com o padrão de 10 dias válidos', () => {
    const result = upsertSprintFromIteration(FIXTURE_ITERATION)
    expect(result?.created).toBe(true)
    expect(result?.sprint).toMatchObject({ number: 8, fiscalYear: 'FY25-26', startDate: '2025-09-01', endDate: '2025-09-12', totalValidDays: 10 })
  })

  it('mantém o totalValidDays ajustado à mão', () => {
    saveSprints([{ id: 's8', number: 8, fiscalYear: 'FY25-26', startDate: '', endDate: '', totalValidDays: 7 }])
    expect(upsertSprintFromIteration(FIXTURE_ITERATION)?.sprint).toMatchObject({ id: 's8', totalValidDays: 7, startDate: '2025-09-01' })
  })

  it('ignora iterations fora do padrão de nome', () => {
    expect(upsertSprintFromIteration({ ...FIXTURE_ITERATION, name: 'Backlog', path: 'Portal\\Backlog' })).toBeNull()
  })
})

describe('upsertTestReportFromRuns', () => {
  it('preserva o pointsRatio de um relatório existente', () => {
    saveTestReports([
      { id: 'r1', squadId: 'sq1', sprintId: 's8', testPoints: 0, runsPercent: 0, passedPercent: 0, failedPercent: 0, notRunCount: 0, pointsRatio: 2 },
    ])
    upsertTestReportFromRuns('sq1', 's8', FIXTURE_TEST_RUNS_SUMMARY)
    expect(loadTestReports()).toEqual([expect.objectContaining({ id: 'r1', pointsRatio: 2, testPoints: 90 })])
  })
})

describe('syncSprintToBase', () => {
  it('grava squad, pessoas, sprint, work items e relatório de testes', () => {
    const result = syncSprintToBase({
      teamName: 'Portal',
      members: FIXTURE_MEMBERS,
      iteration: FIXTURE_ITERATION,
      workItems: FIXTURE_WORK_ITEMS,
      testRuns: FIXTURE_TEST_RUNS_SUMMARY,
    })
    expect(result).toEqual({ squadCreated: true, peopleCreated: 3, peopleLinked: 0, sprintCreated: true, workItems: 13, testReport: true })
    expect(loadWorkItems()).toHaveLength(13)
    expect(loadSprints()[0].totalValidDays).toBe(10)
  })

  it('não grava relatório de testes sem runs', () => {
    const result = syncSprintToBase({
      teamName: 'Portal',
      members: [],
      iteration: FIXTURE_ITERATION,
      workItems: [],
      testRuns: null,
    })
    expect(result.testReport).toBe(false)
    expect(loadTestReports()).toEqual([])
  })
})
