import { logger } from '@TBE/utils/logger'
import { SecretResolver } from './secretResolver'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@TBE/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    decryptValue: vi.fn().mockResolvedValue(`decrypted-secret-value`),
  }
})

// ── Mock secrets with 10-char nanoid IDs ─────────────────────────────

const mockSecrets = [
  { id: `aaaaaaaaaa`, name: `API_TOKEN`, hashKey: `api_token`, value: `abc123` },
  { id: `bbbbbbbbbb`, name: `API_KEY`, hashKey: `api_key`, value: `xyz789` },
  {
    id: `cccccccccc`,
    name: `CLIENT_SECRET`,
    hashKey: `client_secret`,
    value: `secret-val`,
  },
] as any[]

// ── SecretResolver.replaceInHeaders ───────────────────────────────────

describe(`SecretResolver.replaceInHeaders`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should replace single {{ name:id }} reference in header value`, () => {
    const result = SecretResolver.replaceInHeaders(
      { Authorization: `Bearer {{API_TOKEN:aaaaaaaaaa}}` },
      mockSecrets
    )
    expect(result.Authorization).toBe(`Bearer abc123`)
  })

  it(`should replace multiple {{ name:id }} references across headers`, () => {
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{API_KEY:bbbbbbbbbb}}`, 'X-Token': `{{API_TOKEN:aaaaaaaaaa}}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`xyz789`)
    expect(result[`X-Token`]).toBe(`abc123`)
  })

  it(`should leave non-matching references unchanged`, () => {
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{UNKNOWN:zzzzzzzzzz}}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`{{UNKNOWN:zzzzzzzzzz}}`)
  })

  it(`should leave old-format {{ name }} references unchanged`, () => {
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{API_TOKEN}}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`{{API_TOKEN}}`)
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
      { Authorization: `Bearer {{API_TOKEN:aaaaaaaaaa}}` },
      []
    )
    expect(result.Authorization).toBe(`Bearer {{API_TOKEN:aaaaaaaaaa}}`)
  })

  it(`should replace multiple references in a single header value`, () => {
    const result = SecretResolver.replaceInHeaders(
      { Authorization: `{{API_KEY:bbbbbbbbbb}}:{{CLIENT_SECRET:cccccccccc}}` },
      mockSecrets
    )
    expect(result.Authorization).toBe(`xyz789:secret-val`)
  })

  it(`should resolve by ID even when names are duplicated`, () => {
    const dupeSecrets = [
      { id: `aaaaaaaaaa`, name: `SAME_NAME`, value: `first-value` },
      { id: `bbbbbbbbbb`, name: `SAME_NAME`, value: `second-value` },
    ] as any[]
    const result = SecretResolver.replaceInHeaders(
      {
        'X-First': `{{SAME_NAME:aaaaaaaaaa}}`,
        'X-Second': `{{SAME_NAME:bbbbbbbbbb}}`,
      },
      dupeSecrets
    )
    expect(result[`X-First`]).toBe(`first-value`)
    expect(result[`X-Second`]).toBe(`second-value`)
  })

  it(`should handle colons in secret names`, () => {
    const colonSecrets = [
      { id: `dddddddddd`, name: `my:secret:name`, value: `colon-val` },
    ] as any[]
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{my:secret:name:dddddddddd}}` },
      colonSecrets
    )
    expect(result[`X-Key`]).toBe(`colon-val`)
  })

  it(`should handle whitespace around name:id`, () => {
    const result = SecretResolver.replaceInHeaders(
      { 'X-Key': `{{  API_TOKEN:aaaaaaaaaa  }}` },
      mockSecrets
    )
    expect(result[`X-Key`]).toBe(`abc123`)
  })
})

// ── SecretResolver.replaceInObj ───────────────────────────────────────

