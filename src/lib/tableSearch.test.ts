import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeText, splitSearchTerms } from './tableSearch'

describe('normalizeText', () => {
  it('remove acentos e converte para minúsculas', () => {
    expect(normalizeText('João Conceição')).toBe('joao conceicao')
  })
})

describe('splitSearchTerms', () => {
  it('divide por espaços e descarta vazios', () => {
    expect(splitSearchTerms('  João   SILVA ')).toEqual(['joao', 'silva'])
  })

  it('retorna vazio para termo em branco', () => {
    expect(splitSearchTerms('   ')).toEqual([])
  })
})

describe('matchesSearch', () => {
  const cells = ['João da Silva', 'Apollo', '01/09/2025']

  it('casa qualquer linha quando não há termos', () => {
    expect(matchesSearch(cells, [])).toBe(true)
  })

  it('casa por trecho ignorando acentos e caixa', () => {
    expect(matchesSearch(cells, splitSearchTerms('JOAO'))).toBe(true)
  })

  it('exige todas as palavras, mesmo fora de ordem e não contíguas', () => {
    expect(matchesSearch(cells, splitSearchTerms('silva joao'))).toBe(true)
  })

  it('aceita palavras distribuídas em colunas diferentes', () => {
    expect(matchesSearch(cells, splitSearchTerms('silva apollo 01/09'))).toBe(true)
  })

  it('rejeita quando alguma palavra não aparece', () => {
    expect(matchesSearch(cells, splitSearchTerms('silva hermes'))).toBe(false)
  })
})
