import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    decryptValue: vi.fn().mockResolvedValue(`decrypted-secret-value`),
  }
})

import { SecretResolver } from './secretResolver'

// ── SecretResolver.replaceInHeaders ───────────────────────────────────

const mockSecrets = [
  { name: `API_TOKEN`, hashKey: `api_token`, value: `abc123` },
  { name: `API_KEY`, hashKey: `api_key`, value: `xyz789` },
  { name: `CLIENT_SECRET`, hashKey: `client_secret`, value: `secret-val` },
] as any[]

describe(`SecretResolver.replaceInHeaders`, () => {
  it(`should replace single secret reference in header value`, () => {
    const result = SecretResolver.replaceInHeaders(
      { Authorization: `Bearer {{API_TOKEN}}` },
      mockSecrets
    )
    expect(result.Authorization).toBe(`Bearer abc123`)
  })

  it(`should replace multiple secret references across headers`, () => {
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{API_KEY}}`, 'X-Token': `{{API_TOKEN}}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`xyz789`)
    expect(result[`X-Token`]).toBe(`abc123`)
  })

  it(`should leave non-matching references unchanged`, () => {
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{UNKNOWN}}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`{{UNKNOWN}}`)
  })

  it(`should handle empty headers object`, () => {
    const result = SecretResolver.replaceInHeaders({}, mockSecrets)
    expect(result).toEqual({})
  })

  it(`should return null when headers is null`, () => {
    expect(SecretResolver.replaceInHeaders(null as any, mockSecrets)).toBeNull()
  })

  it(`should return undefined when headers is undefined`, () => {
    expect(SecretResolver.replaceInHeaders(undefined as any, mockSecrets)).toBeUndefined()
  })

  it(`should handle empty secrets array`, () => {
    const result = SecretResolver.replaceInHeaders(
      { Authorization: `Bearer {{API_TOKEN}}` },
      []
    )
    expect(result.Authorization).toBe(`Bearer {{API_TOKEN}}`)
  })

  it(`should replace multiple references in a single header value`, () => {
    const result = SecretResolver.replaceInHeaders(
      { Authorization: `{{API_KEY}}:{{CLIENT_SECRET}}` },
      mockSecrets
    )
    expect(result.Authorization).toBe(`xyz789:secret-val`)
  })
})

// ── SecretResolver.replaceInObj ───────────────────────────────────────

