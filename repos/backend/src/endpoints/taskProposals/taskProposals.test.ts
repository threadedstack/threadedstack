import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { ETaskProposalStatus } from '@tdsk/domain'
import { getTaskProposal } from './getTaskProposal'
import { listTaskProposals } from './listTaskProposals'
import { reviewTaskProposal } from './reviewTaskProposal'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

const proposal = (overrides = {}) => ({
  id: `tp_1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  title: `Fix egress CA rotation`,
  description: `The egress CA cert is nearing expiry`,
  priority: `P1`,
  evidence: `cert expiry log line`,
  sourceSignal: `health`,
  dedupeKey: `egress-ca-rotation`,
  repos: [`backend`],
  status: ETaskProposalStatus.scanned,
  ...overrides,
})

const build = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()
  const taskProposal = {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn().mockResolvedValue({ data: {} }),
  }
  const req = {
    app: { locals: { db: { services: { taskProposal } } } } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, taskProposal }
}

describe(`Task proposal endpoints`, () => {
  it(`config paths/methods`, () => {
    expect(listTaskProposals.path).toBe(`/`)
    expect(listTaskProposals.method).toBe(EPMethod.Get)
    expect(getTaskProposal.path).toBe(`/:proposalId`)
    expect(reviewTaskProposal.path).toBe(`/:proposalId/review`)
    expect(reviewTaskProposal.method).toBe(EPMethod.Post)
  })

  describe(`list`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
    })

    it(`lists org proposals with optional status/agentId filters`, async () => {
      ctx.taskProposal.list.mockResolvedValue({ data: [proposal()] })
      ctx.req.query = { status: `scanned`, agentId: `agent-1` }
      await listTaskProposals.action(ctx.req, ctx.res)
      expect(ctx.taskProposal.list).toHaveBeenCalledWith({
        where: { orgId: `org-1`, status: `scanned`, agentId: `agent-1` },
      })
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ data: [proposal()] })
      )
    })
  })

  describe(`get`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, proposalId: `tp_1` } as any
    })

    it(`returns the proposal`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      await getTaskProposal.action(ctx.req, ctx.res)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: proposal() })
    })

    it(`404s a cross-org proposal`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal({ orgId: `other` }) })
      await expect(getTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })
  })

  describe(`review`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, proposalId: `tp_1` } as any
    })

    it(`approve is a no-op — proposal is returned unchanged, no state change`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { approve: true, reason: `looks good` }
      await reviewTaskProposal.action(ctx.req, ctx.res)
      expect(ctx.taskProposal.update).not.toHaveBeenCalled()
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ data: proposal(), note: expect.any(String) })
      )
    })

    it(`reject marks the proposal rejected`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { approve: false, reason: `not worth doing` }
      await reviewTaskProposal.action(ctx.req, ctx.res)
      expect(ctx.taskProposal.update).toHaveBeenCalledOnce()
      const upd = ctx.taskProposal.update.mock.calls[0][0]
      expect(upd.status).toBe(ETaskProposalStatus.rejected)
      expect(upd.reason).toBe(`not worth doing`)
    })

    it(`reject defaults the reason when none is provided`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { approve: false }
      await reviewTaskProposal.action(ctx.req, ctx.res)
      const upd = ctx.taskProposal.update.mock.calls[0][0]
      expect(upd.reason).toBe(`Rejected via admin`)
    })

    it(`400s when approve is not a boolean`, async () => {
      ctx.req.body = { approve: `yes` }
      await expect(reviewTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `approve must be a boolean`
      )
    })

    it(`404s when the proposal is missing or cross-org`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: null })
      ctx.req.body = { approve: false }
      await expect(reviewTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
    })

    it(`404s when the proposal belongs to another org`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal({ orgId: `other` }) })
      ctx.req.body = { approve: false }
      await expect(reviewTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
    })
  })
})
