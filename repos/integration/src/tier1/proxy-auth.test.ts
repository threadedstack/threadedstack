import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

describe('Tier 1: Proxy Auth', () => {
  const ctx = readContext()

  test('GET /orgs with valid API key returns 200', async () => {
    const res = await get('/orgs', { apiKey: ctx.apiKey })

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('GET /orgs without API key returns 401', async () => {
    const res = await get('/orgs', { noAuth: true })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('GET /orgs with invalid API key returns 401', async () => {
    const res = await get('/orgs', { apiKey: 'tdsk_invalidkey' })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})