describe(`SecretResolver.replaceInObj`, () => {
  it(`should replace secret refs in flat object`, () => {
    const result = SecretResolver.replaceInObj(
      { clientId: `{{API_KEY}}`, scope: `read` },
      mockSecrets
    )
    expect(result.clientId).toBe(`xyz789`)
    expect(result.scope).toBe(`read`)
  })

  it(`should replace secret refs in nested objects`, () => {
    const result = SecretResolver.replaceInObj(
      { auth: { token: `{{API_TOKEN}}` } },
      mockSecrets
    )
    expect(result.auth.token).toBe(`abc123`)
  })

  it(`should replace secret refs in arrays`, () => {
    const result = SecretResolver.replaceInObj(
      { tokens: [`{{API_TOKEN}}`, `{{API_KEY}}`] },
      mockSecrets
    )
    expect(result.tokens).toEqual([`abc123`, `xyz789`])
  })

  it(`should handle null values in object`, () => {
    const result = SecretResolver.replaceInObj(
      { key: null, val: `{{API_TOKEN}}` } as any,
      mockSecrets
    )
    expect(result.key).toBeNull()
    expect(result.val).toBe(`abc123`)
  })

  it(`should handle non-string non-object values`, () => {
    const result = SecretResolver.replaceInObj(
      { count: 42, flag: true, val: `{{API_TOKEN}}` } as any,
      mockSecrets
    )
    expect(result.count).toBe(42)
    expect(result.flag).toBe(true)
    expect(result.val).toBe(`abc123`)
  })

  it(`should return null input as-is`, () => {
    expect(SecretResolver.replaceInObj(null as any, mockSecrets)).toBeNull()
  })

  it(`should return undefined input as-is`, () => {
    expect(SecretResolver.replaceInObj(undefined as any, mockSecrets)).toBeUndefined()
  })

  it(`should handle deeply nested objects`, () => {
    const result = SecretResolver.replaceInObj(
      { level1: { level2: { level3: `{{CLIENT_SECRET}}` } } },
      mockSecrets
    )
    expect(result.level1.level2.level3).toBe(`secret-val`)
  })

  it(`should handle arrays with mixed types`, () => {
    const result = SecretResolver.replaceInObj(
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
    const result = SecretResolver.replaceInObj(
      { key: `{{fallback_key}}` },
      secretsWithHashKey
    )
    expect(result.key).toBe(`fallback-val`)
  })

  it(`should handle empty secrets array`, () => {
    const result = SecretResolver.replaceInObj({ key: `{{API_KEY}}` }, [])
    expect(result.key).toBe(`{{API_KEY}}`)
  })
})

// ── SecretResolver#resolveBodyParams ──────────────────────────────

const fakeEncrypted = () =>
  Buffer.concat([
    Buffer.alloc(12, `iv`),
    Buffer.alloc(16, `tag`),
    Buffer.from(`ciphertext`),
  ]).toString(`base64`)

const createMockDb = (providerSecrets: any[] = [], orgSecrets: any[] = []) => ({
  services: {
    secret: {
      list: vi.fn().mockImplementation((opts: any) => {
        if (opts.where.providerId) return Promise.resolve({ data: providerSecrets })
        if (opts.where.orgId) return Promise.resolve({ data: orgSecrets })
        return Promise.resolve({ data: [] })
      }),
    },
  },
})

describe(`SecretResolver#resolveBodyParams`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return undefined when bodyParams is undefined`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const result = await resolver.resolveBodyParams({ id: `prov-1`, orgId: `org-1` })
    expect(result).toBeUndefined()
  })

  it(`should return undefined when bodyParams is empty object`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const result = await resolver.resolveBodyParams({
      id: `prov-1`,
      orgId: `org-1`,
      bodyParams: {},
    })
    expect(result).toBeUndefined()
  })

  it(`should return bodyParams as-is when no {{...}} templates`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const bodyParams = { top_p: 0.9, seed: 42, custom: `static-value` }
    const result = await resolver.resolveBodyParams({
      id: `prov-1`,
      orgId: `org-1`,
      bodyParams,
    })
    expect(result).toEqual(bodyParams)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should return bodyParams as-is when only non-string values`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const bodyParams = { top_p: 0.9, seed: 42, enabled: true }
    const result = await resolver.resolveBodyParams({
      id: `prov-1`,
      orgId: `org-1`,
      bodyParams,
    })
    expect(result).toEqual(bodyParams)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should resolve {{SECRET_NAME}} with provider-scoped secrets`, async () => {
    const providerSecrets = [
      {
        name: `API_TOKEN`,
        encryptedValue: fakeEncrypted(),
        providerId: `prov-1`,
      },
    ]
    const db = createMockDb(providerSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveBodyParams({
      id: `prov-1`,
      orgId: `org-1`,
      bodyParams: { token: `{{API_TOKEN}}`, top_p: 0.9 },
    })

    expect(result).toEqual({
      token: `decrypted-secret-value`,
      top_p: 0.9,
    })
  })

  it(`should fall back to org-scoped secrets`, async () => {
    const orgSecrets = [
      {
        name: `ORG_KEY`,
        encryptedValue: fakeEncrypted(),
        orgId: `org-1`,
      },
    ]
    const db = createMockDb([], orgSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveBodyParams({
      id: `prov-1`,
      orgId: `org-1`,
      bodyParams: { key: `{{ORG_KEY}}` },
    })

    expect(result).toEqual({
      key: `decrypted-secret-value`,
    })
  })

  it(`should leave non-string values untouched`, async () => {
    const providerSecrets = [
      {
        name: `SECRET`,
        encryptedValue: fakeEncrypted(),
        providerId: `prov-1`,
      },
    ]
    const db = createMockDb(providerSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveBodyParams({
      id: `prov-1`,
      orgId: `org-1`,
      bodyParams: {
        ref: `{{SECRET}}`,
        count: 42,
        flag: true,
        nested: { key: `value` },
      },
    })

    expect(result).toEqual({
      ref: `decrypted-secret-value`,
      count: 42,
      flag: true,
      nested: { key: `value` },
    })
  })
})

// ── SecretResolver#resolveHeaders ──────────────────────────────

describe(`SecretResolver#resolveHeaders`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return undefined when headers is undefined`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const result = await resolver.resolveHeaders({ id: `prov-1`, orgId: `org-1` })
    expect(result).toBeUndefined()
  })

  it(`should return undefined when headers is empty object`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: {},
    })
    expect(result).toBeUndefined()
  })

  it(`should return headers as-is when no {{...}} templates`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const headers = { 'X-Custom': `static-value`, Authorization: `Bearer my-token` }
    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers,
    })
    expect(result).toEqual(headers)
    // Should NOT query DB
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should resolve {{SECRET_NAME}} with provider-scoped secrets`, async () => {
    const providerSecrets = [
      {
        name: `API_TOKEN`,
        encryptedValue: fakeEncrypted(),
        providerId: `prov-1`,
      },
    ]
    const db = createMockDb(providerSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: { Authorization: `Bearer {{API_TOKEN}}` },
    })

    expect(result).toEqual({
      Authorization: `Bearer decrypted-secret-value`,
    })
  })

  it(`should fall back to org-scoped secrets`, async () => {
    const orgSecrets = [
      {
        name: `ORG_KEY`,
        encryptedValue: fakeEncrypted(),
        orgId: `org-1`,
      },
    ]
    const db = createMockDb([], orgSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: { 'X-API-Key': `{{ORG_KEY}}` },
    })

    expect(result).toEqual({
      'X-API-Key': `decrypted-secret-value`,
    })
  })

  it(`should prefer provider-scoped over org-scoped secrets with same name`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>

    // Provider secret decrypts to "provider-value"
    mockDecrypt.mockResolvedValueOnce(`provider-value`)

    const providerSecrets = [
      { name: `SHARED_KEY`, encryptedValue: fakeEncrypted(), providerId: `prov-1` },
    ]
    const orgSecrets = [
      { name: `SHARED_KEY`, encryptedValue: fakeEncrypted(), orgId: `org-1` },
    ]
    const db = createMockDb(providerSecrets, orgSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: { 'X-Key': `{{SHARED_KEY}}` },
    })

    expect(result).toEqual({
      'X-Key': `provider-value`,
    })
    // Only one secret decrypted (provider-scoped wins, org-scoped skipped by seen set)
    expect(mockDecrypt).toHaveBeenCalledTimes(1)
  })

  it(`should leave unmatched {{UNKNOWN}} unchanged`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: { 'X-Key': `{{UNKNOWN_SECRET}}` },
    })

    expect(result).toEqual({
      'X-Key': `{{UNKNOWN_SECRET}}`,
    })
  })

  it(`should resolve multiple templates in different headers`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>
    mockDecrypt.mockResolvedValue(`secret-val`)

    const providerSecrets = [
      { name: `TOKEN_A`, encryptedValue: fakeEncrypted(), providerId: `prov-1` },
      { name: `TOKEN_B`, encryptedValue: fakeEncrypted(), providerId: `prov-1` },
    ]
    const db = createMockDb(providerSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: {
        Authorization: `Bearer {{TOKEN_A}}`,
        'X-Custom': `{{TOKEN_B}}`,
        'X-Static': `no-template`,
      },
    })

    expect(result).toEqual({
      Authorization: `Bearer secret-val`,
      'X-Custom': `secret-val`,
      'X-Static': `no-template`,
    })
  })

  it(`should query both provider and org secrets`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)

    await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: { 'X-Key': `{{SOME_SECRET}}` },
    })

    expect(db.services.secret.list).toHaveBeenCalledWith({
      where: { providerId: `prov-1` },
    })
    expect(db.services.secret.list).toHaveBeenCalledWith({
      where: { orgId: `org-1` },
    })
  })
})
