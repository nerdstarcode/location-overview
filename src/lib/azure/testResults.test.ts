import { describe, expect, it, vi } from 'vitest'
import { listTestRunResults } from './api'
import { DEFAULT_AZURE_CONFIG } from './azureConfigStorage'
import { azureFetch } from './client'

vi.mock('./client', () => ({ azureFetch: vi.fn(), azureFetchAll: vi.fn() }))

describe('listTestRunResults', () => {
  it('pagina com $top/$skip até uma página incompleta', async () => {
    const page = (size: number, offset: number) => ({ value: Array.from({ length: size }, (_, i) => ({ id: offset + i })) })
    vi.mocked(azureFetch).mockResolvedValueOnce(page(1000, 0)).mockResolvedValueOnce(page(3, 1000))

    const results = await listTestRunResults(DEFAULT_AZURE_CONFIG, 'Portal', 7)

    expect(results).toHaveLength(1003)
    expect(vi.mocked(azureFetch).mock.calls.map(([, path, options]) => [path, options?.query])).toEqual([
      ['Portal/_apis/test/Runs/7/results', { $top: 1000, $skip: 0 }],
      ['Portal/_apis/test/Runs/7/results', { $top: 1000, $skip: 1000 }],
    ])
  })
})
