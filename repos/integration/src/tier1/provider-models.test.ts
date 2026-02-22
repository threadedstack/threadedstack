import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

describe('Tier 1: Provider Model Fetching', () => {
  test('POST /providers/anthropic/models returns static models', async () => {
    const res = await post<{ data: { id: string; name: string }[] }>(
      `/providers/anthropic/models`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(res.data.data.length).toBeGreaterThan(0)
    expect(res.data.data[0]).toHaveProperty('id')
    expect(res.data.data[0]).toHaveProperty('name')
  })

  test('POST /providers/openai/models returns static models (no provider key)', async () => {
    const res = await post<{ data: { id: string; name: string }[] }>(
      `/providers/openai/models`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.length).toBeGreaterThan(0)
  })

  test('POST /providers/google/models returns static models (no provider key)', async () => {
    const res = await post<{ data: { id: string; name: string }[] }>(
      `/providers/google/models`
    )

    expect(res.status).toBe(200)
    expect(res.data.data.length).toBeGreaterThan(0)
  })

  test('POST /providers/openrouter/models returns models (dynamic or static fallback)', async () => {
    const res = await post<{ data: { id: string; name: string }[] }>(
      `/providers/openrouter/models`
    )

    // Always 200 — dynamic from OpenRouter API, or static fallback if API is down
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.data)).toBe(true)
    expect(res.data.data.length).toBeGreaterThan(0)
    expect(res.data.data[0]).toHaveProperty('id')
    expect(res.data.data[0]).toHaveProperty('name')
  })

  test('POST /providers/ollama/models returns models or connection error', async () => {
    const res = await post<{ data: any }>(
      `/providers/ollama/models`
    )

    // Ollama may not be running in CI — accept both 200 and 502
    expect([200, 502]).toContain(res.status)

    if (res.status === 200) {
      expect(Array.isArray(res.data.data)).toBe(true)
    }
  })

  test('POST /providers/custom/models returns empty array', async () => {
    const res = await post<{ data: any[] }>(
      `/providers/custom/models`
    )

    expect(res.status).toBe(200)
    expect(res.data.data).toEqual([])
  })

  test('POST /providers/invalid/models returns 400', async () => {
    const res = await post<{ data: any }>(
      `/providers/invalid/models`
    )

    expect(res.status).toBe(400)
  })

  test('POST /providers/ollama/models with baseUrl accepts custom base URL', async () => {
    const res = await post<{ data: any }>(
      `/providers/ollama/models`,
      { baseUrl: 'http://localhost:11434/v1' }
    )

    // Accept both 200 (Ollama running) and 502 (not running)
    expect([200, 502]).toContain(res.status)
  })
})
