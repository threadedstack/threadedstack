import { describe, it, expect } from 'vitest'
import { toFriendlyError } from '@TRL/constants/errors'

describe('toFriendlyError', () => {
  it('maps ECONNREFUSED to network error', () => {
    const err = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' })
    const result = toFriendlyError(err)
    expect(result.message).toContain("Can't reach the server")
  })

  it('maps 401 to auth error', () => {
    const err = new Error('API error (401): Unauthorized')
    const result = toFriendlyError(err)
    expect(result.message).toContain('session has expired')
  })

  it('maps 429 to rate limit', () => {
    const err = new Error('API error (429): Too Many Requests')
    const result = toFriendlyError(err)
    expect(result.message).toContain('service is busy')
  })

  it('returns fallback for unknown errors', () => {
    const err = new Error('something weird')
    const result = toFriendlyError(err)
    expect(result.message).toContain('unexpected')
    expect(result.suggestion).toBeDefined()
  })
})
