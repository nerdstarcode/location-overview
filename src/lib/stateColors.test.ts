import { describe, expect, it } from 'vitest'
import { PALETTE } from './chartPalettes'
import { stateColor, stateColors, stateRank } from './stateColors'

const DEFAULT = { mode: 'default', isDark: false } as const

describe('stateColors', () => {
  it('usa a cor padrão sem diferenciar maiúsculas/espaços', () => {
    expect(stateColor('Closed', DEFAULT)).toBe('#00CB5D')
    expect(stateColor(' testing qa ', DEFAULT)).toBe('#FF7A00')
    expect(stateColor('Canceled', DEFAULT)).toBeUndefined()
  })

  it('states sem padrão giram pela paleta sem repetir as cores padrão usadas', () => {
    const [active, canceled] = stateColors(['Active', 'Canceled'], ['#0072BC', '#753BBD'], DEFAULT)
    expect(active).toBe('#0072BC')
    expect(canceled).toBe('#753BBD')
  })

  it('troca os tons conforme o modo de cor', () => {
    expect(stateColor('Fail', { mode: 'colorblind', isDark: false })).toBe('#D55E00')
    expect(stateColor('Fail', { mode: 'highContrast', isDark: true })).toBe('#FF6B6B')
  })

  it('ordena pelo fluxo e deixa desconhecidos no fim', () => {
    expect(['Closed', 'Xpto', 'MR Prod', 'New'].sort((a, b) => stateRank(a) - stateRank(b))).toEqual(['New', 'MR Prod', 'Closed', 'Xpto'])
    expect(stateColors(['Removed'], PALETTE, DEFAULT)).toHaveLength(1)
  })
})
