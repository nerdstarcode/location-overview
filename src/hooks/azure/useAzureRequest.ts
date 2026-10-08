import { useCallback, useEffect, useRef, useState } from 'react'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'
import type { AzureConfig } from '../../lib/azure/azureConfigStorage'
import { isAbortError } from '../../lib/azure/client'

export type AzureFetcher<T> = (config: AzureConfig, signal: AbortSignal) => Promise<T>

export interface AzureRequest<T> {
  /** Identifica o recurso: a requisição é refeita quando a key muda. */
  key: string
  fetch: AzureFetcher<T>
}

export interface AzureRequestState<T> {
  data: T | undefined
  error: Error | null
  loading: boolean
  reload: () => void
}

interface Settled<T> {
  requestKey: string
  resourceKey: string
  data: T | undefined
  error: Error | null
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Único ponto que transforma uma chamada ao Azure DevOps em estado de tela. Cancela a
 * requisição anterior ao trocar de key, não roda sem request (null) nem sem configuração
 * e, no `reload`, mantém os dados atuais visíveis até a nova resposta chegar.
 */
export function useAzureRequest<T>(request: AzureRequest<T> | null): AzureRequestState<T> {
  const { config, isConfigured } = useAzureConfig()
  const [version, setVersion] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const fetchRef = useRef(request?.fetch)

  useEffect(() => {
    fetchRef.current = request?.fetch
  })

  // Organização/PAT/campo de SP fazem parte da identidade do recurso: mudar a config refaz a busca.
  const resourceKey =
    request && isConfigured ? [config.organization, config.pat, config.storyPointsField, request.key].join('|') : null
  const requestKey = resourceKey !== null ? `${resourceKey}#${version}` : null

  useEffect(() => {
    const fetchResource = fetchRef.current
    if (requestKey === null || resourceKey === null || !fetchResource) return
    const controller = new AbortController()
    fetchResource(config, controller.signal).then(
      (data) => setSettled({ requestKey, resourceKey, data, error: null }),
      (error) => {
        if (isAbortError(error) || controller.signal.aborted) return
        setSettled({ requestKey, resourceKey, data: undefined, error: toError(error) })
      },
    )
    return () => controller.abort()
  }, [requestKey, resourceKey, config])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  const isCurrent = settled !== null && settled.requestKey === requestKey
  const isSameResource = settled !== null && settled.resourceKey === resourceKey
  return {
    data: isSameResource ? settled.data : undefined,
    error: isCurrent ? settled.error : null,
    loading: requestKey !== null && !isCurrent,
    reload,
  }
}
