import { useEffect, useState } from 'react'
import { readJson, writeJson } from '../lib/localStore'

const acceptAny = <T,>(value: unknown): value is T => value !== undefined

/**
 * Como useState, mas o valor é lido/gravado no localStorage sob `key`, sobrevivendo
 * a remounts (troca de tab) e reloads de página.
 */
export function usePersistedState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readJson<T>(key, initialValue, acceptAny<T>))

  useEffect(() => {
    writeJson(key, value)
  }, [key, value])

  return [value, setValue] as const
}
