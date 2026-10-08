/** Chave para comparar nomes/emails sem diferenciar maiúsculas nem espaços nas pontas. */
export function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}
