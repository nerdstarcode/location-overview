import { useEffect, useState } from 'react'
import { readJson, removeKey, UI_STATE_PREFIX, writeJson } from '../lib/localStore'

const acceptAny = <T,>(value: unknown): value is T => value !== undefined

/**
 * Como useState, mas o valor é lido/gravado no localStorage sob `UI_STATE_PREFIX + key`,
 * sobrevivendo a remounts (troca de tab) e reloads de página. O prefixo junta as preferências
 * de tela para o backup; o valor salvo antes dele (na chave sem prefixo) é migrado.
 */
export function usePersistedState<T>(key: string, initialValue: T) {
  const storageKey = UI_STATE_PREFIX + key
  const [value, setValue] = useState<T>(() =>
    readJson<T>(storageKey, readJson<T>(key, initialValue, acceptAny<T>), acceptAny<T>),
  )

  useEffect(() => {
    writeJson(storageKey, value)
    removeKey(key)
  }, [storageKey, key, value])

  return [value, setValue] as const
}
