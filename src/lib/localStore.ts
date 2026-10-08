// Único ponto de acesso ao localStorage: JSON inválido cai no fallback e erros de
// quota/privacidade (modo anônimo, storage bloqueado) são ignorados aqui, não em cada storage.

export function readJson<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function readList<T>(key: string): T[] {
  return readJson<T[]>(key, [], (value): value is T[] => Array.isArray(value))
}

export function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore quota / privacy errors */
  }
}
