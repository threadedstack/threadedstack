import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { ESkillProposalStatus } from '@tdsk/domain'
import { getSkillProposal } from './getSkillProposal'
import { listSkillProposals } from './listSkillProposals'
import { reviewSkillProposal } from './reviewSkillProposal'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

const benign = {
  name: `Deploy check`,
  description: `Runs deploy checks`,
  instructions: `Run tests then build and report`,
  tools: [`shellExec`],
}

const proposal = (overrides = {}) => ({
  id: `pr_1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  status: ESkillProposalStatus.scanned,
  ...benign,
  ...overrides,
})

const build = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()
  const skillProposal = {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn().mockResolvedValue({ data: {} }),
  }
  const skill = {
    create: vi.fn().mockResolvedValue({ data: { id: `sk_new` } }),
    addAgent: vi.fn().mockResolvedValue({ data: {} }),
  }
  const req = {
    app: { locals: { db: { services: { skillProposal, skill } } } } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, skillProposal, skill }
}

describe(`Skill proposal endpoints`, () => {
  it(`config paths/methods`, () => {
    expect(listSkillProposals.path).toBe(`/`)
    expect(listSkillProposals.method).toBe(EPMethod.Get)
    expect(getSkillProposal.path).toBe(`/:proposalId`)
    expect(reviewSkillProposal.path).toBe(`/:proposalId/review`)
    expect(reviewSkillProposal.method).toBe(EPMethod.Post)
  })

  describe(`list`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
    })

    it(`lists org proposals with optional status/agentId filters`, async () => {
      ctx.skillProposal.list.mockResolvedValue({ data: [proposal()] })
      ctx.req.query = { status: `scanned`, agentId: `agent-1` }
      await listSkillProposals.action(ctx.req, ctx.res)
      expect(ctx.skillProposal.list).toHaveBeenCalledWith({
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
      ctx.req.params = { orgId: `org-1`, proposalId: `pr_1` } as any
    })

    it(`returns the proposal`, async () => {
      ctx.skillProposal.get.mockResolvedValue({ data: proposal() })
      await getSkillProposal.action(ctx.req, ctx.res)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: proposal() })
    })

    it(`404s a cross-org proposal`, async () => {
      ctx.skillProposal.get.mockResolvedValue({ data: proposal({ orgId: `other` }) })
      await expect(getSkillProposal.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })
  })

  describe(`review`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, proposalId: `pr_1` } as any
    })

    it(`approve promotes a scanned proposal (creates skill + attaches)`, async () => {
      ctx.skillProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { approve: true, reason: `great` }
      await reviewSkillProposal.action(ctx.req, ctx.res)
      expect(ctx.skill.create).toHaveBeenCalledOnce()
      expect(ctx.skill.addAgent).toHaveBeenCalledWith(`sk_new`, `agent-1`)
      const upd = ctx.skillProposal.update.mock.calls[0][0]
      expect(upd.status).toBe(ESkillProposalStatus.promoted)
    })

    it(`reject marks the proposal rejected`, async () => {
      ctx.skillProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { approve: false, reason: `nope` }
      await reviewSkillProposal.action(ctx.req, ctx.res)
      expect(ctx.skill.create).not.toHaveBeenCalled()
      const upd = ctx.skillProposal.update.mock.calls[0][0]
      expect(upd.status).toBe(ESkillProposalStatus.rejected)
    })

    it(`400s when approve is not a boolean`, async () => {
      ctx.req.body = { approve: `yes` }
      await expect(reviewSkillProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `approve must be a boolean`
      )
    })

    it(`404s when the proposal is not actionable`, async () => {
      ctx.skillProposal.get.mockResolvedValue({ data: null })
      ctx.req.body = { approve: true }
      await expect(reviewSkillProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found or not actionable`
      )
    })
  })
})
