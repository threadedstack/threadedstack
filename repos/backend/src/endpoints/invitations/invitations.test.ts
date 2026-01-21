import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { invitations } from './invitations'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { config } from '@TBE/configs/backend.config'
import { PolarService } from '@TBE/services/payments'
import { ERoleType, Invitation } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

describe(`Invitations endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>
  const mockApp = {
    locals: {
      config,
      payments: new PolarService(config.payments),
      db: {
        services: {
          invitation: {
            getPendingByOrg: vi.fn(),
            getAllByOrg: vi.fn(),
            getPendingByEmail: vi.fn(),
            getByToken: vi.fn(),
            get: vi.fn(),
            accept: vi.fn(),
            revoke: vi.fn(),
          },
          role: {
            create: vi.fn(),
            getOrgRole: vi.fn(),
          },
        },
      },
    },
  } as unknown as TApp

  const getEndpointCfg = (endpoint: TEndpoint): TEndpointConfig =>
    isFunc(endpoint) ? endpoint(mockApp) : endpoint

  beforeEach(() => {
    mockJson = vi.fn()
    mockSetHeader = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response)

    mockRes = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
    } as Partial<Response>

    mockReq = {
      app: mockApp,
      user: {
        id: `test-user-id`,
        email: `test@example.com`,
      } as any,
      params: {},
      body: {},
      query: {},
    }

    vi.clearAllMocks()
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(invitations.path).toBe(`/invitations`)
      expect(invitations.method).toBe(`use`)
      expect(invitations.endpoints).toBeDefined()
      expect(invitations.endpoints?.accept).toBeDefined()
      expect(invitations.endpoints?.me).toBeDefined()
      expect(invitations.endpoints?.list).toBeDefined()
      expect(invitations.endpoints?.revoke).toBeDefined()
    })
  })

  describe(`GET /_/invitations/org/:orgId - List Invitations`, () => {
    const ep = getEndpointCfg(invitations.endpoints?.list)

    it(`should return 200 with pending invitations by default`, async () => {
      const mockInvitations = [
        new Invitation({
          id: `inv-1`,
          email: `user1@example.com`,
          orgId: `org-1`,
          roleType: ERoleType.member,
          status: `pending`,
        }),
      ]
      mockReq.params = { orgId: `org-1` }
      mockReq.query = {}

      const mockGetPending = mockReq.app?.locals.db.services.invitation
        .getPendingByOrg as ReturnType<typeof vi.fn>
      mockGetPending.mockResolvedValue({ data: mockInvitations })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetPending).toHaveBeenCalledWith(`org-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockInvitations,
      })
    })

    it(`should return all invitations when status is 'all'`, async () => {
      const mockInvitations = [
        new Invitation({
          id: `inv-1`,
          email: `user1@example.com`,
          orgId: `org-1`,
          roleType: ERoleType.member,
          status: `pending`,
        }),
        new Invitation({
          id: `inv-2`,
          email: `user2@example.com`,
          orgId: `org-1`,
          roleType: ERoleType.member,
          status: `accepted`,
        }),
      ]
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { status: `all` }

      const mockGetAll = mockReq.app?.locals.db.services.invitation
        .getAllByOrg as ReturnType<typeof vi.fn>
      mockGetAll.mockResolvedValue({ data: mockInvitations })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetAll).toHaveBeenCalledWith(`org-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockInvitations,
      })
    })

    it(`should filter by specific status when provided`, async () => {
      const mockInvitations = [
        new Invitation({
          id: `inv-1`,
          email: `user1@example.com`,
          orgId: `org-1`,
          roleType: ERoleType.member,
          status: `accepted`,
        }),
        new Invitation({
          id: `inv-2`,
          email: `user2@example.com`,
          orgId: `org-1`,
          roleType: ERoleType.member,
          status: `revoked`,
        }),
      ]
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { status: `accepted` }

      const mockGetAll = mockReq.app?.locals.db.services.invitation
        .getAllByOrg as ReturnType<typeof vi.fn>
      mockGetAll.mockResolvedValue({ data: mockInvitations })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const responseData = mockJson.mock.calls[0][0].data
      expect(responseData).toHaveLength(1)
      expect(responseData[0].status).toBe(`accepted`)
    })

    it(`should return 500 on database error for pending`, async () => {
      mockReq.params = { orgId: `org-1` }
      mockReq.query = {}

      const mockGetPending = mockReq.app?.locals.db.services.invitation
        .getPendingByOrg as ReturnType<typeof vi.fn>
      mockGetPending.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })

    it(`should return 500 on database error for all`, async () => {
      mockReq.params = { orgId: `org-1` }
      mockReq.query = { status: `all` }

      const mockGetAll = mockReq.app?.locals.db.services.invitation
        .getAllByOrg as ReturnType<typeof vi.fn>
      mockGetAll.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })
  })

  describe(`GET /_/invitations/me - Get Pending Invitations`, () => {
    const ep = getEndpointCfg(invitations.endpoints?.me)

    it(`should return 200 with pending invitations for current user`, async () => {
      const mockInvitations = [
        new Invitation({
          id: `inv-1`,
          email: `test@example.com`,
          orgId: `org-1`,
          roleType: ERoleType.member,
          status: `pending`,
        }),
      ]

      const mockGetByEmail = mockReq.app?.locals.db.services.invitation
        .getPendingByEmail as ReturnType<typeof vi.fn>
      mockGetByEmail.mockResolvedValue({ data: mockInvitations })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetByEmail).toHaveBeenCalledWith(`test@example.com`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockInvitations })
    })

    it(`should throw 401 when user is not logged in`, async () => {
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `You must be logged in`
      )
    })

    it(`should throw 401 when user has no email`, async () => {
      mockReq.user = { id: `test-user-id` } as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `You must be logged in`
      )
    })

    it(`should throw 500 on database error`, async () => {
      const mockGetByEmail = mockReq.app?.locals.db.services.invitation
        .getPendingByEmail as ReturnType<typeof vi.fn>
      mockGetByEmail.mockResolvedValue({ error: new Error(`Database error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database error`
      )
    })
  })

  describe(`POST /_/invitations/accept - Accept Invitation`, () => {
    const ep = getEndpointCfg(invitations.endpoints?.accept)

    it(`should return 200 and create role when accepting valid invitation`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `test@example.com`,
        orgId: `org-1`,
        roleType: ERoleType.member,
        status: `pending`,
        isPending: () => true,
        isExpired: () => false,
        isRevoked: () => false,
        isAccepted: () => false,
      }
      const mockRole = {
        id: `role-1`,
        userId: `test-user-id`,
        orgId: `org-1`,
        type: ERoleType.member,
      }

      mockReq.body = { token: `valid-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockCreateRole = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >
      const mockAccept = mockReq.app?.locals.db.services.invitation.accept as ReturnType<
        typeof vi.fn
      >

      mockGetByToken.mockResolvedValue({ data: mockInvitation })
      mockGetOrgRole.mockResolvedValue({ data: null })
      mockCreateRole.mockResolvedValue({ data: mockRole })
      mockAccept.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetByToken).toHaveBeenCalledWith(`valid-token`)
      expect(mockCreateRole).toHaveBeenCalledWith({
        userId: `test-user-id`,
        orgId: `org-1`,
        type: ERoleType.member,
      })
      expect(mockAccept).toHaveBeenCalledWith(`inv-1`, `test-user-id`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockRole,
        message: `Successfully joined the organization`,
      })
    })

    it(`should return 400 when token is missing`, async () => {
      mockReq.body = {}

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `Token is required` })
    })

    it(`should return 401 when user is not logged in`, async () => {
      mockReq.body = { token: `valid-token` }
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: `You must be logged in to accept an invitation`,
      })
    })

    it(`should return 404 when invitation token is invalid`, async () => {
      mockReq.body = { token: `invalid-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      mockGetByToken.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Invalid invitation token` })
    })

    it(`should return 400 when invitation is expired`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `test@example.com`,
        orgId: `org-1`,
        status: `expired`,
        isPending: () => false,
        isExpired: () => true,
        isRevoked: () => false,
        isAccepted: () => false,
      }
      mockReq.body = { token: `expired-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      mockGetByToken.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `This invitation has expired` })
    })

    it(`should return 400 when invitation is revoked`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `test@example.com`,
        orgId: `org-1`,
        status: `revoked`,
        isPending: () => false,
        isExpired: () => false,
        isRevoked: () => true,
        isAccepted: () => false,
      }
      mockReq.body = { token: `revoked-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      mockGetByToken.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: `This invitation has been revoked` })
    })

    it(`should return 400 when invitation is already accepted`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `test@example.com`,
        orgId: `org-1`,
        status: `accepted`,
        isPending: () => false,
        isExpired: () => false,
        isRevoked: () => false,
        isAccepted: () => true,
      }
      mockReq.body = { token: `accepted-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      mockGetByToken.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `This invitation has already been accepted`,
      })
    })

    it(`should return 403 when email does not match`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `other@example.com`,
        orgId: `org-1`,
        roleType: ERoleType.member,
        status: `pending`,
        isPending: () => true,
      }
      mockReq.body = { token: `valid-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      mockGetByToken.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(403)
      expect(mockJson).toHaveBeenCalledWith({
        error: `This invitation was sent to other@example.com. You are logged in as test@example.com.`,
      })
    })

    it(`should return 400 when user is already a member`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `test@example.com`,
        orgId: `org-1`,
        roleType: ERoleType.member,
        status: `pending`,
        isPending: () => true,
      }
      mockReq.body = { token: `valid-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>

      mockGetByToken.mockResolvedValue({ data: mockInvitation })
      mockGetOrgRole.mockResolvedValue({ data: { id: `existing-role` } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `You are already a member of this organization`,
      })
    })

    it(`should return 500 when role creation fails`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `test@example.com`,
        orgId: `org-1`,
        roleType: ERoleType.member,
        status: `pending`,
        isPending: () => true,
      }
      mockReq.body = { token: `valid-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      const mockGetOrgRole = mockReq.app?.locals.db.services.role
        .getOrgRole as ReturnType<typeof vi.fn>
      const mockCreateRole = mockReq.app?.locals.db.services.role.create as ReturnType<
        typeof vi.fn
      >

      mockGetByToken.mockResolvedValue({ data: mockInvitation })
      mockGetOrgRole.mockResolvedValue({ data: null })
      mockCreateRole.mockResolvedValue({ error: new Error(`Role creation failed`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Role creation failed` })
    })

    it(`should return 500 when getByToken fails`, async () => {
      mockReq.body = { token: `valid-token` }

      const mockGetByToken = mockReq.app?.locals.db.services.invitation
        .getByToken as ReturnType<typeof vi.fn>
      mockGetByToken.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })
  })

  describe(`DELETE /_/invitations/:invitationId - Revoke Invitation`, () => {
    const ep = getEndpointCfg(invitations.endpoints?.revoke)

    it(`should return 200 when invitation is revoked successfully`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `user@example.com`,
        orgId: `org-1`,
        status: `pending`,
        isRevoked: () => false,
        isAccepted: () => false,
        isExpired: () => false,
      }
      const revokedInvitation = { ...mockInvitation, status: `revoked` }

      mockReq.params = { invitationId: `inv-1` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      const mockRevoke = mockReq.app?.locals.db.services.invitation.revoke as ReturnType<
        typeof vi.fn
      >

      mockGet.mockResolvedValue({ data: mockInvitation })
      mockRevoke.mockResolvedValue({ data: revokedInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGet).toHaveBeenCalledWith(`inv-1`)
      expect(mockRevoke).toHaveBeenCalledWith(`inv-1`, `test-user-id`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: revokedInvitation,
        message: `Invitation revoked successfully`,
      })
    })

    it(`should return 401 when user is not logged in`, async () => {
      mockReq.params = { invitationId: `inv-1` }
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({
        error: `You must be logged in to revoke an invitation`,
      })
    })

    it(`should return 404 when invitation not found`, async () => {
      mockReq.params = { invitationId: `nonexistent` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Invitation not found` })
    })

    it(`should return 400 when invitation is already revoked`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `user@example.com`,
        orgId: `org-1`,
        status: `revoked`,
        isRevoked: () => true,
        isAccepted: () => false,
        isExpired: () => false,
      }
      mockReq.params = { invitationId: `inv-1` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `This invitation has already been revoked`,
      })
    })

    it(`should return 400 when invitation is already accepted`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `user@example.com`,
        orgId: `org-1`,
        status: `accepted`,
        isRevoked: () => false,
        isAccepted: () => true,
        isExpired: () => false,
      }
      mockReq.params = { invitationId: `inv-1` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `This invitation has already been accepted. Use the role management endpoints to remove the user.`,
      })
    })

    it(`should return 400 when invitation is expired`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `user@example.com`,
        orgId: `org-1`,
        status: `expired`,
        isRevoked: () => false,
        isAccepted: () => false,
        isExpired: () => true,
      }
      mockReq.params = { invitationId: `inv-1` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ data: mockInvitation })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: `This invitation has already expired`,
      })
    })

    it(`should return 500 when get invitation fails`, async () => {
      mockReq.params = { invitationId: `inv-1` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      mockGet.mockResolvedValue({ error: new Error(`Database error`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Database error` })
    })

    it(`should return 500 when revoke fails`, async () => {
      const mockInvitation = {
        id: `inv-1`,
        email: `user@example.com`,
        orgId: `org-1`,
        status: `pending`,
        isRevoked: () => false,
        isAccepted: () => false,
        isExpired: () => false,
      }
      mockReq.params = { invitationId: `inv-1` }

      const mockGet = mockReq.app?.locals.db.services.invitation.get as ReturnType<
        typeof vi.fn
      >
      const mockRevoke = mockReq.app?.locals.db.services.invitation.revoke as ReturnType<
        typeof vi.fn
      >

      mockGet.mockResolvedValue({ data: mockInvitation })
      mockRevoke.mockResolvedValue({ error: new Error(`Revoke failed`) })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: `Revoke failed` })
    })
  })
})
