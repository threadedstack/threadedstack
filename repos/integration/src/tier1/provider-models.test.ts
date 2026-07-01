import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Provider Model Fetching (org-scoped)', () => {
  const { orgId } = readContext()
  const path = (brand: string) => `/orgs/${orgId}/providers/${brand}/models`

  test('POST /orgs/:orgId/providers/anthropic/models returns static models', async () => {
    const res = await post<{ id: string; name: string }[]>(path('anthropic'))

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0]).toHaveProperty('id')
    expect(res.data[0]).toHaveProperty('name')
  })

  test('POST /orgs/:orgId/providers/openai/models returns static models', async () => {
    const res = await post<{ id: string; name: string }[]>(path('openai'))

    expect(res.status).toBe(200)
    expect(res.data.length).toBeGreaterThan(0)
  })

  test('POST /orgs/:orgId/providers/google/models returns static models', async () => {
    const res = await post<{ id: string; name: string }[]>(path('google'))

    expect(res.status).toBe(200)
    expect(res.data.length).toBeGreaterThan(0)
  })

  test('POST /orgs/:orgId/providers/openrouter/models returns models', async () => {
    const res = await post<{ id: string; name: string }[]>(path('openrouter'))

    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data[0]).toHaveProperty('id')
    expect(res.data[0]).toHaveProperty('name')
  })

  test('POST /orgs/:orgId/providers/ollama/models returns models or connection error', async () => {
    const res = await post<any>(path('ollama'))

    expect([200, 502]).toContain(res.status)

    if (res.status === 200) {
      expect(Array.isArray(res.data)).toBe(true)
    }
  })

  test('POST /orgs/:orgId/providers/custom/models returns empty array', async () => {
    const res = await post<any[]>(path('custom'))

    expect(res.status).toBe(200)
    expect(res.data).toEqual([])
  })

  test('POST /orgs/:orgId/providers/invalid/models returns 400', async () => {
    const res = await post<any>(path('invalid'))

    expect(res.status).toBe(400)
  })

  test('POST /orgs/:orgId/providers/ollama/models with baseUrl accepts custom base URL', async () => {
    const res = await post<any>(path('ollama'), {
      baseUrl: 'http://localhost:11434/v1',
    })

    expect([200, 502]).toContain(res.status)
  })

  // Regression: the old root mount was removed; the legacy URL must now 404.
  test('POST /providers/:brand/models (legacy root mount) is removed (404)', async () => {
    const res = await post<any>('/providers/openai/models')

    expect(res.status).toBe(404)
  })
})