describe(`SecretResolver.replaceInObj`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should replace secret refs in flat object`, () => {
    const result = SecretResolver.replaceInObj(
      { clientId: `{{API_KEY:bbbbbbbbbb}}`, scope: `read` },
      mockSecrets
    )
    expect(result.clientId).toBe(`xyz789`)
    expect(result.scope).toBe(`read`)
  })

  it(`should replace secret refs in nested objects`, () => {
    const result = SecretResolver.replaceInObj(
      { auth: { token: `{{API_TOKEN:aaaaaaaaaa}}` } },
      mockSecrets
    )
    expect(result.auth.token).toBe(`abc123`)
  })

  it(`should replace secret refs in arrays`, () => {
    const result = SecretResolver.replaceInObj(
      { tokens: [`{{API_TOKEN:aaaaaaaaaa}}`, `{{API_KEY:bbbbbbbbbb}}`] },
      mockSecrets
    )
    expect(result.tokens).toEqual([`abc123`, `xyz789`])
  })

  it(`should handle null values in object`, () => {
    const result = SecretResolver.replaceInObj(
      { key: null, val: `{{API_TOKEN:aaaaaaaaaa}}` } as any,
      mockSecrets
    )
    expect(result.key).toBeNull()
    expect(result.val).toBe(`abc123`)
  })

  it(`should handle non-string non-object values`, () => {
    const result = SecretResolver.replaceInObj(
      { count: 42, flag: true, val: `{{API_TOKEN:aaaaaaaaaa}}` } as any,
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
      { level1: { level2: { level3: `{{CLIENT_SECRET:cccccccccc}}` } } },
      mockSecrets
    )
    expect(result.level1.level2.level3).toBe(`secret-val`)
  })

  it(`should handle arrays with mixed types`, () => {
    const result = SecretResolver.replaceInObj(
      {
        items: [
          `{{API_TOKEN:aaaaaaaaaa}}`,
          42,
          true,
          null,
          { nested: `{{API_KEY:bbbbbbbbbb}}` },
        ],
      } as any,
      mockSecrets
    )
    expect(result.items[0]).toBe(`abc123`)
    expect(result.items[1]).toBe(42)
    expect(result.items[2]).toBe(true)
    expect(result.items[3]).toBeNull()
    expect(result.items[4].nested).toBe(`xyz789`)
  })

  it(`should handle empty secrets array`, () => {
    const result = SecretResolver.replaceInObj({ key: `{{API_KEY:bbbbbbbbbb}}` }, [])
    expect(result.key).toBe(`{{API_KEY:bbbbbbbbbb}}`)
  })

  it(`should not resolve old-format {{ name }} without ID`, () => {
    const result = SecretResolver.replaceInObj({ key: `{{API_KEY}}` }, mockSecrets)
    expect(result.key).toBe(`{{API_KEY}}`)
  })

  it(`should not match IDs shorter than 10 chars`, () => {
    const result = SecretResolver.replaceInObj({ key: `{{API_KEY:short}}` }, mockSecrets)
    expect(result.key).toBe(`{{API_KEY:short}}`)
  })

  it(`should not match IDs longer than 10 chars`, () => {
    const result = SecretResolver.replaceInObj(
      { key: `{{API_KEY:toolongvalue1}}` },
      mockSecrets
    )
    expect(result.key).toBe(`{{API_KEY:toolongvalue1}}`)
  })
})

// ── SecretResolver#resolveApiKey ──────────────────────────────────

describe(`SecretResolver#resolveApiKey`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should resolve via direct secretId lookup (Tier 0)`, async () => {
    const db = createMockDb()
    ;(db.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { encryptedValue: fakeEncrypted(), orgId: `org-1` },
    })
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey(
      { orgId: `org-1` },
      { id: `prov-1`, secretId: `secret-direct` }
    )

    expect(result).toBe(`decrypted-secret-value`)
    expect(db.services.secret.get).toHaveBeenCalledWith(`secret-direct`)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should return empty string when provider has no secretId`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey({ orgId: `org-1` }, { id: `prov-1` })

    expect(result).toBe(``)
    expect(db.services.secret.get).not.toHaveBeenCalled()
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should return empty string when secretId lookup returns no data`, async () => {
    const db = createMockDb()
    ;(db.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
    })
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey(
      { orgId: `org-1` },
      { id: `prov-1`, secretId: `secret-missing` }
    )

    expect(result).toBe(``)
    expect(db.services.secret.get).toHaveBeenCalledWith(`secret-missing`)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should return empty string when direct secret decryption fails`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>
    mockDecrypt.mockResolvedValueOnce(null)

    const db = createMockDb()
    ;(db.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { encryptedValue: fakeEncrypted(), orgId: `org-1` },
    })
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey(
      { orgId: `org-1` },
      { id: `prov-1`, secretId: `secret-broken` }
    )

    expect(result).toBe(``)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should return empty string when no secrets found anywhere`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveApiKey({ orgId: `org-1` }, { id: `prov-1` })

    expect(result).toBe(``)
  })
})

