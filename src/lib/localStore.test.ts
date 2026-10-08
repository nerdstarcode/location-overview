import { describe, expect, it } from 'vitest'
import { readJson, readList, removeKey, writeJson } from './localStore'

const isNumber = (value: unknown): value is number => typeof value === 'number'

describe('localStore', () => {
  it('grava e lê JSON', () => {
    writeJson('k', [1, 2])
    expect(readList<number>('k')).toEqual([1, 2])
  })

  it('usa o fallback para chave ausente, JSON inválido ou formato inesperado', () => {
    expect(readJson('ausente', 7, isNumber)).toBe(7)
    window.localStorage.setItem('quebrado', '{')
    expect(readList('quebrado')).toEqual([])
    writeJson('objeto', { a: 1 })
    expect(readList('objeto')).toEqual([])
  })

  it('remove a chave', () => {
    writeJson('k', 1)
    removeKey('k')
    expect(readJson('k', 0, isNumber)).toBe(0)
  })
})
