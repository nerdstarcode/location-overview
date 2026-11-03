import { describe, expect, it } from 'vitest'
import { buildWorkItemRow } from './workItems'
import { mergeWorkItems } from './workItemsStorage'

const HISTORY = [{ state: 'Active', date: '2025-09-02T12:00:00Z' }]

describe('mergeWorkItems', () => {
  it('o registro novo vence, mas mantém o histórico e os Test Cases salvos quando o novo não traz', () => {
    const synced = { ...buildWorkItemRow({ id: 1, title: 'Antigo', state: 'Active' }), stateHistory: HISTORY, testCaseIds: [10] }
    const fromSheet = buildWorkItemRow({ id: 1, title: 'Novo', state: 'Closed' })
    expect(mergeWorkItems([synced], [fromSheet])).toEqual([{ ...fromSheet, stateHistory: HISTORY, testCaseIds: [10] }])

    const resynced = { ...fromSheet, stateHistory: [], testCaseIds: [11] }
    expect(mergeWorkItems([synced], [resynced])[0]).toMatchObject({ stateHistory: [], testCaseIds: [11] })
  })
})
