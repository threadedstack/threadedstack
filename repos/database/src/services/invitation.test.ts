import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Invitation } from './invitation'
import { EInviteStatus } from '@tdsk/domain'

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
    lt: vi.fn((col, val) => ({ col, val, _tag: `lt` })),
    getTableName: vi.fn(() => `invitations`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the invitations schema
vi.mock(`@TDB/schemas/invitations`, () => ({
  invitations: {
    id: { name: `id` },
    email: { name: `email` },
    orgId: { name: `org_id` },
    token: { name: `token` },
    status: { name: `status` },
    expiresAt: { name: `expires_at` },
    userId: { name: `user_id` },
  },
}))

// Mock the Invitation domain model — must preserve EInviteStatus
// because the service imports it at module level
vi.mock(`@tdsk/domain`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...actual,
    Invitation: vi.fn(function MockInvitation(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Builds a fake invitation row that mimics what the DB would return.
 */
const fakeInvitationRow = (overrides: Record<string, any> = {}) => ({
  id: `inv-1`,
  email: `user@example.com`,
  orgId: `org-1`,
  token: `tok-abc123`,
  status: `pending`,
  roleType: `member`,
  invitedBy: `admin-1`,
  userId: null,
  revokedBy: null,
  revokedAt: null,
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/**
 * Creates a mock Drizzle-compatible DB object.
 *
 * The Invitation service uses three DB chain patterns:
 *   1. db.select().from(table).where(cond).limit(1)   — getByToken, getByEmailAndOrg, accept/revoke lookup, isValid
 *   2. db.select().from(table).where(cond)             — getPendingByEmail (no limit)
 *   3. db.update(table).set(data).where(cond).returning() — accept, revoke, markExpired
 *
 * getPendingByOrg/getAllByOrg optionally chain .limit()/.offset() — use
 * setupSelectChainable() for those instead of selectWhereFn.mockResolvedValue().
 *
 * For pattern 1 vs 2: where() returns { limit } but the test must configure
 * both limitFn (for .limit(1) calls) and selectWhereFn (for direct array returns).
 */
const createMockDb = () => {
  // select chain: db.select().from(table).where(...).limit(1)
  // For methods WITHOUT limit: the resolved value of where() is used directly
  // For methods WITH limit: limit() is called and its resolved value is used
  const limitFn = vi.fn()
  const offsetFn = vi.fn()
  const selectWhereFn = vi.fn(() => ({ limit: limitFn }))
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  // update chain: db.update(table).set(data).where(cond).returning()
  const updateReturningFn = vi.fn()
  const updateWhereFn = vi.fn(() => ({ returning: updateReturningFn }))
  const setFn = vi.fn(() => ({ where: updateWhereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  // insert chain (used by inherited Base.create)
  const insertReturningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: insertReturningFn }))
  const valuesFn = vi.fn(() => ({
    returning: insertReturningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  // delete chain (used by inherited Base.delete)
  const deleteWhereReturningFn = vi.fn()
  const deleteWhereFn = vi.fn(() => ({ returning: deleteWhereReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  // query chain (used by inherited Base methods — e.g. get/by/list)
  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      select: selectFn,
      update: updateFn,
      insert: insertFn,
      delete: deleteFn,
      query: {
        invitations: { findFirst, findMany },
      },
    } as any,
    // Expose inner mocks for assertion and configuration
    selectFn,
    selectFromFn,
    selectWhereFn,
    limitFn,
    offsetFn,
    updateFn,
    setFn,
    updateWhereFn,
    updateReturningFn,
    insertFn,
    valuesFn,
    insertReturningFn,
    deleteFn,
    deleteWhereFn,
    deleteWhereReturningFn,
    findFirst,
    findMany,
  }
}

/**
 * Configures selectWhereFn to return a thenable chain object supporting
 * optional .limit()/.offset() calls before resolving to `data`.
 * Used by getPendingByOrg/getAllByOrg which optionally chain pagination.
 */
const setupSelectChainable = (mocks: ReturnType<typeof createMockDb>, data: any[]) => {
  const resolved = Promise.resolve(data)
  const chainObj = {
    limit: mocks.limitFn,
    offset: mocks.offsetFn,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
  }
  mocks.selectWhereFn.mockReturnValue(chainObj)
  mocks.limitFn.mockReturnValue(chainObj)
  mocks.offsetFn.mockReturnValue(chainObj)
}

describe(`Invitation service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Invitation

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Invitation({ db: mocks.db } as any)
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate with the invitations table`, () => {
      expect(service).toBeInstanceOf(Invitation)
      expect(service.name).toBe(`invitations`)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create an InvitationModel from data`, () => {
      const row = fakeInvitationRow()
      const result = service.model(row as any)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
      expect(result.email).toBe(`user@example.com`)
      expect(result.orgId).toBe(`org-1`)
    })

    it(`should pass all fields through to the model`, () => {
      const row = fakeInvitationRow({ status: `accepted`, userId: `user-1` })
      const result = service.model(row as any)

      expect(result.status).toBe(`accepted`)
      expect(result.userId).toBe(`user-1`)
    })
  })

  // ---------- getByToken ----------
  describe(`getByToken`, () => {
    it(`should return model when invitation is found`, async () => {
      const row = fakeInvitationRow()
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.getByToken(`tok-abc123`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.token).toBe(`tok-abc123`)
      expect(result.error).toBeUndefined()
      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return null when invitation is not found`, async () => {
      mocks.limitFn.mockResolvedValue([])

      const result = await service.getByToken(`nonexistent-token`)

      expect(result.data).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.limitFn.mockRejectedValue(new Error(`DB connection failed`))

      const result = await service.getByToken(`tok-abc123`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB connection failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getByEmailAndOrg ----------
  describe(`getByEmailAndOrg`, () => {
    it(`should return model when invitation is found`, async () => {
      const row = fakeInvitationRow()
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.getByEmailAndOrg(`user@example.com`, `org-1`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.email).toBe(`user@example.com`)
      expect(result.data.orgId).toBe(`org-1`)
      expect(result.error).toBeUndefined()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return null when no matching invitation exists`, async () => {
      mocks.limitFn.mockResolvedValue([])

      const result = await service.getByEmailAndOrg(`nobody@example.com`, `org-999`)

      expect(result.data).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.limitFn.mockRejectedValue(new Error(`Query timeout`))

      const result = await service.getByEmailAndOrg(`user@example.com`, `org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Query timeout`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getPendingByOrg ----------
  describe(`getPendingByOrg`, () => {
    it(`should return array of pending invitation models`, async () => {
      const rows = [
        fakeInvitationRow({ id: `inv-1` }),
        fakeInvitationRow({ id: `inv-2`, email: `other@example.com` }),
      ]
      setupSelectChainable(mocks, rows as any)

      const result = await service.getPendingByOrg(`org-1`)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[1]._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should return empty array when no pending invitations exist`, async () => {
      setupSelectChainable(mocks, [])

      const result = await service.getPendingByOrg(`org-empty`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should apply limit and offset when provided`, async () => {
      const rows = [fakeInvitationRow({ id: `inv-1` })]
      setupSelectChainable(mocks, rows as any)

      const result = await service.getPendingByOrg(`org-1`, { limit: 10, offset: 20 })

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).toHaveBeenCalledWith(10)
      expect(mocks.offsetFn).toHaveBeenCalledWith(20)
    })

    it(`should work without pagination params (backward compat)`, async () => {
      const rows = [fakeInvitationRow({ id: `inv-1` })]
      setupSelectChainable(mocks, rows as any)

      const result = await service.getPendingByOrg(`org-1`)

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).not.toHaveBeenCalled()
      expect(mocks.offsetFn).not.toHaveBeenCalled()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Connection refused`))

      const result = await service.getPendingByOrg(`org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Connection refused`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getAllByOrg ----------
  describe(`getAllByOrg`, () => {
    it(`should return array of invitation models for all statuses`, async () => {
      const rows = [
        fakeInvitationRow({ id: `inv-1`, status: `pending` }),
        fakeInvitationRow({ id: `inv-2`, status: `accepted` }),
        fakeInvitationRow({ id: `inv-3`, status: `revoked` }),
      ] as any
      setupSelectChainable(mocks, rows)

      const result = await service.getAllByOrg(`org-1`)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(3)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[0].status).toBe(`pending`)
      expect(result.data[1].status).toBe(`accepted`)
      expect(result.data[2].status).toBe(`revoked`)
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when org has no invitations`, async () => {
      setupSelectChainable(mocks, [])

      const result = await service.getAllByOrg(`org-empty`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should apply limit and offset when provided`, async () => {
      const rows = [fakeInvitationRow({ id: `inv-1` })]
      setupSelectChainable(mocks, rows as any)

      const result = await service.getAllByOrg(`org-1`, { limit: 10, offset: 20 })

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).toHaveBeenCalledWith(10)
      expect(mocks.offsetFn).toHaveBeenCalledWith(20)
    })

    it(`should work without pagination params (backward compat)`, async () => {
      const rows = [fakeInvitationRow({ id: `inv-1` })]
      setupSelectChainable(mocks, rows as any)

      const result = await service.getAllByOrg(`org-1`)

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).not.toHaveBeenCalled()
      expect(mocks.offsetFn).not.toHaveBeenCalled()
    })

    it(`should filter by status at the DB level when provided`, async () => {
      const rows = [fakeInvitationRow({ id: `inv-1`, status: `accepted` })]
      setupSelectChainable(mocks, rows as any)

      const result = await service.getAllByOrg(`org-1`, {
        limit: 10,
        offset: 0,
        status: EInviteStatus.accepted,
      })

      expect(result.data).toHaveLength(1)
      expect(mocks.selectWhereFn).toHaveBeenCalledWith([
        { col: { name: `org_id` }, val: `org-1`, _tag: `eq` },
        { col: { name: `status` }, val: EInviteStatus.accepted, _tag: `eq` },
      ])
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Table not found`))

      const result = await service.getAllByOrg(`org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Table not found`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getPendingByEmail ----------
  describe(`getPendingByEmail`, () => {
    it(`should return array of pending invitations for the email`, async () => {
      const rows = [
        fakeInvitationRow({ id: `inv-1`, orgId: `org-1` }),
        fakeInvitationRow({ id: `inv-2`, orgId: `org-2` }),
      ] as any
      mocks.selectWhereFn.mockResolvedValue(rows)

      const result = await service.getPendingByEmail(`user@example.com`)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[1]._isModel).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when no pending invitations exist for email`, async () => {
      mocks.selectWhereFn.mockResolvedValue([] as any)

      const result = await service.getPendingByEmail(`nobody@example.com`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Network error`))

      const result = await service.getPendingByEmail(`user@example.com`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Network error`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- accept ----------
  describe(`accept`, () => {
    it(`should accept a pending invitation successfully`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `pending` })
      const updatedRow = fakeInvitationRow({
        id: `inv-1`,
        status: `accepted`,
        userId: `user-1`,
        acceptedAt: new Date().toISOString(),
      })

      // First call: lookup via select().from().where().limit(1)
      mocks.limitFn.mockResolvedValue([existingRow])
      // Second call: update().set().where().returning()
      mocks.updateReturningFn.mockResolvedValue([updatedRow])

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.status).toBe(`accepted`)
      expect(result.data.userId).toBe(`user-1`)
      expect(result.error).toBeUndefined()

      // Verify update was called with correct fields
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.userId).toBe(`user-1`)
      expect(setArg.status).toBe(`accepted`)
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      expect(typeof setArg.acceptedAt).toBe(`string`)
    })

    it(`should return error when invitation is not found`, async () => {
      mocks.limitFn.mockResolvedValue([])

      const result = await service.accept(`inv-missing`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation not found`)
      expect(result.data).toBeUndefined()
      // update should never be called
      expect(mocks.updateFn).not.toHaveBeenCalled()
    })

    it(`should return error when invitation is not pending (already accepted)`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `accepted` })
      mocks.limitFn.mockResolvedValue([existingRow])

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation is not pending`)
      expect(result.data).toBeUndefined()
      expect(mocks.updateFn).not.toHaveBeenCalled()
    })

    it(`should return error when invitation is not pending (revoked)`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `revoked` })
      mocks.limitFn.mockResolvedValue([existingRow])

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation is not pending`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when invitation is not pending (expired)`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `expired` })
      mocks.limitFn.mockResolvedValue([existingRow])

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation is not pending`)
      expect(result.data).toBeUndefined()
    })

    it(`should return undefined data when update returns empty array`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `pending` })
      mocks.limitFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockResolvedValue([])

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception during lookup`, async () => {
      mocks.limitFn.mockRejectedValue(new Error(`DB read failure`))

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB read failure`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error on DB exception during update`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `pending` })
      mocks.limitFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockRejectedValue(new Error(`DB write failure`))

      const result = await service.accept(`inv-1`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB write failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- revoke ----------
  describe(`revoke`, () => {
    it(`should revoke a pending invitation successfully`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `pending` })
      const updatedRow = fakeInvitationRow({
        id: `inv-1`,
        status: `revoked`,
        revokedBy: `admin-1`,
        revokedAt: new Date().toISOString(),
      })

      mocks.limitFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockResolvedValue([updatedRow])

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.status).toBe(`revoked`)
      expect(result.data.revokedBy).toBe(`admin-1`)
      expect(result.error).toBeUndefined()

      // Verify update was called with correct fields
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.revokedBy).toBe(`admin-1`)
      expect(setArg.status).toBe(`revoked`)
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      expect(typeof setArg.revokedAt).toBe(`string`)
    })

    it(`should return error when invitation is not found`, async () => {
      mocks.limitFn.mockResolvedValue([])

      const result = await service.revoke(`inv-missing`, `admin-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation not found`)
      expect(result.data).toBeUndefined()
      expect(mocks.updateFn).not.toHaveBeenCalled()
    })

    it(`should return error when invitation is not pending (already accepted)`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `accepted` })
      mocks.limitFn.mockResolvedValue([existingRow])

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation is not pending`)
      expect(result.data).toBeUndefined()
      expect(mocks.updateFn).not.toHaveBeenCalled()
    })

    it(`should return error when invitation is not pending (already revoked)`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `revoked` })
      mocks.limitFn.mockResolvedValue([existingRow])

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation is not pending`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when invitation is not pending (expired)`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `expired` })
      mocks.limitFn.mockResolvedValue([existingRow])

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Invitation is not pending`)
      expect(result.data).toBeUndefined()
    })

    it(`should return undefined data when update returns empty array`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `pending` })
      mocks.limitFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockResolvedValue([])

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception during lookup`, async () => {
      mocks.limitFn.mockRejectedValue(new Error(`DB read failure`))

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB read failure`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error on DB exception during update`, async () => {
      const existingRow = fakeInvitationRow({ id: `inv-1`, status: `pending` })
      mocks.limitFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockRejectedValue(new Error(`DB write failure`))

      const result = await service.revoke(`inv-1`, `admin-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB write failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- markExpired ----------
  describe(`markExpired`, () => {
    it(`should mark expired invitations and return count`, async () => {
      const expiredRows = [
        fakeInvitationRow({ id: `inv-1`, status: `expired` }),
        fakeInvitationRow({ id: `inv-2`, status: `expired` }),
        fakeInvitationRow({ id: `inv-3`, status: `expired` }),
      ]
      mocks.updateReturningFn.mockResolvedValue(expiredRows)

      const result = await service.markExpired()

      expect(result.data).toBe(3)
      expect(result.error).toBeUndefined()

      // Verify update was called with correct status
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.status).toBe(`expired`)
      expect(setArg.updatedAt).toBeInstanceOf(Date)
    })

    it(`should return 0 when no invitations are expired`, async () => {
      mocks.updateReturningFn.mockResolvedValue([])

      const result = await service.markExpired()

      expect(result.data).toBe(0)
      expect(result.error).toBeUndefined()
    })

    it(`should return 1 when exactly one invitation is expired`, async () => {
      mocks.updateReturningFn.mockResolvedValue([
        fakeInvitationRow({ status: `expired` }),
      ])

      const result = await service.markExpired()

      expect(result.data).toBe(1)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.updateReturningFn.mockRejectedValue(new Error(`Update failed`))

      const result = await service.markExpired()

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Update failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- isValid ----------
  describe(`isValid`, () => {
    it(`should return true for a pending invitation that is not expired`, async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const row = fakeInvitationRow({
        id: `inv-1`,
        status: `pending`,
        expiresAt: futureDate,
      })
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.isValid(`inv-1`)

      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return false for a non-pending invitation (accepted)`, async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const row = fakeInvitationRow({
        id: `inv-1`,
        status: `accepted`,
        expiresAt: futureDate,
      })
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.isValid(`inv-1`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return false for a non-pending invitation (revoked)`, async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const row = fakeInvitationRow({
        id: `inv-1`,
        status: `revoked`,
        expiresAt: futureDate,
      })
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.isValid(`inv-1`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return false for a non-pending invitation (expired status)`, async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const row = fakeInvitationRow({
        id: `inv-1`,
        status: `expired`,
        expiresAt: futureDate,
      })
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.isValid(`inv-1`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return false for a pending invitation that has expired`, async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const row = fakeInvitationRow({
        id: `inv-1`,
        status: `pending`,
        expiresAt: pastDate,
      })
      mocks.limitFn.mockResolvedValue([row])

      const result = await service.isValid(`inv-1`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return false when invitation is not found`, async () => {
      mocks.limitFn.mockResolvedValue([])

      const result = await service.isValid(`inv-missing`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.limitFn.mockRejectedValue(new Error(`DB unavailable`))

      const result = await service.isValid(`inv-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB unavailable`)
      expect(result.data).toBeUndefined()
    })
  })
})
