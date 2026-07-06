import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { ETaskProposalStatus } from '@tdsk/domain'
import { getTaskProposal } from './getTaskProposal'
import { listTaskProposals } from './listTaskProposals'
import { createTaskProposal } from './createTaskProposal'
import { updateTaskProposal } from './updateTaskProposal'
import { deleteTaskProposal } from './deleteTaskProposal'
import { reviewTaskProposal } from './reviewTaskProposal'

const mockCheckPermission = vi.hoisted(() => vi.fn())
const mockAuthorTaskProposal = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))
// Partial mock: stub authorTaskProposal (exercised by createTaskProposal) while
// keeping the real rejectTaskProposal that reviewTaskProposal depends on.
vi.mock(`@TBE/utils/agent/taskPromotion`, async (importActual) => {
  const actual = await importActual<typeof import('@TBE/utils/agent/taskPromotion')>()
  return { ...actual, authorTaskProposal: mockAuthorTaskProposal }
})

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
    create: vi.fn().mockResolvedValue({ data: {} }),
    update: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  }
  const agent = {
    get: vi.fn().mockResolvedValue({ data: { id: `agent-1`, orgId: `org-1` } }),
  }
  const req = {
    app: { locals: { db: { services: { taskProposal, agent } } } } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, taskProposal, agent }
}

describe(`Task proposal endpoints`, () => {
  it(`config paths/methods`, () => {
    expect(listTaskProposals.path).toBe(`/`)
    expect(listTaskProposals.method).toBe(EPMethod.Get)
    expect(createTaskProposal.path).toBe(`/`)
    expect(createTaskProposal.method).toBe(EPMethod.Post)
    expect(getTaskProposal.path).toBe(`/:proposalId`)
    expect(updateTaskProposal.path).toBe(`/:proposalId`)
    expect(updateTaskProposal.method).toBe(EPMethod.Put)
    expect(deleteTaskProposal.path).toBe(`/:proposalId`)
    expect(deleteTaskProposal.method).toBe(EPMethod.Delete)
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

  describe(`create`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.body = {
        agentId: `agent-1`,
        title: `Fix egress CA rotation`,
        description: `The egress CA cert is nearing expiry`,
        evidence: `cert expiry log line`,
      }
    })

    it(`authors a proposal and responds 201 with deduped=false`, async () => {
      mockAuthorTaskProposal.mockResolvedValue({
        id: `tp_1`,
        status: ETaskProposalStatus.scanned,
        findings: [],
        deduped: false,
      })
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })

      await createTaskProposal.action(ctx.req, ctx.res)

      expect(mockAuthorTaskProposal).toHaveBeenCalledOnce()
      const [, orgArg, agentArg, input] = mockAuthorTaskProposal.mock.calls[0]
      expect(orgArg).toBe(`org-1`)
      expect(agentArg).toBe(`agent-1`)
      // priority + sourceSignal default, dedupeKey derived from signal + slug(title)
      expect(input.priority).toBe(`P3`)
      expect(input.sourceSignal).toBe(`other`)
      expect(input.dedupeKey).toBe(`other:fix-egress-ca-rotation`)
      expect(ctx.mockStatus).toHaveBeenCalledWith(201)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: proposal(), deduped: false })
    })

    it(`returns the existing proposal with 200 when deduped`, async () => {
      mockAuthorTaskProposal.mockResolvedValue({
        id: `tp_1`,
        status: ETaskProposalStatus.scanned,
        findings: [],
        deduped: true,
      })
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })

      await createTaskProposal.action(ctx.req, ctx.res)

      expect(ctx.mockStatus).toHaveBeenCalledWith(200)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: proposal(), deduped: true })
    })

    it(`400s when a required field is missing`, async () => {
      ctx.req.body = { agentId: `agent-1`, description: `d`, evidence: `e` }
      await expect(createTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `title is required`
      )
      expect(mockAuthorTaskProposal).not.toHaveBeenCalled()
    })

    it(`404s when the agent belongs to another org`, async () => {
      ctx.agent.get.mockResolvedValue({ data: { id: `agent-1`, orgId: `other` } })
      await expect(createTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `Agent not found`
      )
      expect(mockAuthorTaskProposal).not.toHaveBeenCalled()
    })
  })

  describe(`update`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, proposalId: `tp_1` } as any
    })

    it(`updates only the provided fields`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.taskProposal.update.mockResolvedValue({
        data: proposal({ title: `New title` }),
      })
      ctx.req.body = { title: `New title`, priority: `P0`, status: `promoted` }

      await updateTaskProposal.action(ctx.req, ctx.res)

      const upd = ctx.taskProposal.update.mock.calls[0][0]
      expect(upd.id).toBe(`tp_1`)
      expect(upd.title).toBe(`New title`)
      expect(upd.priority).toBe(`P0`)
      expect(upd.status).toBe(`promoted`)
      expect(upd).not.toHaveProperty(`description`)
      expect(ctx.mockJson).toHaveBeenCalledWith({
        data: proposal({ title: `New title` }),
      })
    })

    it(`400s on an invalid priority`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { priority: `P9` }
      await expect(updateTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `Invalid priority`
      )
      expect(ctx.taskProposal.update).not.toHaveBeenCalled()
    })

    it(`400s on an invalid status`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.req.body = { status: `bogus` }
      await expect(updateTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `Invalid status`
      )
    })

    it(`404s a cross-org proposal`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal({ orgId: `other` }) })
      ctx.req.body = { title: `x` }
      await expect(updateTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
    })
  })

  describe(`delete`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, proposalId: `tp_1` } as any
    })

    it(`deletes and returns the id`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: proposal() })
      ctx.taskProposal.delete.mockResolvedValue({ data: proposal() })
      await deleteTaskProposal.action(ctx.req, ctx.res)
      expect(ctx.taskProposal.delete).toHaveBeenCalledWith(`tp_1`)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: { id: `tp_1` } })
    })

    it(`404s a missing proposal without deleting`, async () => {
      ctx.taskProposal.get.mockResolvedValue({ data: null })
      await expect(deleteTaskProposal.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
      expect(ctx.taskProposal.delete).not.toHaveBeenCalled()
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
