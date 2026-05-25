import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PermissionOverride as PermissionOverrideService } from './permissionOverride'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock(`drizzle-orm`, async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>(`drizzle-orm`)
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, _tag: `eq` })),
    and: vi.fn((...args) => args),
    lt: vi.fn((col, val) => ({ col, val, _tag: `lt` })),
    isNotNull: vi.fn((col) => ({ col, _tag: `isNotNull` })),
    getTableName: vi.fn(() => `permission_overrides`),
  }
})

vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

const { mockGetTableName } = vi.hoisted(() => ({
  mockGetTableName: vi.fn(() => `permission_overrides`),
}))

vi.mock(`@TDB/services/base`, () => {
  class Base {
    name: string
    table: any
    db: any
    config: Record<string, any>

    constructor(opts: any) {
      this.db = opts.db
      this.table = opts.table
      this.config = opts.config || {}
      this.name = mockGetTableName()
    }

    with = (opts: any) => opts || {}
    model = (data: any) => data
  }

  return { Base }
})

vi.mock(`@TDB/schemas/permissionOverrides`, () => ({
  permissionOverrides: {
    id: { name: `id` },
    userId: { name: `user_id` },
    orgId: { name: `org_id` },
    projectId: { name: `project_id` },
    permission: { name: `permission` },
    effect: { name: `effect` },
    grantedBy: { name: `granted_by` },
    reason: { name: `reason` },
    expiresAt: { name: `expires_at` },
  },
}))

vi.mock(`@tdsk/domain`, () => {
  class MockBase {
    constructor() {}
  }
  return {
    Base: MockBase,
    PermissionOverrideIdPrefix: `pov_`,
    PermissionOverride: class extends MockBase {
      constructor(data: any) {
        super()
        Object.assign(this, data)
      }
    },
  }
})