// ── Helpers ──────────────────────────────────────────────────────────

const fakeEncrypted = () =>
  Buffer.concat([
    Buffer.alloc(12, `iv`),
    Buffer.alloc(16, `tag`),
    Buffer.from(`ciphertext`),
  ]).toString(`base64`)

const createMockDb = (providerSecrets: any[] = [], orgSecrets: any[] = []) => ({
  services: {
    secret: {
      get: vi.fn().mockResolvedValue({ data: null }),
      list: vi.fn().mockImplementation((opts: any) => {
        if (opts.where.providerId) return Promise.resolve({ data: providerSecrets })
        if (opts.where.orgId) return Promise.resolve({ data: orgSecrets })
        return Promise.resolve({ data: [] })
      }),
    },
  },
})

// ── SecretResolver#resolveBodyParams ──────────────────────────────

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

  it(`should return bodyParams as-is when no {{ name:id }} templates`, async () => {
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

  it(`should resolve {{ name:id }} with provider-scoped secrets`, async () => {
    const providerSecrets = [
      {
        id: `aaaaaaaaaa`,
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
      bodyParams: { token: `{{API_TOKEN:aaaaaaaaaa}}`, top_p: 0.9 },
    })

    expect(result).toEqual({
      token: `decrypted-secret-value`,
      top_p: 0.9,
    })
  })

  it(`should fall back to org-scoped secrets`, async () => {
    const orgSecrets = [
      {
        id: `eeeeeeeeee`,
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
      bodyParams: { key: `{{ORG_KEY:eeeeeeeeee}}` },
    })

    expect(result).toEqual({
      key: `decrypted-secret-value`,
    })
  })

  it(`should leave non-string values untouched`, async () => {
    const providerSecrets = [
      {
        id: `ffffffffff`,
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
        ref: `{{SECRET:ffffffffff}}`,
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

  it(`should return headers as-is when no {{ name:id }} templates`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)
    const headers = { 'X-Custom': `static-value`, Authorization: `Bearer my-token` }
    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers,
    })
    expect(result).toEqual(headers)
    expect(db.services.secret.list).not.toHaveBeenCalled()
  })

  it(`should resolve {{ name:id }} with provider-scoped secrets`, async () => {
    const providerSecrets = [
      {
        id: `aaaaaaaaaa`,
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
      headers: { Authorization: `Bearer {{API_TOKEN:aaaaaaaaaa}}` },
    })

    expect(result).toEqual({
      Authorization: `Bearer decrypted-secret-value`,
    })
  })

  it(`should fall back to org-scoped secrets`, async () => {
    const orgSecrets = [
      {
        id: `eeeeeeeeee`,
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
      headers: { 'X-API-Key': `{{ORG_KEY:eeeeeeeeee}}` },
    })

    expect(result).toEqual({
      'X-API-Key': `decrypted-secret-value`,
    })
  })

  it(`should deduplicate by ID, allowing same-name secrets with different IDs`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>

    mockDecrypt.mockResolvedValueOnce(`provider-value`)
    mockDecrypt.mockResolvedValueOnce(`org-value`)

    const providerSecrets = [
      {
        id: `aaaaaaaaaa`,
        name: `SHARED_KEY`,
        encryptedValue: fakeEncrypted(),
        providerId: `prov-1`,
      },
    ]
    const orgSecrets = [
      {
        id: `bbbbbbbbbb`,
        name: `SHARED_KEY`,
        encryptedValue: fakeEncrypted(),
        orgId: `org-1`,
      },
    ]
    const db = createMockDb(providerSecrets, orgSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: {
        'X-Provider': `{{SHARED_KEY:aaaaaaaaaa}}`,
        'X-Org': `{{SHARED_KEY:bbbbbbbbbb}}`,
      },
    })

    expect(result).toEqual({
      'X-Provider': `provider-value`,
      'X-Org': `org-value`,
    })
    // Both secrets decrypted since they have different IDs
    expect(mockDecrypt).toHaveBeenCalledTimes(2)
  })

  it(`should leave unmatched {{ name:id }} unchanged`, async () => {
    const db = createMockDb()
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: { 'X-Key': `{{UNKNOWN:zzzzzzzzzz}}` },
    })

    expect(result).toEqual({
      'X-Key': `{{UNKNOWN:zzzzzzzzzz}}`,
    })
  })

  it(`should resolve multiple templates in different headers`, async () => {
    const { decryptValue } = await import(`@tdsk/domain`)
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>
    mockDecrypt.mockResolvedValue(`secret-val`)

    const providerSecrets = [
      {
        id: `aaaaaaaaaa`,
        name: `TOKEN_A`,
        encryptedValue: fakeEncrypted(),
        providerId: `prov-1`,
      },
      {
        id: `bbbbbbbbbb`,
        name: `TOKEN_B`,
        encryptedValue: fakeEncrypted(),
        providerId: `prov-1`,
      },
    ]
    const db = createMockDb(providerSecrets)
    const resolver = new SecretResolver(db)

    const result = await resolver.resolveHeaders({
      id: `prov-1`,
      orgId: `org-1`,
      headers: {
        Authorization: `Bearer {{TOKEN_A:aaaaaaaaaa}}`,
        'X-Custom': `{{TOKEN_B:bbbbbbbbbb}}`,
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
      headers: { 'X-Key': `{{SOME_SECRET:aaaaaaaaaa}}` },
    })

    expect(db.services.secret.list).toHaveBeenCalledWith({
      where: { providerId: `prov-1` },
    })
    expect(db.services.secret.list).toHaveBeenCalledWith({
      where: { orgId: `org-1` },
    })
  })
})

