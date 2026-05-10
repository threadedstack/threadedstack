import type { Provider as ProviderService } from './provider'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    getTableName: vi.fn(() => `providers`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the providers schema
vi.mock(`@TDB/schemas/providers`, () => ({
  providers: {
    id: { name: `id` },
    orgId: { name: `org_id` },
    name: { name: `name` },
    type: { name: `type` },
    brand: { name: `brand` },
  },
}))

/**
 * Creates a mock Drizzle-compatible DB object.
 * Includes services.provider.list for the validate() method.
 */
const createMockDb = () => {
  const returningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  const whereReturningFn = vi.fn()
  const whereFn = vi.fn(() => ({ returning: whereReturningFn }))
  const setFn = vi.fn(() => ({ where: whereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  const deleteWhereReturningFn = vi.fn()
  const deleteWhereMock = vi.fn(() => ({ returning: deleteWhereReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereMock }))

  const findFirst = vi.fn()
  const findMany = vi.fn()
  const listMock = vi.fn()

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      query: {
        providers: { findFirst, findMany },
      },
      services: {
        provider: { list: listMock },
      },
    } as any,
    returningFn,
    valuesFn,
    setFn,
    whereFn,
    whereReturningFn,
    deleteWhereMock,
    deleteWhereReturningFn,
    findFirst,
    findMany,
    insertFn,
    onConflictDoUpdateFn,
    listMock,
  }
}

describe(`Provider service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: ProviderService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { Provider } = await import(`./provider`)
    service = new Provider({
      db: mocks.db,
      config: {} as any,
    })
  })

  // ---------- validateType ----------
  describe(`validateType`, () => {
    it(`should return true for type 'ai'`, () => {
      expect(service.validateType(`ai`)).toBe(true)
    })

    it(`should return true for type 'git'`, () => {
      expect(service.validateType(`git`)).toBe(true)
    })

    it(`should return true for type 'auth'`, () => {
      expect(service.validateType(`auth`)).toBe(true)
    })

    it(`should return true for type 'storage'`, () => {
      expect(service.validateType(`storage`)).toBe(true)
    })

    it(`should return true for type 'docker'`, () => {
      expect(service.validateType(`docker`)).toBe(true)
    })

    it(`should throw for undefined type`, () => {
      expect(() => service.validateType(undefined)).toThrow(`Provider type is required`)
    })

    it(`should throw for empty string`, () => {
      expect(() => service.validateType(``)).toThrow(`Provider type is required`)
    })

    it(`should throw for invalid type string`, () => {
      expect(() => service.validateType(`invalid`)).toThrow(`Invalid provider type`)
    })

    it(`should include the invalid type name in error message`, () => {
      expect(() => service.validateType(`banana`)).toThrow(
        `Invalid provider type "banana"`
      )
    })

    it(`should list valid types in error message`, () => {
      expect(() => service.validateType(`bad`)).toThrow(`must be one of:`)
    })
  })

  // ---------- validateAI ----------
  describe(`validateAI`, () => {
    it(`should return undefined for non-AI type 'git'`, () => {
      expect(service.validateAI(`git`, `anthropic`)).toBeUndefined()
    })

    it(`should return undefined for non-AI type 'auth'`, () => {
      expect(service.validateAI(`auth`)).toBeUndefined()
    })

    it(`should return undefined for non-AI type 'storage'`, () => {
      expect(service.validateAI(`storage`)).toBeUndefined()
    })

    it(`should return undefined for undefined type`, () => {
      expect(service.validateAI(undefined)).toBeUndefined()
    })

    it(`should throw for type='ai' with no brand`, () => {
      expect(() => service.validateAI(`ai`)).toThrow()
    })

    it(`should throw for type='ai' with null brand`, () => {
      expect(() => service.validateAI(`ai`, null)).toThrow()
    })

    it(`should throw for type='ai' with invalid brand string`, () => {
      expect(() => service.validateAI(`ai`, `not-a-brand`)).toThrow()
    })

    it(`should not throw for type='ai' with valid brand 'anthropic'`, () => {
      expect(() => service.validateAI(`ai`, `anthropic`)).not.toThrow()
    })

    it(`should not throw for type='ai' with valid brand 'openai'`, () => {
      expect(() => service.validateAI(`ai`, `openai`)).not.toThrow()
    })

    it(`should include 'Got:' when invalid brand is provided`, () => {
      expect(() => service.validateAI(`ai`, `bad-brand`)).toThrow(`Got: "bad-brand"`)
    })

    it(`should not include 'Got:' when brand is missing`, () => {
      try {
        service.validateAI(`ai`)
        expect.unreachable(`should have thrown`)
      } catch (err: any) {
        expect(err.message).not.toContain(`Got:`)
      }
    })
  })

  // ---------- validateDocker ----------
  describe(`validateDocker`, () => {
    it(`should return undefined for non-docker type 'ai'`, () => {
      expect(service.validateDocker(`ai`, `ghcr`)).toBeUndefined()
    })

    it(`should return undefined for non-docker type 'git'`, () => {
      expect(service.validateDocker(`git`)).toBeUndefined()
    })

    it(`should return undefined for undefined type`, () => {
      expect(service.validateDocker(undefined)).toBeUndefined()
    })

    it(`should throw for type='docker' with no brand`, () => {
      expect(() => service.validateDocker(`docker`)).toThrow()
    })

    it(`should throw for type='docker' with null brand`, () => {
      expect(() => service.validateDocker(`docker`, null)).toThrow()
    })

    it(`should throw for type='docker' with invalid brand string`, () => {
      expect(() => service.validateDocker(`docker`, `acr`)).toThrow()
    })

    it(`should not throw for valid docker brands`, () => {
      expect(() => service.validateDocker(`docker`, `ghcr`)).not.toThrow()
      expect(() => service.validateDocker(`docker`, `gitlab`)).not.toThrow()
      expect(() => service.validateDocker(`docker`, `quay`)).not.toThrow()
      expect(() => service.validateDocker(`docker`, `dockerhub`)).not.toThrow()
      expect(() => service.validateDocker(`docker`, `custom`)).not.toThrow()
    })

    it(`should include 'Got:' when invalid brand is provided`, () => {
      expect(() => service.validateDocker(`docker`, `invalid`)).toThrow(`Got: "invalid"`)
    })

    it(`should not include 'Got:' when brand is missing`, () => {
      try {
        service.validateDocker(`docker`)
        expect.unreachable(`should have thrown`)
      } catch (err: any) {
        expect(err.message).not.toContain(`Got:`)
      }
    })
  })

  // ---------- validateGit ----------
  describe(`validateGit`, () => {
    it(`should return undefined for non-git type 'ai'`, () => {
      expect(service.validateGit(`ai`, `github`)).toBeUndefined()
    })

    it(`should return undefined for non-git type 'docker'`, () => {
      expect(service.validateGit(`docker`)).toBeUndefined()
    })

    it(`should return undefined for undefined type`, () => {
      expect(service.validateGit(undefined)).toBeUndefined()
    })

    it(`should throw for type='git' with no brand`, () => {
      expect(() => service.validateGit(`git`)).toThrow()
    })

    it(`should throw for type='git' with null brand`, () => {
      expect(() => service.validateGit(`git`, null)).toThrow()
    })

    it(`should throw for type='git' with invalid brand string`, () => {
      expect(() => service.validateGit(`git`, `svn`)).toThrow()
    })

    it(`should not throw for valid git brands`, () => {
      expect(() => service.validateGit(`git`, `github`)).not.toThrow()
      expect(() => service.validateGit(`git`, `gitlab`)).not.toThrow()
      expect(() => service.validateGit(`git`, `bitbucket`)).not.toThrow()
      expect(() => service.validateGit(`git`, `azure-devops`)).not.toThrow()
      expect(() => service.validateGit(`git`, `gitea`)).not.toThrow()
      expect(() => service.validateGit(`git`, `custom`)).not.toThrow()
    })

    it(`should include 'Got:' when invalid brand is provided`, () => {
      expect(() => service.validateGit(`git`, `invalid`)).toThrow(`Got: "invalid"`)
    })

    it(`should not include 'Got:' when brand is missing`, () => {
      try {
        service.validateGit(`git`)
        expect.unreachable(`should have thrown`)
      } catch (err: any) {
        expect(err.message).not.toContain(`Got:`)
      }
    })
  })

  // ---------- resolveAIBrand ----------
  describe(`resolveAIBrand`, () => {
    it(`should return brand for valid provider with brand 'anthropic'`, () => {
      const result = service.resolveAIBrand({
        name: `My Provider`,
        brand: `anthropic` as any,
      })
      expect(result).toBe(`anthropic`)
    })

    it(`should return brand for valid provider with brand 'openai'`, () => {
      const result = service.resolveAIBrand({ name: `Test`, brand: `openai` as any })
      expect(result).toBe(`openai`)
    })

    it(`should return brand for valid provider with brand 'google'`, () => {
      const result = service.resolveAIBrand({ name: `Test`, brand: `google` as any })
      expect(result).toBe(`google`)
    })

    it(`should throw for provider with no brand`, () => {
      expect(() => service.resolveAIBrand({ name: `Test` })).toThrow()
    })

    it(`should throw for provider with invalid brand`, () => {
      expect(() =>
        service.resolveAIBrand({ name: `Test`, brand: `invalid` as any })
      ).toThrow()
    })

    it(`should include provider name in error message`, () => {
      expect(() =>
        service.resolveAIBrand({ name: `MyProv`, brand: `bad` as any })
      ).toThrow(`Cannot determine AI provider for "MyProv"`)
    })

    it(`should use 'unnamed' when provider has no name`, () => {
      expect(() => service.resolveAIBrand({ brand: `bad` as any })).toThrow(
        `Cannot determine AI provider for "unnamed"`
      )
    })

    it(`should use 'unnamed' when provider name is null`, () => {
      expect(() => service.resolveAIBrand({ name: null, brand: `bad` as any })).toThrow(
        `Cannot determine AI provider for "unnamed"`
      )
    })
  })

  // ---------- validate ----------
  describe(`validate`, () => {
    const orgId = `org-1`

    it(`should return undefined when inputs is undefined`, async () => {
      const result = await service.validate({ orgId, inputs: undefined })
      expect(result).toBeUndefined()
    })

    it(`should return undefined when inputs is null`, async () => {
      const result = await service.validate({ orgId, inputs: null })
      expect(result).toBeUndefined()
    })

    it(`should return undefined when inputs is a string`, async () => {
      const result = await service.validate({ orgId, inputs: `not-an-array` })
      expect(result).toBeUndefined()
    })

    it(`should return empty array when inputs is empty array`, async () => {
      const result = await service.validate({ orgId, inputs: [] })
      expect(result).toEqual([])
    })

    it(`should return empty array when inputs has no valid IDs`, async () => {
      const result = await service.validate({ orgId, inputs: [{}, { id: `` }] })
      expect(result).toEqual([])
    })

    it(`should return pins when all providers are valid`, async () => {
      const pins = [{ id: `prov-1` }, { id: `prov-2` }]
      mocks.listMock.mockResolvedValue({
        data: [
          { id: `prov-1`, orgId, type: `ai` },
          { id: `prov-2`, orgId, type: `ai` },
        ],
        error: undefined,
      })

      const result = await service.validate({ orgId, inputs: pins, type: `ai` })
      expect(result).toEqual(pins)
    })

    it(`should return pins without type check when type is not provided`, async () => {
      const pins = [{ id: `prov-1` }]
      mocks.listMock.mockResolvedValue({
        data: [{ id: `prov-1`, orgId, type: `git` }],
        error: undefined,
      })

      const result = await service.validate({ orgId, inputs: pins })
      expect(result).toEqual(pins)
    })

    it(`should throw 404 when a provider is not found`, async () => {
      const pins = [{ id: `prov-missing` }]
      mocks.listMock.mockResolvedValue({ data: [], error: undefined })

      await expect(service.validate({ orgId, inputs: pins })).rejects.toThrow(
        `Provider prov-missing not found`
      )
    })

    it(`should throw 403 when provider belongs to different org`, async () => {
      const pins = [{ id: `prov-1` }]
      mocks.listMock.mockResolvedValue({
        data: [{ id: `prov-1`, orgId: `other-org`, type: `ai` }],
        error: undefined,
      })

      await expect(service.validate({ orgId, inputs: pins })).rejects.toThrow(
        `Provider prov-1 does not belong to organization org-1`
      )
    })

    it(`should throw 400 when provider has wrong type`, async () => {
      const pins = [{ id: `prov-1` }]
      mocks.listMock.mockResolvedValue({
        data: [{ id: `prov-1`, orgId, type: `git` }],
        error: undefined,
      })

      await expect(service.validate({ orgId, inputs: pins, type: `ai` })).rejects.toThrow(
        `Invalid git provider. Only ai providers are allowed`
      )
    })

    it(`should accept providers matching any type in an array`, async () => {
      const pins = [{ id: `prov-ai` }, { id: `prov-docker` }]
      mocks.listMock.mockResolvedValue({
        data: [
          { id: `prov-ai`, orgId, type: `ai` },
          { id: `prov-docker`, orgId, type: `docker` },
        ],
        error: undefined,
      })

      const result = await service.validate({
        orgId,
        inputs: pins,
        type: [`ai`, `docker`],
      })
      expect(result).toEqual(pins)
    })

    it(`should reject providers not matching any type in an array`, async () => {
      const pins = [{ id: `prov-1` }]
      mocks.listMock.mockResolvedValue({
        data: [{ id: `prov-1`, orgId, type: `git` }],
        error: undefined,
      })

      await expect(
        service.validate({ orgId, inputs: pins, type: [`ai`, `docker`] })
      ).rejects.toThrow(`Invalid git provider. Only ai, docker providers are allowed`)
    })

    it(`should throw 500 when db.services.provider.list returns error`, async () => {
      const pins = [{ id: `prov-1` }]
      mocks.listMock.mockResolvedValue({
        data: undefined,
        error: { message: `DB connection failed` },
      })

      await expect(service.validate({ orgId, inputs: pins })).rejects.toThrow(
        `DB connection failed`
      )
    })

    it(`should filter out inputs without valid string IDs before querying`, async () => {
      const inputs = [{ id: `prov-1` }, {}, { id: `` }, { id: `prov-2` }]
      mocks.listMock.mockResolvedValue({
        data: [
          { id: `prov-1`, orgId, type: `ai` },
          { id: `prov-2`, orgId, type: `ai` },
        ],
        error: undefined,
      })

      const result = await service.validate({ orgId, inputs })
      expect(result).toEqual([{ id: `prov-1` }, { id: `prov-2` }])
      expect(mocks.listMock).toHaveBeenCalledOnce()
    })
  })
})
