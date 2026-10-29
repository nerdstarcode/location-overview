import { describe, expect, it } from 'vitest'
import { canShowQaPersonMetrics, isLocalhost } from './featureFlags'

describe('featureFlags', () => {
  it('reconhece só os hosts locais', () => {
    for (const host of ['localhost', '127.0.0.1', '::1', '[::1]']) expect(isLocalhost(host)).toBe(true)
    for (const host of ['alocation.example.com', 'localhost.example.com', '192.168.0.10', '']) expect(isLocalhost(host)).toBe(false)
  })

  it('visão QA das métricas individuais só em localhost', () => {
    expect(canShowQaPersonMetrics('localhost')).toBe(true)
    expect(canShowQaPersonMetrics('alocation.example.com')).toBe(false)
  })
})
