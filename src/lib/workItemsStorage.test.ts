import { describe, expect, it } from 'vitest'
import { buildWorkItemRow } from './workItems'
import { mergeWorkItems } from './workItemsStorage'

const HISTORY = [{ state: 'Active', date: '2025-09-02T12:00:00Z' }]

describe('mergeWorkItems', () => {
  it('o registro novo vence, mas mantém o histórico de estados salvo quando o novo não traz', () => {
    const synced = { ...buildWorkItemRow({ ID: 1, Title: 'Antigo', State: 'Active' }), stateHistory: HISTORY }
    const fromSheet = buildWorkItemRow({ ID: 1, Title: 'Novo', State: 'Closed' })
    expect(mergeWorkItems([synced], [fromSheet])).toEqual([{ ...fromSheet, stateHistory: HISTORY }])

    const resynced = { ...fromSheet, stateHistory: [] }
    expect(mergeWorkItems([synced], [resynced])[0].stateHistory).toEqual([])
  })
})
