import type { AzureConfig } from './azureConfigStorage'

const API_VERSION = '7.1'

/** Status usado quando a requisição nem chega ao servidor (rede fora ou CORS bloqueado). */
export const NETWORK_ERROR_STATUS = 0

export class AzureApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AzureApiError'
    this.status = status
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  [NETWORK_ERROR_STATUS]:
    'Não foi possível conectar ao Azure DevOps (rede ou CORS bloqueado pelo navegador). Verifique a organização e a conexão.',
  401: 'Token inválido ou expirado. Atualize o PAT na configuração do Azure DevOps.',
  403: 'O token não tem permissão para este recurso. Verifique os escopos do PAT.',
  404: 'Recurso não encontrado no Azure DevOps (organização, projeto ou team incorretos?).',
  429: 'Limite de requisições do Azure DevOps atingido. Aguarde alguns instantes e tente de novo.',
}

function errorFor(status: number, detail = ''): AzureApiError {
  return new AzureApiError(status, STATUS_MESSAGES[status] ?? (detail || `Erro ${status} ao chamar o Azure DevOps.`))
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export interface AzureFetchOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Query string adicional; api-version é incluída automaticamente. */
  query?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

interface AzureResponse<T> {
  data: T
  continuationToken: string | null
}

function buildUrl(config: AzureConfig, path: string, query: AzureFetchOptions['query']): string {
  const url = new URL(`https://dev.azure.com/${encodeURIComponent(config.organization.trim())}/${path.replace(/^\//, '')}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  url.searchParams.set('api-version', API_VERSION)
  return url.toString()
}

function buildHeaders(config: AzureConfig, hasBody: boolean): HeadersInit {
  return {
    Authorization: `Basic ${btoa(`:${config.pat.trim()}`)}`,
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return typeof body?.message === 'string' ? body.message : ''
  } catch {
    return ''
  }
}

// Um PAT inválido às vezes recebe 203 + página HTML de login em vez de 401.
function assertJsonResponse(response: Response): void {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) throw errorFor(401)
}

async function send(config: AzureConfig, path: string, options: AzureFetchOptions): Promise<Response> {
  const hasBody = options.body !== undefined
  try {
    return await fetch(buildUrl(config, path, options.query), {
      method: options.method ?? 'GET',
      headers: buildHeaders(config, hasBody),
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw errorFor(NETWORK_ERROR_STATUS)
  }
}

async function request<T>(config: AzureConfig, path: string, options: AzureFetchOptions = {}): Promise<AzureResponse<T>> {
  const response = await send(config, path, options)
  if (!response.ok) throw errorFor(response.status, await readErrorDetail(response))
  assertJsonResponse(response)
  return {
    data: (await response.json()) as T,
    continuationToken: response.headers.get('x-ms-continuationtoken'),
  }
}

/** Chamada única a https://dev.azure.com/{org}/{path}. */
export async function azureFetch<T>(config: AzureConfig, path: string, options?: AzureFetchOptions): Promise<T> {
  return (await request<T>(config, path, options)).data
}

/** Segue `x-ms-continuationtoken` até o fim, concatenando o `value` de cada página. */
export async function azureFetchAll<T>(config: AzureConfig, path: string, options: AzureFetchOptions = {}): Promise<T[]> {
  const items: T[] = []
  let continuationToken: string | null = null
  do {
    const page: AzureResponse<{ value: T[] }> = await request<{ value: T[] }>(config, path, {
      ...options,
      query: { ...options.query, continuationToken: continuationToken ?? undefined },
    })
    items.push(...(page.data.value ?? []))
    continuationToken = page.continuationToken
  } while (continuationToken)
  return items
}
