import { describe, it, expect } from 'vitest'
import { toFriendlyError, classifyApiError } from '@TSA/constants/errors'

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

describe('classifyApiError', () => {
  it('classifies ECONNREFUSED as network', () => {
    const err = Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' })
    expect(classifyApiError(err)).toBe('network')
  })

  it('classifies ETIMEDOUT as network', () => {
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
    expect(classifyApiError(err)).toBe('network')
  })

  it('classifies ENOTFOUND as network', () => {
    const err = Object.assign(new Error('dns'), { code: 'ENOTFOUND' })
    expect(classifyApiError(err)).toBe('network')
  })

  it('classifies 401 as auth', () => {
    expect(classifyApiError(new Error('API error (401): Unauthorized'))).toBe('auth')
  })

  it('classifies 403 as forbidden', () => {
    expect(classifyApiError(new Error('API error (403): Forbidden'))).toBe('forbidden')
  })

  it('classifies "Not logged in" as auth', () => {
    expect(classifyApiError(new Error('Not logged in. Run "tsa login" first.'))).toBe(
      'auth'
    )
  })

  it('classifies 404 as notFound', () => {
    expect(classifyApiError(new Error('API error (404): Not Found'))).toBe('notFound')
  })

  it('classifies 400 as data', () => {
    expect(classifyApiError(new Error('API error (400): Bad Request'))).toBe('data')
  })

  it('classifies 422 as data', () => {
    expect(classifyApiError(new Error('API error (422): Unprocessable'))).toBe('data')
  })

  it('classifies 500 as server', () => {
    expect(classifyApiError(new Error('API error (500): Internal'))).toBe('server')
  })

  it('classifies 429 as server', () => {
    expect(classifyApiError(new Error('API error (429): Too Many'))).toBe('server')
  })

  it('classifies 502 as server', () => {
    expect(classifyApiError(new Error('API error (502): Bad Gateway'))).toBe('server')
  })

  it('classifies 503 as server', () => {
    expect(classifyApiError(new Error('API error (503): Service Unavailable'))).toBe(
      'server'
    )
  })

  it('classifies unknown errors as unknown', () => {
    expect(classifyApiError(new Error('something weird'))).toBe('unknown')
  })

  it('classifies non-Error values as unknown', () => {
    expect(classifyApiError('string error')).toBe('unknown')
    expect(classifyApiError(null)).toBe('unknown')
    expect(classifyApiError(42)).toBe('unknown')
  })

  it('classifies Exception with status 401 as auth', () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 })
    expect(classifyApiError(err)).toBe('auth')
  })

  it('classifies Exception with status 403 as forbidden', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 })
    expect(classifyApiError(err)).toBe('forbidden')
  })

  it('classifies Exception with status 404 as notFound', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 })
    expect(classifyApiError(err)).toBe('notFound')
  })

  it('classifies Exception with status 400 as data', () => {
    const err = Object.assign(new Error('Bad Request'), { status: 400 })
    expect(classifyApiError(err)).toBe('data')
  })

  it('classifies Exception with status 422 as data', () => {
    const err = Object.assign(new Error('Unprocessable'), { status: 422 })
    expect(classifyApiError(err)).toBe('data')
  })

  it('classifies Exception with status 500 as server', () => {
    const err = Object.assign(new Error('Internal Server Error'), { status: 500 })
    expect(classifyApiError(err)).toBe('server')
  })

  it('classifies Exception with status 429 as server', () => {
    const err = Object.assign(new Error('Too Many Requests'), { status: 429 })
    expect(classifyApiError(err)).toBe('server')
  })
})
