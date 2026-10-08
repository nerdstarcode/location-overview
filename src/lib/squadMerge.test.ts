import { describe, expect, it } from 'vitest'
import { loadPeople, savePeople } from './peopleStorage'
import { loadPersonAllocations, savePersonAllocations } from './personAllocationsStorage'
import { mergeSquads } from './squadMerge'
import { loadSquads, saveSquads } from './squadsStorage'
import { loadTestReports, saveTestReports, type TestReport } from './testReportsStorage'

function report(id: string, squadId: string, sprintId: string): TestReport {
  return { id, squadId, sprintId, testPoints: 0, runsPercent: 0, passedPercent: 0, failedPercent: 0, notRunCount: 0, pointsRatio: 3.5 }
}

describe('mergeSquads', () => {
  it('absorve a squad, mantendo o registro da principal em conflito', () => {
    saveSquads([
      { id: 'main', name: 'Renewals' },
      { id: 'dup', name: 'Renewals Team', aliases: ['RNW'] },
    ])
    savePersonAllocations([
      { id: 'a1', personId: 'p1', squadId: 'main', sprintId: 's1', percentage: 50 },
      { id: 'a2', personId: 'p1', squadId: 'dup', sprintId: 's1', percentage: 30 },
      { id: 'a3', personId: 'p2', squadId: 'dup', sprintId: 's1', percentage: 100 },
    ])
    saveTestReports([report('r1', 'main', 's1'), report('r2', 'dup', 's1'), report('r3', 'dup', 's2')])
    savePeople([
      { id: 'p1', nome: 'Ada', email: '', cargo: '', nivel: '', squadIds: ['main', 'dup'] },
      { id: 'p2', nome: 'Bia', email: '', cargo: '', nivel: '', squadIds: ['dup'] },
    ])

    expect(mergeSquads('dup', 'main')).toEqual({
      allocationsMoved: 1,
      allocationsDiscarded: 1,
      testReportsMoved: 1,
      testReportsDiscarded: 1,
    })
    expect(loadSquads()).toEqual([{ id: 'main', name: 'Renewals', aliases: ['Renewals Team', 'RNW'] }])
    expect(loadPersonAllocations().map((a) => [a.id, a.squadId])).toEqual([
      ['a1', 'main'],
      ['a3', 'main'],
    ])
    expect(loadTestReports().map((r) => [r.id, r.squadId])).toEqual([
      ['r1', 'main'],
      ['r3', 'main'],
    ])
    expect(loadPeople().map((p) => p.squadIds)).toEqual([['main'], ['main']])
  })
})
