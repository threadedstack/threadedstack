import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { EVerificationStatus } from '@tdsk/domain'
import { getVerification } from './getVerification'
import { listVerifications } from './listVerifications'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

const verification = (overrides = {}) => ({
  id: `vf_1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  prNumber: 42,
  prUrl: `https://github.com/org/repo/pull/42`,
  mergeSha: `abc123def456`,
  probe: { kind: `health` },
  status: EVerificationStatus.pending,
  detail: null,
  revertPrUrl: null,
  escalationId: null,
  meta: null,
  ...overrides,
})

const build = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()
  const verificationSvc = {
    list: vi.fn(),
    get: vi.fn(),
  }
  const req = {
    app: { locals: { db: { services: { verification: verificationSvc } } } } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, verificationSvc }
}

describe(`Verification endpoints`, () => {
  it(`config paths/methods are correct`, () => {
    expect(listVerifications.path).toBe(`/`)
    expect(listVerifications.method).toBe(EPMethod.Get)
    expect(getVerification.path).toBe(`/:verificationId`)
    expect(getVerification.method).toBe(EPMethod.Get)
  })

  describe(`list`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
    })

    it(`lists org verifications with optional status and agentId filters`, async () => {
      ctx.verificationSvc.list.mockResolvedValue({ data: [verification()] })
      ctx.req.query = { status: `pending`, agentId: `agent-1` }
      await listVerifications.action(ctx.req, ctx.res)
      expect(ctx.verificationSvc.list).toHaveBeenCalledWith({
        where: { orgId: `org-1`, status: `pending`, agentId: `agent-1` },
      })
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ data: [verification()] })
      )
    })

    it(`lists with no filters when none supplied`, async () => {
      ctx.verificationSvc.list.mockResolvedValue({ data: [] })
      await listVerifications.action(ctx.req, ctx.res)
      expect(ctx.verificationSvc.list).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
      })
    })

    it(`rejects an invalid ?status= value with 400`, async () => {
      ctx.req.query = { status: `nonsense` }
      await expect(listVerifications.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })
  })

  describe(`get`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, verificationId: `vf_1` } as any
    })

    it(`returns the verification`, async () => {
      ctx.verificationSvc.get.mockResolvedValue({ data: verification() })
      await getVerification.action(ctx.req, ctx.res)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: verification() })
    })

    it(`404s when the verification is not found`, async () => {
      ctx.verificationSvc.get.mockResolvedValue({ data: null })
      await expect(getVerification.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })

    it(`404s a cross-org verification`, async () => {
      ctx.verificationSvc.get.mockResolvedValue({
        data: verification({ orgId: `other-org` }),
      })
      await expect(getVerification.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })
  })
})
