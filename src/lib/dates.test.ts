import { describe, expect, it } from 'vitest'
import { formatDateBR, formatDayMonth, toDateKey, workingDaysBetween } from './dates'

describe('workingDaysBetween', () => {
  it('pula fins de semana', () => {
    expect(workingDaysBetween('2025-09-05T00:00:00Z', '2025-09-08T00:00:00Z')).toEqual(['2025-09-05', '2025-09-08'])
  })

  it('pula os days off do team (intervalo inclusivo)', () => {
    const days = workingDaysBetween('2025-09-01', '2025-09-05', [{ start: '2025-09-02T00:00:00Z', end: '2025-09-03T00:00:00Z' }])
    expect(days).toEqual(['2025-09-01', '2025-09-04', '2025-09-05'])
  })

  it('retorna vazio quando o fim é antes do início', () => {
    expect(workingDaysBetween('2025-09-05', '2025-09-01')).toEqual([])
  })
})

describe('formatação', () => {
  it('converte datas ISO', () => {
    expect(toDateKey('2025-09-01T12:30:00Z')).toBe('2025-09-01')
    expect(formatDateBR('2025-09-01T00:00:00Z')).toBe('01/09/2025')
    expect(formatDayMonth('2025-09-01')).toBe('01/09')
  })

  it('mostra traço sem data', () => {
    expect(formatDateBR(null)).toBe('—')
  })
})
