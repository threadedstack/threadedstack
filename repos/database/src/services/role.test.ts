import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Role as RoleService } from './role'

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
    isNotNull: vi.fn((col) => ({ col, _tag: `isNotNull` })),
    getTableName: vi.fn(() => `roles`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the Base service class that Role extends.
// This avoids loading the real base.ts which has its own unresolvable imports.
// Uses vi.hoisted to create the getTableName reference accessible in the factory.
const { mockGetTableName } = vi.hoisted(() => ({
  mockGetTableName: vi.fn(() => `roles`),
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

// Mock the roles schema
vi.mock(`@TDB/schemas/roles`, () => ({
  roles: {
    id: { name: `id` },
    name: { name: `name` },
    type: { name: `type` },
    userId: { name: `user_id` },
    orgId: { name: `org_id` },
    projectId: { name: `project_id` },
  },
}))

// Mock the Role domain model.
// Cannot use vi.importActual here because the real @tdsk/domain has
// unresolvable @TDM/* path aliases in the test environment.
vi.mock(`@tdsk/domain`, () => ({
  Role: vi.fn(function MockRole(data: any) {
    return { ...data, _isModel: true }
  }),
}))

/**
 * Creates a mock Drizzle-compatible DB object.
 *
 * Covers all chain patterns used by the Role service:
 *   select().from().where().limit()       -- getOrgRole, getProjectRole, getOrgOwner, isOrgMember, isProjectMember
 *   select().from().where()               -- getUserRoles, getOrgMembers, getProjectMembers
 *   select({...}).from().where()          -- getUserOrgs, getUserProjects
 *   update().set().where().returning()    -- updateOrgRole, updateProjectRole
 *   delete().where().returning()          -- removeFromOrg, removeFromProject
 *
 * For the select chain, `.where()` can be either awaited directly (no `.limit()`)
 * or chained with `.limit()`. We handle this by making `selectWhereFn` configurable:
 *   - For methods that call `.limit()`: set selectWhereFn to return `{ limit: limitFn }`
 *     and set limitFn.mockResolvedValue(...)
 *   - For methods that don't call `.limit()`: set selectWhereFn.mockResolvedValue(...)
 */
const createMockDb = () => {
  // select chain
  const limitFn = vi.fn()
  const offsetFn = vi.fn()
  const selectWhereFn = vi.fn()
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  // update chain: db.update(table).set(data).where(cond).returning()
  const updateReturningFn = vi.fn()
  const updateWhereFn = vi.fn(() => ({ returning: updateReturningFn }))
  const setFn = vi.fn(() => ({ where: updateWhereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  // delete chain: db.delete(table).where(cond).returning()
  const deleteReturningFn = vi.fn()
  const deleteWhereFn = vi.fn(() => ({ returning: deleteReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  // query chain (used by inherited Base methods -- e.g. get/by/list)
  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      select: selectFn,
      update: updateFn,
      delete: deleteFn,
      query: {
        roles: { findFirst, findMany },
      },
    } as any,
    // Expose inner mocks for assertion
    selectFn,
    selectFromFn,
    selectWhereFn,
    limitFn,
    offsetFn,
    setFn,
    updateWhereFn,
    updateReturningFn,
    deleteFn,
    deleteWhereFn,
    deleteReturningFn,
    findFirst,
    findMany,
  }
}

/**
 * Helper: configure select chain for methods that call `.limit()`.
 * selectWhereFn returns synchronous `{ limit: limitFn }`,
 * and limitFn resolves to the provided data.
 */
const setupSelectWithLimit = (mocks: ReturnType<typeof createMockDb>, data: any[]) => {
  mocks.selectWhereFn.mockReturnValue({ limit: mocks.limitFn })
  mocks.limitFn.mockResolvedValue(data)
}

/**
 * Helper: configure select chain for methods that DON'T call `.limit()`.
 * selectWhereFn resolves directly to the data array.
 */
const setupSelectNoLimit = (mocks: ReturnType<typeof createMockDb>, data: any[]) => {
  mocks.selectWhereFn.mockResolvedValue(data)
}

/**
 * Helper: configure select chain for methods with optional `.limit()` / `.offset()`.
 * Returns a thenable object that also exposes `.limit()` and `.offset()` for chaining.
 * Used by getOrgMembers/getProjectMembers which optionally chain pagination.
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

/**
 * Builds a fake role row that looks like what the DB would return.
 */
const fakeRoleRow = (overrides: Record<string, any> = {}) => ({
  id: `role-1`,
  name: `member`,
  type: `member`,
  userId: `user-1`,
  orgId: `org-1`,
  projectId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Role service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: RoleService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { Role } = await import(`./role`)
    service = new Role({
      db: mocks.db,
    } as any)
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate with the roles table`, () => {
      expect(service).toBeDefined()
      expect(service.name).toBe(`roles`)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create a RoleModel from data`, () => {
      const row = fakeRoleRow()
      const result = service.model(row as any)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
      expect(result.userId).toBe(`user-1`)
      expect(result.orgId).toBe(`org-1`)
      expect(result.type).toBe(`member`)
    })
  })

  // ---------- getOrgRole ----------
  describe(`getOrgRole`, () => {
    it(`should return model when role is found`, async () => {
      const row = fakeRoleRow()
      setupSelectWithLimit(mocks, [row])

      const result = await service.getOrgRole(`user-1`, `org-1`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.userId).toBe(`user-1`)
      expect(result.data.orgId).toBe(`org-1`)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return null data when role is not found`, async () => {
      setupSelectWithLimit(mocks, [])

      const result = await service.getOrgRole(`user-1`, `org-missing`)

      expect(result.data).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockReturnValue({ limit: mocks.limitFn })
      mocks.limitFn.mockRejectedValue(new Error(`DB connection failed`))

      const result = await service.getOrgRole(`user-1`, `org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB connection failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getProjectRole ----------
  describe(`getProjectRole`, () => {
    it(`should return model when role is found`, async () => {
      const row = fakeRoleRow({ orgId: null, projectId: `proj-1` })
      setupSelectWithLimit(mocks, [row])

      const result = await service.getProjectRole(`user-1`, `proj-1`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.projectId).toBe(`proj-1`)

      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return null data when role is not found`, async () => {
      setupSelectWithLimit(mocks, [])

      const result = await service.getProjectRole(`user-1`, `proj-missing`)

      expect(result.data).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockReturnValue({ limit: mocks.limitFn })
      mocks.limitFn.mockRejectedValue(new Error(`Query timeout`))

      const result = await service.getProjectRole(`user-1`, `proj-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Query timeout`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getUserRoles ----------
  describe(`getUserRoles`, () => {
    it(`should return array of models`, async () => {
      const rows = [
        fakeRoleRow({ id: `role-1`, orgId: `org-1`, projectId: null }),
        fakeRoleRow({ id: `role-2`, orgId: null, projectId: `proj-1` }),
      ]
      setupSelectNoLimit(mocks, rows)

      const result = await service.getUserRoles(`user-1`)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[1]._isModel).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when no roles found`, async () => {
      setupSelectNoLimit(mocks, [])

      const result = await service.getUserRoles(`user-no-roles`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Connection reset`))

      const result = await service.getUserRoles(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Connection reset`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getOrgMembers ----------
  describe(`getOrgMembers`, () => {
    it(`should return array of models for the org`, async () => {
      const rows = [
        fakeRoleRow({ id: `role-1`, userId: `user-1`, type: `owner` }),
        fakeRoleRow({ id: `role-2`, userId: `user-2`, type: `member` }),
        fakeRoleRow({ id: `role-3`, userId: `user-3`, type: `admin` }),
      ]
      setupSelectChainable(mocks, rows)

      const result = await service.getOrgMembers(`org-1`)

      expect(result.data).toHaveLength(3)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[0].type).toBe(`owner`)
      expect(result.data[2].type).toBe(`admin`)
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when org has no members`, async () => {
      setupSelectChainable(mocks, [])

      const result = await service.getOrgMembers(`org-empty`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should apply limit and offset when provided`, async () => {
      const rows = [fakeRoleRow({ id: `role-1` })]
      setupSelectChainable(mocks, rows)

      const result = await service.getOrgMembers(`org-1`, { limit: 10, offset: 5 })

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).toHaveBeenCalledWith(10)
      expect(mocks.offsetFn).toHaveBeenCalledWith(5)
    })

    it(`should work without pagination params (backward compat)`, async () => {
      const rows = [fakeRoleRow({ id: `role-1` })]
      setupSelectChainable(mocks, rows)

      const result = await service.getOrgMembers(`org-1`)

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).not.toHaveBeenCalled()
      expect(mocks.offsetFn).not.toHaveBeenCalled()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Table not found`))

      const result = await service.getOrgMembers(`org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Table not found`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getOrgOwner ----------
  describe(`getOrgOwner`, () => {
    it(`should return model when owner is found`, async () => {
      const row = fakeRoleRow({ type: `owner`, userId: `user-owner` })
      setupSelectWithLimit(mocks, [row])

      const result = await service.getOrgOwner(`org-1`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.type).toBe(`owner`)
      expect(result.data.userId).toBe(`user-owner`)

      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return undefined when no owner found`, async () => {
      setupSelectWithLimit(mocks, [])

      const result = await service.getOrgOwner(`org-no-owner`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockReturnValue({ limit: mocks.limitFn })
      mocks.limitFn.mockRejectedValue(new Error(`Permission denied`))

      const result = await service.getOrgOwner(`org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Permission denied`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getProjectMembers ----------
  describe(`getProjectMembers`, () => {
    it(`should return array of models for the project`, async () => {
      const rows = [
        fakeRoleRow({
          id: `role-1`,
          userId: `user-1`,
          orgId: null,
          projectId: `proj-1`,
          type: `admin`,
        }),
        fakeRoleRow({
          id: `role-2`,
          userId: `user-2`,
          orgId: null,
          projectId: `proj-1`,
          type: `member`,
        }),
      ]
      setupSelectChainable(mocks, rows)

      const result = await service.getProjectMembers(`proj-1`)

      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[1]._isModel).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when project has no members`, async () => {
      setupSelectChainable(mocks, [])

      const result = await service.getProjectMembers(`proj-empty`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should apply limit and offset when provided`, async () => {
      const rows = [fakeRoleRow({ id: `role-1`, orgId: null, projectId: `proj-1` })]
      setupSelectChainable(mocks, rows)

      const result = await service.getProjectMembers(`proj-1`, { limit: 10, offset: 5 })

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).toHaveBeenCalledWith(10)
      expect(mocks.offsetFn).toHaveBeenCalledWith(5)
    })

    it(`should work without pagination params (backward compat)`, async () => {
      const rows = [fakeRoleRow({ id: `role-1`, orgId: null, projectId: `proj-1` })]
      setupSelectChainable(mocks, rows)

      const result = await service.getProjectMembers(`proj-1`)

      expect(result.data).toHaveLength(1)
      expect(mocks.limitFn).not.toHaveBeenCalled()
      expect(mocks.offsetFn).not.toHaveBeenCalled()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Relation does not exist`))

      const result = await service.getProjectMembers(`proj-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Relation does not exist`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- isOrgMember ----------
  describe(`isOrgMember`, () => {
    it(`should return true when user has a role in the org`, async () => {
      const row = fakeRoleRow()
      setupSelectWithLimit(mocks, [row])

      const result = await service.isOrgMember(`user-1`, `org-1`)

      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return false when user has no role in the org`, async () => {
      setupSelectWithLimit(mocks, [])

      const result = await service.isOrgMember(`user-1`, `org-not-member`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockReturnValue({ limit: mocks.limitFn })
      mocks.limitFn.mockRejectedValue(new Error(`Deadlock detected`))

      const result = await service.isOrgMember(`user-1`, `org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Deadlock detected`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- isProjectMember ----------
  describe(`isProjectMember`, () => {
    it(`should return true when user has a role in the project`, async () => {
      const row = fakeRoleRow({ orgId: null, projectId: `proj-1` })
      setupSelectWithLimit(mocks, [row])

      const result = await service.isProjectMember(`user-1`, `proj-1`)

      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should return false when user has no role in the project`, async () => {
      setupSelectWithLimit(mocks, [])

      const result = await service.isProjectMember(`user-1`, `proj-not-member`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockReturnValue({ limit: mocks.limitFn })
      mocks.limitFn.mockRejectedValue(new Error(`SSL connection lost`))

      const result = await service.isProjectMember(`user-1`, `proj-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`SSL connection lost`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- updateOrgRole ----------
  describe(`updateOrgRole`, () => {
    it(`should return model when update succeeds`, async () => {
      const row = fakeRoleRow({ type: `admin` })
      mocks.updateReturningFn.mockResolvedValue([row])

      const before = Date.now()
      const result = await service.updateOrgRole(`user-1`, `org-1`, `admin`)
      const after = Date.now()

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.type).toBe(`admin`)

      // Verify set() was called with type and updatedAt
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.type).toBe(`admin`)
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(setArg.updatedAt.getTime()).toBeLessThanOrEqual(after)
    })

    it(`should return undefined when no matching role found`, async () => {
      mocks.updateReturningFn.mockResolvedValue([])

      const result = await service.updateOrgRole(`user-1`, `org-not-exists`, `admin`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.updateReturningFn.mockRejectedValue(new Error(`Constraint violation`))

      const result = await service.updateOrgRole(`user-1`, `org-1`, `admin`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Constraint violation`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- updateProjectRole ----------
  describe(`updateProjectRole`, () => {
    it(`should return model when update succeeds`, async () => {
      const row = fakeRoleRow({ orgId: null, projectId: `proj-1`, type: `editor` })
      mocks.updateReturningFn.mockResolvedValue([row])

      const before = Date.now()
      const result = await service.updateProjectRole(`user-1`, `proj-1`, `editor`)
      const after = Date.now()

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.type).toBe(`editor`)

      // Verify set() was called with type and updatedAt
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.type).toBe(`editor`)
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(setArg.updatedAt.getTime()).toBeLessThanOrEqual(after)
    })

    it(`should return undefined when no matching role found`, async () => {
      mocks.updateReturningFn.mockResolvedValue([])

      const result = await service.updateProjectRole(
        `user-1`,
        `proj-not-exists`,
        `editor`
      )

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.updateReturningFn.mockRejectedValue(new Error(`Update failed`))

      const result = await service.updateProjectRole(`user-1`, `proj-1`, `editor`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Update failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- removeFromOrg ----------
  describe(`removeFromOrg`, () => {
    it(`should return true when role is deleted`, async () => {
      const row = fakeRoleRow()
      mocks.deleteReturningFn.mockResolvedValue([row])

      const result = await service.removeFromOrg(`user-1`, `org-1`)

      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
      expect(mocks.deleteReturningFn).toHaveBeenCalledOnce()
    })

    it(`should return false when no role found to delete`, async () => {
      mocks.deleteReturningFn.mockResolvedValue([])

      const result = await service.removeFromOrg(`user-1`, `org-not-member`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.deleteReturningFn.mockRejectedValue(new Error(`Foreign key violation`))

      const result = await service.removeFromOrg(`user-1`, `org-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Foreign key violation`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- removeFromProject ----------
  describe(`removeFromProject`, () => {
    it(`should return true when role is deleted`, async () => {
      const row = fakeRoleRow({ orgId: null, projectId: `proj-1` })
      mocks.deleteReturningFn.mockResolvedValue([row])

      const result = await service.removeFromProject(`user-1`, `proj-1`)

      expect(result.data).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
      expect(mocks.deleteReturningFn).toHaveBeenCalledOnce()
    })

    it(`should return false when no role found to delete`, async () => {
      mocks.deleteReturningFn.mockResolvedValue([])

      const result = await service.removeFromProject(`user-1`, `proj-not-member`)

      expect(result.data).toBe(false)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.deleteReturningFn.mockRejectedValue(new Error(`Cascade delete failure`))

      const result = await service.removeFromProject(`user-1`, `proj-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Cascade delete failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getUserOrgs ----------
  describe(`getUserOrgs`, () => {
    it(`should return array of org IDs`, async () => {
      const rows = [{ orgId: `org-1` }, { orgId: `org-2` }, { orgId: `org-3` }]
      setupSelectNoLimit(mocks, rows)

      const result = await service.getUserOrgs(`user-1`)

      expect(result.data).toEqual([`org-1`, `org-2`, `org-3`])
      expect(result.error).toBeUndefined()

      // Verify select was called with column selection
      expect(mocks.selectFn).toHaveBeenCalledOnce()
    })

    it(`should filter out null orgId values`, async () => {
      const rows = [
        { orgId: `org-1` },
        { orgId: null },
        { orgId: `org-3` },
        { orgId: null },
      ]
      setupSelectNoLimit(mocks, rows)

      const result = await service.getUserOrgs(`user-1`)

      expect(result.data).toEqual([`org-1`, `org-3`])
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when user has no orgs`, async () => {
      setupSelectNoLimit(mocks, [])

      const result = await service.getUserOrgs(`user-no-orgs`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Query cancelled`))

      const result = await service.getUserOrgs(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Query cancelled`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- getUserProjects ----------
  describe(`getUserProjects`, () => {
    it(`should return array of project IDs`, async () => {
      const rows = [{ projectId: `proj-1` }, { projectId: `proj-2` }]
      setupSelectNoLimit(mocks, rows)

      const result = await service.getUserProjects(`user-1`)

      expect(result.data).toEqual([`proj-1`, `proj-2`])
      expect(result.error).toBeUndefined()

      expect(mocks.selectFn).toHaveBeenCalledOnce()
    })

    it(`should filter out null projectId values`, async () => {
      const rows = [
        { projectId: null },
        { projectId: `proj-2` },
        { projectId: null },
        { projectId: `proj-4` },
      ]
      setupSelectNoLimit(mocks, rows)

      const result = await service.getUserProjects(`user-1`)

      expect(result.data).toEqual([`proj-2`, `proj-4`])
      expect(result.error).toBeUndefined()
    })

    it(`should return empty array when user has no projects`, async () => {
      setupSelectNoLimit(mocks, [])

      const result = await service.getUserProjects(`user-no-projects`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Statement timeout`))

      const result = await service.getUserProjects(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Statement timeout`)
      expect(result.data).toBeUndefined()
    })
  })
})
