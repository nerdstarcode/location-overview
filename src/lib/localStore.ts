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

/** Prefixo das preferências de tela (abas, filtros) gravadas por usePersistedState. */
export const UI_STATE_PREFIX = 'location-overview:ui:'

/** Valor bruto (sem JSON.parse) de uma chave; null se ausente ou se o storage estiver bloqueado. */
export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore quota / privacy errors */
  }
}

/** Chaves do localStorage que começam com `prefix`. */
export function listKeys(prefix: string): string[] {
  try {
    const { localStorage } = window
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}
