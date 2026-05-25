import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType } from '@tdsk/domain'
import { addOrgMember } from './addOrgMember'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments'

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
  getUserRole: vi.fn().mockResolvedValue(ERoleType.owner),
}))

vi.mock(`@TBE/utils/logger`, () => ({
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

describe(`POST /:orgId/members - Add org member`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () => {
    return {
      locals: {
        config,
        payments: new PaymentsService(config.payments),
        db: {
          services: {
            org: {
              get: vi.fn().mockResolvedValue({ data: { id: `org-1`, name: `Test Org` } }),
            },
            user: {
              get: vi.fn().mockResolvedValue({
                data: { id: `user-2`, email: `user2@example.com` },
              }),
            },
            role: {
              create: vi.fn(),
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.admin } }),
              getProjectRole: vi
                .fn()
                .mockResolvedValue({ data: { type: ERoleType.admin } }),
              isOrgMember: vi.fn().mockResolvedValue({ data: true }),
            },
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
      params: { orgId: `org-1` },
      body: {},
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(addOrgMember.path).toBe(`/:orgId/members`)
    expect(addOrgMember.method).toBe(`post`)
    expect(typeof addOrgMember.action).toBe(`function`)
  })

  it(`should accept role from body and map it to type`, async () => {
    const createdRole = {
      id: `role-new`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.admin,
    }

    const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
      typeof vi.fn
    >
    mockRoleCreate.mockResolvedValue({ data: createdRole })
    mockReq.body = { userId: `user-2`, roleType: ERoleType.admin }

    await addOrgMember.action(mockReq as TRequest, mockRes as Response)

    expect(mockRoleCreate).toHaveBeenCalledWith({
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.admin,
    })
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: createdRole })
  })

  it(`should default to ERoleType.member when roleType is not provided`, async () => {
    const createdRole = {
      id: `role-new`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }

    const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
      typeof vi.fn
    >
    mockRoleCreate.mockResolvedValue({ data: createdRole })
    mockReq.body = { userId: `user-2` }

    await addOrgMember.action(mockReq as TRequest, mockRes as Response)

    expect(mockRoleCreate).toHaveBeenCalledWith({
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    })
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`should correctly destructure roleType from body aliased to type`, async () => {
    const createdRole = {
      id: `role-new`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }

    const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
      typeof vi.fn
    >
    mockRoleCreate.mockResolvedValue({ data: createdRole })
    mockReq.body = { userId: `user-2`, roleType: ERoleType.member }

    await addOrgMember.action(mockReq as TRequest, mockRes as Response)

    // Verify the field mapping: body.role -> type parameter in create call
    const createArg = mockRoleCreate.mock.calls[0][0]
    expect(createArg.type).toBe(ERoleType.member)
    // Ensure role is not passed as-is (it's mapped to type)
    expect(createArg.role).toBeUndefined()
  })

  it(`should throw 401 when user is not authenticated`, async () => {
    mockReq.user = undefined

    await expect(
      addOrgMember.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Authentication required`)
  })

  it(`should throw 400 when userId is missing from body`, async () => {
    mockReq.body = { roleType: ERoleType.member }

    await expect(
      addOrgMember.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`userId is required`)
  })

  it(`should throw 404 when org does not exist`, async () => {
    const mockOrgGet = mockReq.app?.locals.db.services.org.get as ReturnType<typeof vi.fn>
    mockOrgGet.mockResolvedValue({ data: null })
    mockReq.body = { userId: `user-2` }

    await expect(
      addOrgMember.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Org not found`)
  })

  it(`should throw 404 when user does not exist`, async () => {
    const mockUserGet = mockReq.app?.locals.db.services.user.get as ReturnType<
      typeof vi.fn
    >
    mockUserGet.mockResolvedValue({ data: null })
    mockReq.body = { userId: `user-nonexistent` }

    await expect(
      addOrgMember.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`User not found`)
  })

  it(`should throw 500 when role creation fails`, async () => {
    const mockRoleCreate = mockReq.app?.locals.db.services.role.create as ReturnType<
      typeof vi.fn
    >
    mockRoleCreate.mockResolvedValue({ error: new Error(`Create failed`) })
    mockReq.body = { userId: `user-2` }

    await expect(
      addOrgMember.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Create failed`)
  })
})
