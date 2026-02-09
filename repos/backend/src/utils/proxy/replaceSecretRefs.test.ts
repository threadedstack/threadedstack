import { describe, it, expect } from 'vitest'
import { replaceSecretsInHeaders, replaceSecretsInObj } from './replaceSecretRefs'

const mockSecrets = [
  { name: `API_TOKEN`, hashKey: `api_token`, value: `abc123` },
  { name: `API_KEY`, hashKey: `api_key`, value: `xyz789` },
  { name: `CLIENT_SECRET`, hashKey: `client_secret`, value: `secret-val` },
] as any[]

describe(`replaceSecretsInHeaders`, () => {
  it(`should replace single secret reference in header value`, () => {
    const result = replaceSecretsInHeaders(
      { Authorization: `Bearer {{API_TOKEN}}` },
      mockSecrets
    )
    expect(result.Authorization).toBe(`Bearer abc123`)
  })

  it(`should replace multiple secret references across headers`, () => {
    const result = replaceSecretsInHeaders(
      { 'X-Key': `{{API_KEY}}`, 'X-Token': `{{API_TOKEN}}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`xyz789`)
    expect(result[`X-Token`]).toBe(`abc123`)
  })

  it(`should leave non-matching references unchanged`, () => {
    const result = replaceSecretsInHeaders({ 'X-Key': `{{UNKNOWN}}` }, mockSecrets)
    expect(result[`X-Key`]).toBe(`{{UNKNOWN}}`)
  })

  it(`should handle empty headers object`, () => {
    const result = replaceSecretsInHeaders({}, mockSecrets)
    expect(result).toEqual({})
  })

  it(`should return null when headers is null`, () => {
    expect(replaceSecretsInHeaders(null as any, mockSecrets)).toBeNull()
  })

  it(`should return undefined when headers is undefined`, () => {
    expect(replaceSecretsInHeaders(undefined as any, mockSecrets)).toBeUndefined()
  })

  it(`should handle empty secrets array`, () => {
    const result = replaceSecretsInHeaders({ Authorization: `Bearer {{API_TOKEN}}` }, [])
    expect(result.Authorization).toBe(`Bearer {{API_TOKEN}}`)
  })

  it(`should replace multiple references in a single header value`, () => {
    const result = replaceSecretsInHeaders(
      { Authorization: `{{API_KEY}}:{{CLIENT_SECRET}}` },
      mockSecrets
    )
    expect(result.Authorization).toBe(`xyz789:secret-val`)
  })
})

describe(`replaceSecretsInObj`, () => {
  it(`should replace secret refs in flat object`, () => {
    const result = replaceSecretsInObj(
      { clientId: `{{API_KEY}}`, scope: `read` },
      mockSecrets
    )
    expect(result.clientId).toBe(`xyz789`)
    expect(result.scope).toBe(`read`)
  })

  it(`should replace secret refs in nested objects`, () => {
    const result = replaceSecretsInObj({ auth: { token: `{{API_TOKEN}}` } }, mockSecrets)
    expect(result.auth.token).toBe(`abc123`)
  })

  it(`should replace secret refs in arrays`, () => {
    const result = replaceSecretsInObj(
      { tokens: [`{{API_TOKEN}}`, `{{API_KEY}}`] },
      mockSecrets
    )
    expect(result.tokens).toEqual([`abc123`, `xyz789`])
  })

  it(`should handle null values in object`, () => {
    const result = replaceSecretsInObj(
      { key: null, val: `{{API_TOKEN}}` } as any,
      mockSecrets
    )
    expect(result.key).toBeNull()
    expect(result.val).toBe(`abc123`)
  })

  it(`should handle non-string non-object values`, () => {
    const result = replaceSecretsInObj(
      { count: 42, flag: true, val: `{{API_TOKEN}}` } as any,
      mockSecrets
    )
    expect(result.count).toBe(42)
    expect(result.flag).toBe(true)
    expect(result.val).toBe(`abc123`)
  })

  it(`should return null input as-is`, () => {
    expect(replaceSecretsInObj(null as any, mockSecrets)).toBeNull()
  })

  it(`should return undefined input as-is`, () => {
    expect(replaceSecretsInObj(undefined as any, mockSecrets)).toBeUndefined()
  })

  it(`should handle deeply nested objects`, () => {
    const result = replaceSecretsInObj(
      { level1: { level2: { level3: `{{CLIENT_SECRET}}` } } },
      mockSecrets
    )
    expect(result.level1.level2.level3).toBe(`secret-val`)
  })

  it(`should handle arrays with mixed types`, () => {
    const result = replaceSecretsInObj(
      { items: [`{{API_TOKEN}}`, 42, true, null, { nested: `{{API_KEY}}` }] } as any,
      mockSecrets
    )
    expect(result.items[0]).toBe(`abc123`)
    expect(result.items[1]).toBe(42)
    expect(result.items[2]).toBe(true)
    expect(result.items[3]).toBeNull()
    expect(result.items[4].nested).toBe(`xyz789`)
  })

  it(`should fall back to hashKey when name is empty`, () => {
    const secretsWithHashKey = [
      { name: ``, hashKey: `fallback_key`, value: `fallback-val` },
    ] as any[]
    const result = replaceSecretsInObj({ key: `{{fallback_key}}` }, secretsWithHashKey)
    expect(result.key).toBe(`fallback-val`)
  })

  it(`should handle empty secrets array`, () => {
    const result = replaceSecretsInObj({ key: `{{API_KEY}}` }, [])
    expect(result.key).toBe(`{{API_KEY}}`)
  })
})
