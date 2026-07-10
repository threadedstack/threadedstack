import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType, ESandboxRuntime } from '@tdsk/domain'
import { createOrg } from './createOrg'
import { config } from '@TBE/configs/backend.config'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TDB/configs/db.config`, () => ({
  config: {
    logger: { label: `db`, level: `error` },
  },
}))

describe(`POST / - Create org`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockOrgCreate: ReturnType<typeof vi.fn>
  let mockRoleCreate: ReturnType<typeof vi.fn>
  let mockOrgDelete: ReturnType<typeof vi.fn>
  let mockSandboxCreate: ReturnType<typeof vi.fn>

  const buildApp = () => {
    mockOrgCreate = vi.fn().mockResolvedValue({ data: { id: `org-1`, name: `Test Org` } })
    mockRoleCreate = vi.fn().mockResolvedValue({ data: { id: `role-1` } })
    mockOrgDelete = vi.fn().mockResolvedValue({ data: { id: `org-1` } })
    mockSandboxCreate = vi.fn().mockResolvedValue({ data: { id: `sb-1` } })

    return {
      locals: {
        config,
        db: {
          services: {
            org: { create: mockOrgCreate, delete: mockOrgDelete },
            role: { create: mockRoleCreate },
            sandbox: { create: mockSandboxCreate },
          },
        },
      },
    } as unknown as TApp
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: {},
      body: { name: `Test Org` },
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(createOrg.path).toBe(`/`)
    expect(createOrg.method).toBe(`post`)
    expect(typeof createOrg.action).toBe(`function`)
  })

  it(`should throw 401 when user is not authenticated`, async () => {
    mockReq.user = undefined

    await expect(
      createOrg.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Authentication required`)

    expect(mockOrgCreate).not.toHaveBeenCalled()
  })

  it(`should throw 400 when org data is missing`, async () => {
    mockReq.body = undefined

    await expect(
      createOrg.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Org name is required`)
  })

  it(`should throw 400 when name is missing from body`, async () => {
    mockReq.body = { description: `no name here` }

    await expect(
      createOrg.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Org name is required`)
  })

  it(`should throw 500 when org creation fails`, async () => {
    mockOrgCreate.mockResolvedValue({ error: new Error(`DB write failed`) })

    await expect(
      createOrg.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`DB write failed`)

    expect(mockRoleCreate).not.toHaveBeenCalled()
    expect(mockSandboxCreate).not.toHaveBeenCalled()
  })

  it(`should create org with ownerId set from req.user`, async () => {
    await createOrg.action(mockReq as TRequest, mockRes as Response)

    expect(mockOrgCreate).toHaveBeenCalledWith({
      name: `Test Org`,
      ownerId: `test-user-id`,
    })
  })

  it(`should assign owner role to the creating user`, async () => {
    await createOrg.action(mockReq as TRequest, mockRes as Response)

    expect(mockRoleCreate).toHaveBeenCalledWith({
      userId: `test-user-id`,
      orgId: `org-1`,
      type: ERoleType.owner,
    })
  })

  it(`should roll back (delete org) and throw 500 when role assignment fails`, async () => {
    mockRoleCreate.mockResolvedValue({ error: new Error(`role create failed`) })

    await expect(
      createOrg.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Failed to assign owner role to organization`)

    expect(mockOrgDelete).toHaveBeenCalledWith(`org-1`)
    expect(mockSandboxCreate).not.toHaveBeenCalled()
  })

  it(`should seed a sandbox config for every sandbox preset`, async () => {
    await createOrg.action(mockReq as TRequest, mockRes as Response)

    const presetCount = Object.keys(ESandboxRuntime).length
    expect(mockSandboxCreate).toHaveBeenCalledTimes(presetCount)

    for (const call of mockSandboxCreate.mock.calls) {
      const sandbox = call[0]
      expect(sandbox.orgId).toBe(`org-1`)
      expect(sandbox.builtIn).toBe(true)
    }
  })

  it(`should return 201 with the org and userRole 'owner' when seeding succeeds`, async () => {
    await createOrg.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({
      data: { id: `org-1`, name: `Test Org`, userRole: ERoleType.owner },
    })
  })

  it(`should return 201 with warnings when a preset fails to seed but not abort other presets`, async () => {
    mockSandboxCreate.mockImplementation(
      async (sandbox: { config: { runtime: string } }) => {
        if (sandbox.config.runtime === ESandboxRuntime.codex) {
          return { error: new Error(`seed failed`) }
        }
        return { data: { id: `sb-${sandbox.config.runtime}` } }
      }
    )

    await createOrg.action(mockReq as TRequest, mockRes as Response)

    const presetCount = Object.keys(ESandboxRuntime).length
    expect(mockSandboxCreate).toHaveBeenCalledTimes(presetCount)
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({
      data: { id: `org-1`, name: `Test Org`, userRole: ERoleType.owner },
      warnings: [`Failed to seed default sandboxes: Codex`],
    })
  })

  it(`should not throw when all sandbox presets fail to seed, and lists every preset name in one warning`, async () => {
    mockSandboxCreate.mockResolvedValue({ error: new Error(`seed failed`) })

    await createOrg.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(201)
    const jsonArg = mockJson.mock.calls[0][0]
    expect(jsonArg.warnings).toHaveLength(1)
    const presetCount = Object.keys(ESandboxRuntime).length
    expect(jsonArg.warnings[0].split(`, `)).toHaveLength(presetCount)
  })
})
