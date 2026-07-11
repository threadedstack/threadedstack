import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ERoleType } from '@tdsk/domain'
import { updateMemberRole } from './updateMemberRole'
import { config } from '@TBE/configs/backend.config'

const mockGetUserRole = vi.hoisted(() => vi.fn())
const mockGetOrgRole = vi.hoisted(() => vi.fn())
const mockUpdateOrgRole = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  getUserRole: mockGetUserRole,
}))

describe(`PUT /:orgId/members/:userId - Update member role`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  const buildApp = () =>
    ({
      locals: {
        config,
        db: {
          services: {
            role: {
              getOrgRole: mockGetOrgRole,
              updateOrgRole: mockUpdateOrgRole,
            },
          },
        },
      },
    }) as unknown as TApp

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserRole.mockResolvedValue(ERoleType.owner)
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.member } })
    mockUpdateOrgRole.mockResolvedValue({ data: { type: ERoleType.admin } })

    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: { id: `caller-1`, email: `caller@example.com` } as any,
      params: { orgId: `org-1`, userId: `user-1` },
      body: { roleType: ERoleType.admin },
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(updateMemberRole.path).toBe(`/:orgId/members/:userId`)
    expect(updateMemberRole.method).toBe(`put`)
    expect(typeof updateMemberRole.action).toBe(`function`)
  })

  it(`should throw 401 when caller is not authenticated`, async () => {
    mockReq.user = undefined

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Authentication required`)
  })

  it(`should throw 400 when roleType is missing`, async () => {
    mockReq.body = {}

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Role type is required`)
  })

  it(`should throw 400 when roleType is invalid`, async () => {
    mockReq.body = { roleType: `superadmin` }

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Invalid role type`)
  })

  it(`should throw 403 when caller tries to assign a role at or above their own`, async () => {
    mockGetUserRole.mockResolvedValue(ERoleType.admin)
    mockReq.body = { roleType: ERoleType.owner }

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`You cannot assign owner role`)
    expect(mockGetOrgRole).not.toHaveBeenCalled()
  })

  it(`should throw 500 when fetching the target member's role errors`, async () => {
    mockGetOrgRole.mockResolvedValue({ error: { message: `db down` } })

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`db down`)
  })

  it(`should throw 404 when the target member does not exist`, async () => {
    mockGetOrgRole.mockResolvedValue({ data: null })

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`Org member not found`)
  })

  it(`should throw 403 when caller tries to modify a member with an equal or higher role`, async () => {
    mockGetUserRole.mockResolvedValue(ERoleType.admin)
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.owner } })
    mockReq.body = { roleType: ERoleType.member }

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`equal or higher roles`)
    expect(mockUpdateOrgRole).not.toHaveBeenCalled()
  })

  it(`should update the role and return 200 on success`, async () => {
    await updateMemberRole.action(mockReq as TRequest, mockRes as Response)

    expect(mockUpdateOrgRole).toHaveBeenCalledWith(`user-1`, `org-1`, ERoleType.admin)
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ data: { type: ERoleType.admin } })
  })

  it(`should throw 500 when updating the role errors`, async () => {
    mockUpdateOrgRole.mockResolvedValue({ error: { message: `write failed` } })

    await expect(
      updateMemberRole.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`write failed`)
  })

  it(`allows a super admin to assign the owner role`, async () => {
    mockGetUserRole.mockResolvedValue(ERoleType.super)
    mockGetOrgRole.mockResolvedValue({ data: { type: ERoleType.owner } })
    mockReq.body = { roleType: ERoleType.owner }

    await updateMemberRole.action(mockReq as TRequest, mockRes as Response)

    expect(mockUpdateOrgRole).toHaveBeenCalledWith(`user-1`, `org-1`, ERoleType.owner)
    expect(mockStatus).toHaveBeenCalledWith(200)
  })
})