// ── SecretResolver logging ──────────────────────────────────────────

describe('SecretResolver logging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should warn on unresolved secret reference', () => {
    SecretResolver.replaceInHeaders({ 'X-Key': '{{UNKNOWN:zzzzzzzzzz}}' }, mockSecrets)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('zzzzzzzzzz'))
  })

  it('should not warn on successful resolution', () => {
    SecretResolver.replaceInHeaders({ 'X-Key': '{{API_TOKEN:aaaaaaaaaa}}' }, mockSecrets)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('should debug log on decryption scope owner fallback', async () => {
    const { deriveKey, decryptValue } = await import('@tdsk/domain')
    const mockDeriveKey = deriveKey as ReturnType<typeof vi.fn>
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>

    // First call (scope owner) fails, second call (orgId) succeeds
    mockDeriveKey.mockResolvedValueOnce(Buffer.alloc(32, 'key'))
    mockDecrypt.mockRejectedValueOnce(new Error('wrong key'))
    mockDeriveKey.mockResolvedValueOnce(Buffer.alloc(32, 'key'))
    mockDecrypt.mockResolvedValueOnce('fallback-value')

    const db = createMockDb()
    const resolver = new SecretResolver(db)

    await resolver.decrypt(
      { encryptedValue: fakeEncrypted(), providerId: 'prov-1', orgId: 'org-1' },
      'org-1'
    )

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Decryption failed with scope owner'),
      expect.objectContaining({ refId: 'prov-1' })
    )
  })

  it('should warn when both decrypt attempts fail', async () => {
    const { deriveKey, decryptValue } = await import('@tdsk/domain')
    const mockDeriveKey = deriveKey as ReturnType<typeof vi.fn>
    const mockDecrypt = decryptValue as ReturnType<typeof vi.fn>

    // Both calls fail
    mockDeriveKey.mockResolvedValueOnce(Buffer.alloc(32, 'key'))
    mockDecrypt.mockRejectedValueOnce(new Error('wrong key'))
    mockDeriveKey.mockResolvedValueOnce(Buffer.alloc(32, 'key'))
    mockDecrypt.mockRejectedValueOnce(new Error('wrong key'))

    const db = createMockDb()
    const resolver = new SecretResolver(db)

    const result = await resolver.decrypt(
      { encryptedValue: fakeEncrypted(), providerId: 'prov-1', orgId: 'org-2' },
      'org-2'
    )

    expect(result).toBeNull()
    expect(logger.debug).toHaveBeenCalledTimes(2)
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('scope owner'),
      expect.objectContaining({ refId: 'prov-1' })
    )
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('orgId fallback'),
      expect.objectContaining({ orgId: 'org-2' })
    )
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('all attempts exhausted'),
      expect.objectContaining({ refId: 'prov-1', orgId: 'org-2' })
    )
  })
})
