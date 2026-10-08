import { describe, expect, it } from 'vitest'
import { dateWindows, startedWithin } from './api'
import type { AzureTestRun } from './types'

const iso = (date: Date) => date.toISOString().slice(0, 10)

describe('dateWindows', () => {
  it('divide o intervalo em janelas de no máximo N dias', () => {
    const windows = dateWindows(new Date('2025-09-01'), new Date('2025-09-16'), 7)
    expect(windows.map((w) => [iso(w.start), iso(w.end)])).toEqual([
      ['2025-09-01', '2025-09-08'],
      ['2025-09-08', '2025-09-15'],
      ['2025-09-15', '2025-09-16'],
    ])
  })

  it('não gera janelas quando o fim não passa do início', () => {
    expect(dateWindows(new Date('2025-09-10'), new Date('2025-09-01'), 7)).toEqual([])
  })
})

describe('startedWithin', () => {
  const run = (startedDate?: string) => ({ id: 1, startedDate }) as AzureTestRun
  const start = new Date('2025-09-01T00:00:00Z')
  const end = new Date('2025-09-12T00:00:00Z')

  it('inclui runs do último dia inteiro', () => {
    expect(startedWithin(run('2025-09-12T23:00:00Z'), start, end)).toBe(true)
  })

  it('exclui runs fora do período ou sem data', () => {
    expect(startedWithin(run('2025-08-31T23:59:00Z'), start, end)).toBe(false)
    expect(startedWithin(run('2025-09-13T00:00:00Z'), start, end)).toBe(false)
    expect(startedWithin(run(), start, end)).toBe(false)
  })
})
