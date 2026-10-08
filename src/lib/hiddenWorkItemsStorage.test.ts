import { describe, expect, it } from 'vitest'
import { FIXTURE_WORK_ITEMS } from './azure/sprintFixtures'
import { exportAllData, importAllData } from './backupStorage'
import { excludeHidden, loadHiddenWorkItems, toggleHiddenWorkItem } from './hiddenWorkItemsStorage'

describe('hiddenWorkItemsStorage', () => {
  it('alterna o item entre oculto e visível', () => {
    expect(toggleHiddenWorkItem(101)).toEqual([101])
    expect(toggleHiddenWorkItem(102)).toEqual([101, 102])
    expect(toggleHiddenWorkItem(101)).toEqual([102])
    expect(loadHiddenWorkItems()).toEqual([102])
  })

  it('tira o item oculto e as Tasks filhas dele', () => {
    const ids = excludeHidden(FIXTURE_WORK_ITEMS, new Set([101])).map((item) => item.id)
    expect(ids).not.toContain(101)
    expect(ids).not.toContain(201) // Task filha da 101
    expect(ids).not.toContain(202)
    expect(ids).toContain(203)
  })

  it('entra no backup', () => {
    toggleHiddenWorkItem(7)
    const backup = exportAllData()
    expect(backup.hiddenWorkItems).toEqual([7])
    toggleHiddenWorkItem(7)
    importAllData(backup)
    expect(loadHiddenWorkItems()).toEqual([7])
  })
})
