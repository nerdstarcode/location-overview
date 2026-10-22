// Busca textual das tabelas: ignora maiúsculas e acentos, casa por trecho e
// exige que todas as palavras do termo apareçam na linha (em qualquer coluna).

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function splitSearchTerms(term: string): string[] {
  return normalizeText(term).split(/\s+/).filter(Boolean)
}

export function matchesSearch(cellTexts: string[], terms: string[]): boolean {
  if (terms.length === 0) return true
  const normalizedTexts = cellTexts.map(normalizeText)
  return terms.every((term) => normalizedTexts.some((text) => text.includes(term)))
}
