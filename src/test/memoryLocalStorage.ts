import { beforeEach } from 'vitest'

// Os testes unitários rodam em Node (sem DOM): os storages usam `window.localStorage`,
// então expomos um Storage em memória, limpo antes de cada teste.
class MemoryStorage implements Storage {
  private items = new Map<string, string>()

  get length() {
    return this.items.size
  }

  clear() {
    this.items.clear()
  }

  getItem(key: string) {
    return this.items.get(key) ?? null
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.items.delete(key)
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value))
  }
}

const storage = new MemoryStorage()
Object.assign(globalThis, { window: { localStorage: storage } })

beforeEach(() => storage.clear())
