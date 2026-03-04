import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { TRequest } from '@TBE/types'

import { parseJsonBody } from './parseJsonBody'

/**
 * Creates a mock request that emits data/end/error events like a readable stream.
 * Uses Object.assign to preserve EventEmitter prototype methods (on, emit, etc.).
 */
const createMockStreamReq = (overrides: Record<string, any> = {}) => {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    body: undefined,
    headers: { 'content-type': `application/json` },
    ...overrides,
  }) as unknown as TRequest & EventEmitter
}

describe(`parseJsonBody`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return existing req.body when already defined`, async () => {
    const existingBody = { foo: `bar` }
    const req = createMockStreamReq({ body: existingBody })

    const result = await parseJsonBody(req)

    expect(result).toEqual(existingBody)
  })

  it(`should return existing req.body even if it is an empty string`, async () => {
    const req = createMockStreamReq({ body: `` })

    const result = await parseJsonBody(req)

    expect(result).toBe(``)
  })

  it(`should return existing req.body when body is 0`, async () => {
    const req = createMockStreamReq({ body: 0 })

    const result = await parseJsonBody(req)

    expect(result).toBe(0)
  })

  it(`should return empty object when content-type is not application/json`, async () => {
    const req = createMockStreamReq({
      headers: { 'content-type': `text/plain` },
    })

    const result = await parseJsonBody(req)

    expect(result).toEqual({})
  })

  it(`should return empty object when content-type header is missing`, async () => {
    const req = createMockStreamReq({
      headers: {},
    })

    const result = await parseJsonBody(req)

    expect(result).toEqual({})
  })

  it(`should parse valid JSON body from stream`, async () => {
    const req = createMockStreamReq()

    const promise = parseJsonBody(req)

    // Simulate streaming chunks
    req.emit(`data`, Buffer.from(`{"key":`))
    req.emit(`data`, Buffer.from(`"value"}`))
    req.emit(`end`)

    const result = await promise

    expect(result).toEqual({ key: `value` })
  })

  it(`should handle single data chunk`, async () => {
    const req = createMockStreamReq()

    const promise = parseJsonBody(req)

    req.emit(`data`, Buffer.from(`{"name":"test","count":42}`))
    req.emit(`end`)

    const result = await promise

    expect(result).toEqual({ name: `test`, count: 42 })
  })

  it(`should return empty object on empty body stream`, async () => {
    const req = createMockStreamReq()

    const promise = parseJsonBody(req)

    req.emit(`end`)

    const result = await promise

    expect(result).toEqual({})
  })

  it(`should throw Exception(400) on invalid JSON`, async () => {
    const req = createMockStreamReq()

    const promise = parseJsonBody(req)

    req.emit(`data`, Buffer.from(`{invalid json`))
    req.emit(`end`)

    await expect(promise).rejects.toThrow(`Invalid JSON in request body`)
  })

  it(`should reject when stream emits error`, async () => {
    const req = createMockStreamReq()

    const promise = parseJsonBody(req)

    req.emit(`error`, new Error(`Stream read error`))

    await expect(promise).rejects.toThrow(`Failed to read request body`)
  })

  it(`should handle content-type with charset parameter`, async () => {
    const req = createMockStreamReq({
      headers: { 'content-type': `application/json; charset=utf-8` },
    })

    const promise = parseJsonBody(req)

    req.emit(`data`, Buffer.from(`{"ok":true}`))
    req.emit(`end`)

    const result = await promise

    expect(result).toEqual({ ok: true })
  })

  it(`should parse JSON array bodies`, async () => {
    const req = createMockStreamReq()

    const promise = parseJsonBody(req)

    req.emit(`data`, Buffer.from(`[1, 2, 3]`))
    req.emit(`end`)

    const result = await promise

    expect(result).toEqual([1, 2, 3])
  })
})
