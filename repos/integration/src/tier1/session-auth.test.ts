import { describe, test, expect } from 'vitest'
import { api } from '../utils/api-client'

describe('Tier 1: Session Token Auth', () => {

  test('POST /ai/stream without session token returns 401', async () => {
    const res = await api('/ai/stream', {
      method: 'POST',
      body: { context: { messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }, options: {} },
      noAuth: true,
      rawPath: true,
    })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /ai/stream with Bearer token (not Session) returns 401', async () => {
    const res = await api('/ai/stream', {
      method: 'POST',
      body: { context: { messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }, options: {} },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': 'Bearer tdsk_some_key' },
    })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /ai/stream with empty session token returns 401', async () => {
    const res = await api('/ai/stream', {
      method: 'POST',
      body: { context: { messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }, options: {} },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': 'Session ' },
    })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })

  test('POST /ai/stream with invalid session token returns 401', async () => {
    const res = await api('/ai/stream', {
      method: 'POST',
      body: { context: { messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] }, options: {} },
      rawPath: true,
      noAuth: true,
      headers: { 'Authorization': 'Session 00000000-0000-0000-0000-000000000000' },
    })

    expect(res.status).toBe(401)
    expect(res.ok).toBe(false)
  })
})
