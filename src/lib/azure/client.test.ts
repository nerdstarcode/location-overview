import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import { azureFetch, azureFetchAll, AzureApiError, NETWORK_ERROR_STATUS } from './client'

const config = { ...DEFAULT_AZURE_CONFIG, organization: 'minha-org', pat: 'abc' }

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...init.headers },
  })
}

function mockFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn()
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response)
    else fetchMock.mockResolvedValueOnce(response)
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function expectApiError(promise: Promise<unknown>, status: number) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AzureApiError)
  expect((error as AzureApiError).status).toBe(status)
}

afterEach(() => vi.unstubAllGlobals())

describe('azureFetch', () => {
  it('monta URL com api-version e autentica com o PAT em Basic', async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }))
    await azureFetch(config, '_apis/projects', { query: { $top: 10 } })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://dev.azure.com/minha-org/_apis/projects?%24top=10&api-version=7.1')
    expect(init.headers.Authorization).toBe(`Basic ${btoa(':abc')}`)
  })

  it('envia corpo JSON em POST', async () => {
    const fetchMock = mockFetch(jsonResponse({}))
    await azureFetch(config, 'x', { method: 'POST', body: { ids: [1] } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe('{"ids":[1]}')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('traduz status de erro em AzureApiError', async () => {
    mockFetch(jsonResponse({ message: 'nope' }, { status: 401 }))
    await expectApiError(azureFetch(config, 'x'), 401)
  })

  it('trata 203 + HTML (PAT inválido) como 401', async () => {
    mockFetch(new Response('<html>login</html>', { status: 203, headers: { 'content-type': 'text/html' } }))
    await expectApiError(azureFetch(config, 'x'), 401)
  })

  it('trata falha de rede/CORS com status próprio', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    await expectApiError(azureFetch(config, 'x'), NETWORK_ERROR_STATUS)
  })

  it('repassa o cancelamento sem converter em AzureApiError', async () => {
    mockFetch(new DOMException('aborted', 'AbortError'))
    await expect(azureFetch(config, 'x')).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('azureFetchAll', () => {
  it('segue o continuation token até a última página', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ value: [1, 2] }, { headers: { 'x-ms-continuationtoken': 'next' } }),
      jsonResponse({ value: [3] }),
    )
    expect(await azureFetchAll(config, '_apis/projects')).toEqual([1, 2, 3])
    expect(fetchMock.mock.calls[1][0]).toContain('continuationToken=next')
  })
})
