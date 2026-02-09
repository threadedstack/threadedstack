import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DomainService } from './domain'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock drizzle-orm utilities
vi.mock(`drizzle-orm`, async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>(`drizzle-orm`)
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, _tag: `eq` })),
    and: vi.fn((...args) => args),
    getTableName: vi.fn(() => `domains`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the domains schema
vi.mock(`@TDB/schemas/domains`, () => ({
  domains: {
    id: { name: `id` },
    domain: { name: `domain` },
    orgId: { name: `org_id` },
    projectId: { name: `project_id` },
    verified: { name: `verified` },
    verifiedAt: { name: `verified_at` },
    sslEnabled: { name: `ssl_enabled` },
    sslCertificate: { name: `ssl_certificate` },
    sslPrivateKey: { name: `ssl_private_key` },
  },
}))

// Mock the certificates schema
vi.mock(`@TDB/schemas/certificates`, () => ({
  certificates: {
    parent: { name: `parent` },
    name: { name: `name` },
    isFile: { name: `is_file` },
    value: { name: `value` },
    modified: { name: `modified` },
  },
}))

// Mock domain models
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Domain: vi.fn(function MockDomain(data: any) {
      return { ...data, _isModel: true }
    }),
    Certificate: vi.fn(function MockCertificate(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Covers all chained APIs used by DomainService:
 *   - db.query.domains.findFirst(...)
 *   - db.insert(table).values(data).returning()
 *   - db.update(table).set(data).where(cond).returning()
 *   - db.delete(table).where(cond).returning()
 *   - db.select().from(table).where(cond)
 *   - db.select().from(table).where(cond).limit(n)
 *   - db.transaction(async (tx) => { ... })
 */
const createMockDb = () => {
  // --- insert chain ---
  const returningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  // --- update chain ---
  const whereReturningFn = vi.fn()
  const whereFn = vi.fn(() => ({ returning: whereReturningFn }))
  const setFn = vi.fn(() => ({ where: whereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  // --- delete chain ---
  const deleteWhereReturningFn = vi.fn()
  const deleteWhereMock = vi.fn(() => ({ returning: deleteWhereReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereMock }))

  // --- select chain (for find and owner) ---
  const selectLimitFn = vi.fn()
  const selectWhereFn = vi.fn(() => ({ limit: selectLimitFn }))
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  // --- query chain (for base get/by) ---
  const findFirst = vi.fn()
  const findMany = vi.fn()

  // --- transaction mock ---
  const txOnConflictDoNothingFn = vi.fn()
  const txOnConflictDoUpdateFn = vi.fn()
  const txValuesFn = vi.fn(() => ({
    onConflictDoNothing: txOnConflictDoNothingFn,
    onConflictDoUpdate: txOnConflictDoUpdateFn,
  }))
  const txInsertFn = vi.fn(() => ({ values: txValuesFn }))
  const txMock = {
    insert: txInsertFn,
  }
  const transactionFn = vi.fn(async (cb) => {
    await cb(txMock)
  })

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      select: selectFn,
      transaction: transactionFn,
      query: {
        domains: { findFirst, findMany },
      },
    } as any,
    // Expose mocks for assertions
    returningFn,
    valuesFn,
    insertFn,
    onConflictDoUpdateFn,
    setFn,
    whereFn,
    whereReturningFn,
    deleteWhereMock,
    deleteWhereReturningFn,
    deleteFn,
    selectFn,
    selectFromFn,
    selectWhereFn,
    selectLimitFn,
    findFirst,
    findMany,
    transactionFn,
    txMock,
    txInsertFn,
    txValuesFn,
    txOnConflictDoNothingFn,
    txOnConflictDoUpdateFn,
  }
}

/** Helper to build a mock domain record */
const mockDomainRecord = (overrides: Record<string, any> = {}) => ({
  id: `dom-1`,
  domain: `example.com`,
  orgId: `org-1`,
  projectId: null,
  verified: false,
  verifiedAt: null,
  sslEnabled: false,
  sslCertificate: null,
  sslPrivateKey: null,
  ...overrides,
})

describe(`DomainService`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: DomainService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { DomainService: DS } = await import(`./domain`)
    service = new DS({
      db: mocks.db,
      config: {},
    } as any)
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create a DomainModel from data`, () => {
      const data = mockDomainRecord()
      const result = service.model(data as any)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
      expect(result.domain).toBe(`example.com`)
    })

    it(`should pass all data fields through to DomainModel`, () => {
      const data = mockDomainRecord({ verified: true, sslEnabled: true })
      const result = service.model(data as any)

      expect(result.verified).toBe(true)
      expect(result.sslEnabled).toBe(true)
    })
  })

  // ---------- get ----------
  describe(`get`, () => {
    it(`should return domain model with certificates when found`, async () => {
      const record = mockDomainRecord({ certificates: [{ name: `example.com.crt` }] })
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`dom-1`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should pass { with: { certificates: true } } to super.get`, async () => {
      const record = mockDomainRecord()
      mocks.findFirst.mockResolvedValue(record)

      await service.get(`dom-1`)

      // super.get calls db.query.domains.findFirst with opts containing the with clause
      const callArgs = mocks.findFirst.mock.calls[0][0]
      expect(callArgs.with).toBeDefined()
      expect(callArgs.with.certificates).toBe(true)
    })

    it(`should return error when domain not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.get(`missing-id`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error on db exception`, async () => {
      mocks.findFirst.mockRejectedValue(new Error(`DB failure`))

      const result = await service.get(`dom-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- create ----------
  describe(`create`, () => {
    it(`should create domain without SSL certificate`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should create domain and call #customCert when sslCertificate is set`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----`,
        sslPrivateKey: `-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      // Transaction should have 3 inserts: directory + cert file + key file
      expect(mocks.txInsertFn).toHaveBeenCalledTimes(3)
    })

    it(`should create domain with SSL but without private key`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-data`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      // Transaction should have 2 inserts: directory + cert file (no key)
      expect(mocks.txInsertFn).toHaveBeenCalledTimes(2)
    })

    it(`should return error when #customCert transaction fails`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])
      mocks.transactionFn.mockRejectedValue(new Error(`Transaction failed`))

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-data`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Transaction failed`)
    })

    it(`should skip #customCert when create result has no data`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`Insert failed`))

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-data`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Insert failed`)
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should return error on base create db exception`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- update ----------
  describe(`update`, () => {
    it(`should update domain without SSL certificate`, async () => {
      const record = mockDomainRecord({ id: `dom-1` })
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should update domain and call #customCert when sslCertificate is set`, async () => {
      const record = mockDomainRecord()
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
        sslCertificate: `cert-data`,
        sslPrivateKey: `key-data`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      // 3 inserts: directory + cert + key
      expect(mocks.txInsertFn).toHaveBeenCalledTimes(3)
    })

    it(`should update domain with SSL but without private key`, async () => {
      const record = mockDomainRecord()
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
        sslCertificate: `cert-data`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      // 2 inserts: directory + cert (no key)
      expect(mocks.txInsertFn).toHaveBeenCalledTimes(2)
    })

    it(`should return error when #customCert transaction fails on update`, async () => {
      const record = mockDomainRecord()
      mocks.whereReturningFn.mockResolvedValue([record])
      mocks.transactionFn.mockRejectedValue(new Error(`Transaction failed`))

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
        sslCertificate: `cert-data`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Transaction failed`)
    })

    it(`should skip #customCert when update result has no data (not found)`, async () => {
      mocks.whereReturningFn.mockResolvedValue([])

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
        sslCertificate: `cert-data`,
      } as any)

      // Base update returns error when record not found
      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Domain not found`)
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should return error on base update db exception`, async () => {
      mocks.whereReturningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- by ----------
  describe(`by`, () => {
    it(`should query by object argument with certificates`, async () => {
      const record = mockDomainRecord({ certificates: [] })
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.by({ domain: `example.com` })

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should pass { with: { certificates: true } } to super.by`, async () => {
      const record = mockDomainRecord()
      mocks.findFirst.mockResolvedValue(record)

      await service.by({ domain: `example.com` })

      const callArgs = mocks.findFirst.mock.calls[0][0]
      expect(callArgs.with).toBeDefined()
      expect(callArgs.with.certificates).toBe(true)
    })

    it(`should query by string arguments`, async () => {
      const record = mockDomainRecord()
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.by(`domain`, `example.com`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should return error when not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.by({ domain: `nonexistent.com` })

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not found`)
    })

    it(`should return error on db exception`, async () => {
      mocks.findFirst.mockRejectedValue(new Error(`DB failure`))

      const result = await service.by({ domain: `example.com` })

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- find ----------
  describe(`find`, () => {
    it(`should return CertModel when valid cert found (modified within 90 days)`, async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 10)
      const certs = [
        {
          parent: `example.com`,
          name: `example.com.crt`,
          isFile: true,
          value: Buffer.from(`cert`),
          modified: recentDate,
        },
      ] as any
      // find uses db.select().from().where() — selectWhereFn returns the array
      mocks.selectWhereFn.mockResolvedValue(certs)

      const result = await service.find(`example.com`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return { data: undefined } when no certs exist`, async () => {
      mocks.selectWhereFn.mockResolvedValue([] as any)

      const result = await service.find(`example.com`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return { data: undefined } when only directory entries exist (no files)`, async () => {
      const certs = [
        {
          parent: ``,
          name: `example.com`,
          isFile: false,
          value: null,
          modified: new Date(),
        },
      ] as any
      mocks.selectWhereFn.mockResolvedValue(certs)

      const result = await service.find(`example.com`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return { data: undefined } when cert is expired (older than 90 days)`, async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 100)
      const certs = [
        {
          parent: `example.com`,
          name: `example.com.crt`,
          isFile: true,
          value: Buffer.from(`cert`),
          modified: expiredDate,
        },
      ] as any
      mocks.selectWhereFn.mockResolvedValue(certs)

      const result = await service.find(`example.com`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return { data: undefined } when cert has null modified timestamp`, async () => {
      const certs = [
        {
          parent: `example.com`,
          name: `example.com.crt`,
          isFile: true,
          value: Buffer.from(`cert`),
          modified: null,
        },
      ] as any
      mocks.selectWhereFn.mockResolvedValue(certs)

      const result = await service.find(`example.com`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should pick the first valid cert when multiple exist`, async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 100)
      const certs = [
        {
          parent: `example.com`,
          name: `example.com.key`,
          isFile: true,
          value: Buffer.from(`key`),
          modified: expiredDate,
        },
        {
          parent: `example.com`,
          name: `example.com.crt`,
          isFile: true,
          value: Buffer.from(`cert`),
          modified: recentDate,
        },
      ] as any
      mocks.selectWhereFn.mockResolvedValue(certs)

      const result = await service.find(`example.com`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.name).toBe(`example.com.crt`)
    })

    it(`should return { error } on db exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.find(`example.com`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- validate ----------
  describe(`validate`, () => {
    it(`should return true when domain exists and is verified`, async () => {
      const record = mockDomainRecord({ verified: true })
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.validate(`example.com`)

      expect(result).toBe(true)
    })

    it(`should return false when domain exists but is not verified`, async () => {
      const record = mockDomainRecord({ verified: false })
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.validate(`example.com`)

      expect(result).toBe(false)
    })

    it(`should return false when domain is not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.validate(`nonexistent.com`)

      expect(result).toBe(false)
    })
  })

  // ---------- verified ----------
  describe(`verified`, () => {
    it(`should mark domain as verified and return model`, async () => {
      const record = mockDomainRecord({ verified: true, verifiedAt: new Date() })
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.verified(`example.com`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      // Verify set was called with verified: true and a verifiedAt Date
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.verified).toBe(true)
      expect(setArg.verifiedAt).toBeInstanceOf(Date)
    })

    it(`should return error on db exception`, async () => {
      mocks.whereReturningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.verified(`example.com`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- enableSSL ----------
  describe(`enableSSL`, () => {
    it(`should enable SSL and return the domain record`, async () => {
      const record = mockDomainRecord({ sslEnabled: true })
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.enableSSL(`example.com`)

      expect(result).toBeDefined()
      expect(result?.data?.sslEnabled).toBe(true)
      // Verify set was called with sslEnabled: true
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.sslEnabled).toBe(true)
    })

    it(`should return error on db exception`, async () => {
      mocks.whereReturningFn.mockRejectedValue(new Error(`DB failure`))

      const result = (await service.enableSSL(`example.com`)) as any

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- disableSSL ----------
  describe(`disableSSL`, () => {
    it(`should disable SSL and return the domain record`, async () => {
      const record = mockDomainRecord({ sslEnabled: false })
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.disableSSL(`example.com`)

      expect(result).toBeDefined()
      expect(result.data?.sslEnabled).toBe(false)
      // Verify set was called with sslEnabled: false
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.sslEnabled).toBe(false)
    })

    it(`should return error on db exception`, async () => {
      mocks.whereReturningFn.mockRejectedValue(new Error(`DB failure`))

      const result = (await service.disableSSL(`example.com`)) as any

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- delete ----------
  describe(`delete`, () => {
    it(`should delete by domain name (not id) and return model`, async () => {
      const record = mockDomainRecord()
      mocks.deleteWhereReturningFn.mockResolvedValue([record])

      const result = await service.delete(`example.com`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.domain).toBe(`example.com`)
      expect(result.error).toBeUndefined()
      // Verify delete was called (not by id, but by domain name)
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereMock).toHaveBeenCalledOnce()
    })

    it(`should return error on db exception`, async () => {
      mocks.deleteWhereReturningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.delete(`example.com`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- owner ----------
  describe(`owner`, () => {
    it(`should return true when domain record exists (domain only)`, async () => {
      mocks.selectLimitFn.mockResolvedValue([mockDomainRecord()])

      const result = await service.owner(`example.com`)

      expect(result).toBe(true)
      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectLimitFn).toHaveBeenCalledWith(1)
    })

    it(`should return false when domain record does not exist`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      const result = await service.owner(`nonexistent.com`)

      expect(result).toBe(false)
    })

    it(`should include orgId condition when provided`, async () => {
      mocks.selectLimitFn.mockResolvedValue([mockDomainRecord()])

      const result = await service.owner(`example.com`, `org-1`)

      expect(result).toBe(true)
      // and() should have been called with 2 conditions (domain + orgId)
      const { and: andFn } = await import(`drizzle-orm`)
      expect(andFn).toHaveBeenCalled()
    })

    it(`should include projectId condition when provided`, async () => {
      mocks.selectLimitFn.mockResolvedValue([mockDomainRecord()])

      const result = await service.owner(`example.com`, undefined, `proj-1`)

      expect(result).toBe(true)
      const { and: andFn } = await import(`drizzle-orm`)
      expect(andFn).toHaveBeenCalled()
    })

    it(`should include both orgId and projectId conditions when both provided`, async () => {
      mocks.selectLimitFn.mockResolvedValue([mockDomainRecord()])

      const result = await service.owner(`example.com`, `org-1`, `proj-1`)

      expect(result).toBe(true)
      const { eq: eqFn } = await import(`drizzle-orm`)
      // eq should be called 3 times: domain, orgId, projectId
      expect(eqFn).toHaveBeenCalledTimes(3)
    })

    it(`should return false when no match with orgId filter`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      const result = await service.owner(`example.com`, `wrong-org`)

      expect(result).toBe(false)
    })
  })

  // ---------- #customCert (tested indirectly via create/update) ----------
  describe(`#customCert (indirect via create)`, () => {
    it(`should insert directory entry, cert file, and key file in transaction`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-pem`,
        sslPrivateKey: `key-pem`,
      } as any)

      expect(mocks.transactionFn).toHaveBeenCalledOnce()

      // 3 tx.insert calls: directory, cert file, key file
      expect(mocks.txInsertFn).toHaveBeenCalledTimes(3)

      // First insert: directory entry (onConflictDoNothing)
      expect(mocks.txOnConflictDoNothingFn).toHaveBeenCalledTimes(1)

      // Second and third inserts: cert file and key file (onConflictDoUpdate)
      expect(mocks.txOnConflictDoUpdateFn).toHaveBeenCalledTimes(2)
    })

    it(`should insert directory entry and cert file only when no private key`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-pem`,
      } as any)

      expect(mocks.transactionFn).toHaveBeenCalledOnce()

      // 2 tx.insert calls: directory + cert file
      expect(mocks.txInsertFn).toHaveBeenCalledTimes(2)
      expect(mocks.txOnConflictDoNothingFn).toHaveBeenCalledTimes(1)
      expect(mocks.txOnConflictDoUpdateFn).toHaveBeenCalledTimes(1)
    })

    it(`should use the domain from the created record for cert storage`, async () => {
      const record = mockDomainRecord({ domain: `custom.example.com` })
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        domain: `custom.example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-pem`,
        sslPrivateKey: `key-pem`,
      } as any)

      // Verify the values passed to tx.insert().values()
      const valuesCallArgs = mocks.txValuesFn.mock.calls as any

      // First call: directory entry
      expect(valuesCallArgs[0][0].parent).toBe(``)
      expect(valuesCallArgs[0][0].name).toBe(`custom.example.com`)
      expect(valuesCallArgs[0][0].isFile).toBe(false)
      expect(valuesCallArgs[0][0].value).toBeNull()

      // Second call: cert file
      expect(valuesCallArgs[1][0].parent).toBe(`custom.example.com`)
      expect(valuesCallArgs[1][0].name).toBe(`custom.example.com.crt`)
      expect(valuesCallArgs[1][0].isFile).toBe(true)
      expect(valuesCallArgs[1][0].value).toBeInstanceOf(Buffer)

      // Third call: key file
      expect(valuesCallArgs[2][0].parent).toBe(`custom.example.com`)
      expect(valuesCallArgs[2][0].name).toBe(`custom.example.com.key`)
      expect(valuesCallArgs[2][0].isFile).toBe(true)
      expect(valuesCallArgs[2][0].value).toBeInstanceOf(Buffer)
    })

    it(`should return { error } when transaction throws (via create)`, async () => {
      const record = mockDomainRecord()
      mocks.returningFn.mockResolvedValue([record])
      const txError = new Error(`Transaction failed`)
      mocks.transactionFn.mockRejectedValue(txError)

      const result = await service.create({
        domain: `example.com`,
        orgId: `org-1`,
        sslCertificate: `cert-pem`,
      } as any)

      expect(result.error).toBe(txError)
    })

    it(`should return { error } when transaction throws (via update)`, async () => {
      const record = mockDomainRecord()
      mocks.whereReturningFn.mockResolvedValue([record])
      const txError = new Error(`Transaction failed`)
      mocks.transactionFn.mockRejectedValue(txError)

      const result = await service.update({
        id: `dom-1`,
        domain: `example.com`,
        sslCertificate: `cert-pem`,
      } as any)

      expect(result.error).toBe(txError)
    })
  })
})