const createMockDb = () => {
  const selectWhereFn = vi.fn()
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  const deleteReturningFn = vi.fn()
  const deleteWhereFn = vi.fn(() => ({ returning: deleteReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      select: selectFn,
      delete: deleteFn,
      query: {
        permission_overrides: { findFirst, findMany },
      },
    } as any,
    selectFn,
    selectFromFn,
    selectWhereFn,
    deleteFn,
    deleteWhereFn,
    deleteReturningFn,
    findFirst,
    findMany,
  }
}

const fakeOverrideRow = (overrides: Record<string, any> = {}) => ({
  id: `pov_abc123`,
  userId: `user-1`,
  orgId: `org-1`,
  projectId: null,
  permission: `sandbox:exec`,
  effect: `grant`,
  grantedBy: `admin-1`,
  reason: `Testing`,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`PermissionOverride service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: PermissionOverrideService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { PermissionOverride } = await import(`./permissionOverride`)
    service = new PermissionOverride({
      db: mocks.db,
    } as any)
  })

  describe(`constructor`, () => {
    it(`should instantiate with the permission_overrides table`, () => {
      expect(service).toBeDefined()
      expect(service.name).toBe(`permission_overrides`)
    })
  })

  describe(`model`, () => {
    it(`should create a model from data`, () => {
      const row = fakeOverrideRow()
      const result = service.model(row as any)

      expect(result).toBeDefined()
      expect(result.userId).toBe(`user-1`)
      expect(result.orgId).toBe(`org-1`)
      expect(result.permission).toBe(`sandbox:exec`)
      expect(result.effect).toBe(`grant`)
    })
  })

  describe(`getForUser`, () => {
    it(`should return overrides for a user in an org scope`, async () => {
      const row = fakeOverrideRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.getForUser(`user-1`, { orgId: `org-1` })

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(1)
      expect(result.data![0].userId).toBe(`user-1`)
      expect(result.data![0].orgId).toBe(`org-1`)
      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should return overrides for a user in a project scope`, async () => {
      const row = fakeOverrideRow({ orgId: null, projectId: `proj-1` })
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.getForUser(`user-1`, { projectId: `proj-1` })

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(1)
      expect(result.data![0].projectId).toBe(`proj-1`)
    })

    it(`should return empty array when no scope is provided`, async () => {
      const result = await service.getForUser(`user-1`, {})

      expect(result.data).toEqual([])
      expect(mocks.selectFn).not.toHaveBeenCalled()
    })

    it(`should return empty array when user has no overrides`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.getForUser(`user-1`, { orgId: `org-1` })

      expect(result.data).toEqual([])
    })

    it(`should return multiple overrides when user has several`, async () => {
      const rows = [
        fakeOverrideRow({ permission: `sandbox:exec`, effect: `grant` }),
        fakeOverrideRow({ id: `pov_def456`, permission: `secret:read`, effect: `deny` }),
      ]
      mocks.selectWhereFn.mockResolvedValue(rows)

      const result = await service.getForUser(`user-1`, { orgId: `org-1` })

      expect(result.data).toHaveLength(2)
      expect(result.data![0].permission).toBe(`sandbox:exec`)
      expect(result.data![1].permission).toBe(`secret:read`)
    })

    it(`should return error on DB exception`, async () => {
      const dbError = new Error(`Connection lost`)
      mocks.selectWhereFn.mockRejectedValue(dbError)

      const result = await service.getForUser(`user-1`, { orgId: `org-1` })

      expect(result.error).toBe(dbError)
      expect(result.data).toBeUndefined()
    })
  })

  describe(`listForOrg`, () => {
    it(`should return all overrides for an org`, async () => {
      const rows = [
        fakeOverrideRow(),
        fakeOverrideRow({ id: `pov_def456`, userId: `user-2` }),
      ]
      mocks.selectWhereFn.mockResolvedValue(rows)

      const result = await service.listForOrg(`org-1`)

      expect(result.data).toHaveLength(2)
      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should return empty array when org has no overrides`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.listForOrg(`org-1`)

      expect(result.data).toEqual([])
    })

    it(`should return error on DB exception`, async () => {
      const dbError = new Error(`Query timeout`)
      mocks.selectWhereFn.mockRejectedValue(dbError)

      const result = await service.listForOrg(`org-1`)

      expect(result.error).toBe(dbError)
      expect(result.data).toBeUndefined()
    })
  })

  describe(`listForProject`, () => {
    it(`should return all overrides for a project`, async () => {
      const row = fakeOverrideRow({ orgId: null, projectId: `proj-1` })
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.listForProject(`proj-1`)

      expect(result.data).toHaveLength(1)
      expect(result.data![0].projectId).toBe(`proj-1`)
    })

    it(`should return empty array when project has no overrides`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.listForProject(`proj-1`)

      expect(result.data).toEqual([])
    })

    it(`should return error on DB exception`, async () => {
      const dbError = new Error(`Table not found`)
      mocks.selectWhereFn.mockRejectedValue(dbError)

      const result = await service.listForProject(`proj-1`)

      expect(result.error).toBe(dbError)
      expect(result.data).toBeUndefined()
    })
  })

  describe(`deleteById`, () => {
    it(`should return true when override is deleted`, async () => {
      mocks.deleteReturningFn.mockResolvedValue([fakeOverrideRow()])

      const result = await service.deleteById(`pov_abc123`)

      expect(result.data).toBe(true)
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
      expect(mocks.deleteReturningFn).toHaveBeenCalledOnce()
    })

    it(`should return false when override does not exist`, async () => {
      mocks.deleteReturningFn.mockResolvedValue([])

      const result = await service.deleteById(`pov_nonexistent`)

      expect(result.data).toBe(false)
    })

    it(`should return error on DB exception`, async () => {
      const dbError = new Error(`FK constraint violation`)
      mocks.deleteReturningFn.mockRejectedValue(dbError)

      const result = await service.deleteById(`pov_abc123`)

      expect(result.error).toBe(dbError)
      expect(result.data).toBeUndefined()
    })
  })

  describe(`deleteExpired`, () => {
    it(`should delete expired overrides scoped to orgId and return count`, async () => {
      const expiredRows = [
        fakeOverrideRow({ expiresAt: `2020-01-01T00:00:00Z` }),
        fakeOverrideRow({ id: `pov_def456`, expiresAt: `2021-06-15T12:00:00Z` }),
      ]
      mocks.deleteReturningFn.mockResolvedValue(expiredRows)

      const result = await service.deleteExpired(`org-1`)

      expect(result.data).toBe(2)
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
      expect(mocks.deleteReturningFn).toHaveBeenCalledOnce()
    })

    it(`should return 0 when no overrides are expired`, async () => {
      mocks.deleteReturningFn.mockResolvedValue([])

      const result = await service.deleteExpired(`org-1`)

      expect(result.data).toBe(0)
    })

    it(`should return error on DB exception`, async () => {
      const dbError = new Error(`Connection refused`)
      mocks.deleteReturningFn.mockRejectedValue(dbError)

      const result = await service.deleteExpired(`org-1`)

      expect(result.error).toBe(dbError)
      expect(result.data).toBeUndefined()
    })
  })
})
