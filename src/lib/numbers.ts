export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Percentual (0-100, 1 casa) de `part` sobre `total`; 0 quando não há total. */
export function percentOf(part: number, total: number): number {
  return total > 0 ? round1((part / total) * 100) : 0
}
