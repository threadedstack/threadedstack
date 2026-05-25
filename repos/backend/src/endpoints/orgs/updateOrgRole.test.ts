import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType } from '@tdsk/domain'
import { updateOrgRole } from './updateOrgRole'
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

describe(`PUT /:orgId/roles/:roleId - Update org role`, () => {
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
            role: {
              get: vi.fn(),
              update: vi.fn(),
              getOrgRole: vi.fn().mockResolvedValue({ data: { type: ERoleType.admin } }),
              getProjectRole: vi
                .fn()
                .mockResolvedValue({ data: { type: ERoleType.admin } }),
            },
          },
        },
      },
    } as unknown as TApp
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

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
      params: { orgId: `org-1`, roleId: `role-1` },
      body: {},
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(updateOrgRole.path).toBe(`/:orgId/roles/:roleId`)
    expect(updateOrgRole.method).toBe(`put`)
    expect(typeof updateOrgRole.action).toBe(`function`)
  })

  it(`should accept roleType directly from request body`, async () => {
    const existingRole = {
      id: `role-1`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }
    const updatedRole = { ...existingRole, type: ERoleType.admin }

    const mockRoleGet = mockReq.app?.locals.db.services.role.get as ReturnType<
      typeof vi.fn
    >
    const mockRoleUpdate = mockReq.app?.locals.db.services.role.update as ReturnType<
      typeof vi.fn
    >
    mockRoleGet.mockResolvedValue({ data: existingRole })
    mockRoleUpdate.mockResolvedValue({ data: updatedRole })
    mockReq.body = { roleType: ERoleType.admin }

    await updateOrgRole.action(mockReq as TRequest, mockRes as Response)

    expect(mockRoleUpdate).toHaveBeenCalledWith({
      ...existingRole,
      type: ERoleType.admin,
    })
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: updatedRole })
  })

  it(`should update role with provided roleType value`, async () => {
    const existingRole = {
      id: `role-1`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }
    const updatedRole = { ...existingRole, type: ERoleType.member }

    const mockRoleGet = mockReq.app?.locals.db.services.role.get as ReturnType<
      typeof vi.fn
    >
    const mockRoleUpdate = mockReq.app?.locals.db.services.role.update as ReturnType<
      typeof vi.fn
    >
    mockRoleGet.mockResolvedValue({ data: existingRole })
    mockRoleUpdate.mockResolvedValue({ data: updatedRole })
    mockReq.body = { roleType: ERoleType.member }

    await updateOrgRole.action(mockReq as TRequest, mockRes as Response)

    // Verify roleType from body is passed directly as type in the update
    const updateArg = mockRoleUpdate.mock.calls[0][0]
    expect(updateArg.type).toBe(ERoleType.member)
    expect(mockStatus).toHaveBeenCalledWith(200)
  })

  it(`should throw 400 when roleType is an invalid value`, async () => {
    mockReq.body = { roleType: `superadmin` }

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid role type`)
  })

  it(`should throw 403 when user cannot manage the target role`, async () => {
    const { getUserRole } = await import(`@TBE/utils/auth/checkPermission`)
    const mockGetUserRole = getUserRole as ReturnType<typeof vi.fn>
    mockGetUserRole.mockResolvedValueOnce(ERoleType.admin)
    mockReq.body = { roleType: ERoleType.admin }

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`You cannot assign admin role`)
  })

  it(`should throw 400 when roleType is missing from body`, async () => {
    mockReq.body = {}

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Role type is required`)
  })

  it(`should throw 404 when role is not found`, async () => {
    const mockRoleGet = mockReq.app?.locals.db.services.role.get as ReturnType<
      typeof vi.fn
    >
    mockRoleGet.mockResolvedValue({ data: null })
    mockReq.body = { roleType: ERoleType.admin }

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Role not found`)
  })

  it(`should throw 400 when role does not belong to the org`, async () => {
    const existingRole = {
      id: `role-1`,
      orgId: `org-different`,
      userId: `user-2`,
      type: ERoleType.member,
    }

    const mockRoleGet = mockReq.app?.locals.db.services.role.get as ReturnType<
      typeof vi.fn
    >
    mockRoleGet.mockResolvedValue({ data: existingRole })
    mockReq.body = { roleType: ERoleType.admin }

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Role does not belong to this organization`)
  })

  it(`should throw 500 when role fetch fails`, async () => {
    const mockRoleGet = mockReq.app?.locals.db.services.role.get as ReturnType<
      typeof vi.fn
    >
    mockRoleGet.mockResolvedValue({ error: new Error(`DB fetch error`) })
    mockReq.body = { roleType: ERoleType.admin }

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`DB fetch error`)
  })

  it(`should throw 500 when role update fails`, async () => {
    const existingRole = {
      id: `role-1`,
      orgId: `org-1`,
      userId: `user-2`,
      type: ERoleType.member,
    }

    const mockRoleGet = mockReq.app?.locals.db.services.role.get as ReturnType<
      typeof vi.fn
    >
    const mockRoleUpdate = mockReq.app?.locals.db.services.role.update as ReturnType<
      typeof vi.fn
    >
    mockRoleGet.mockResolvedValue({ data: existingRole })
    mockRoleUpdate.mockResolvedValue({ error: new Error(`Update failed`) })
    mockReq.body = { roleType: ERoleType.admin }

    await expect(
      updateOrgRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Update failed`)
  })
})
