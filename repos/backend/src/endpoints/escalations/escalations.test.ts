import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { EEscalationStatus } from '@tdsk/domain'
import { getEscalation } from './getEscalation'
import { listEscalations } from './listEscalations'
import { resolveEscalation } from './resolveEscalation'

const mockCheckPermission = vi.hoisted(() => vi.fn())
const mockResolveEscalationUtil = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))
vi.mock(`@TBE/utils/agent/escalationPromotion`, () => ({
  resolveEscalation: mockResolveEscalationUtil,
}))

const escalation = (overrides = {}) => ({
  id: `esc_1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  title: `Egress CA rotation needed`,
  problem: `The egress CA cert is nearing expiry`,
  evidence: [`cert expiry log line`],
  proposedPatch: null,
  target: `app`,
  status: EEscalationStatus.open,
  dedupeKey: `egress-ca-rotation`,
  issueRef: null,
  resolvedRef: null,
  reason: null,
  meta: null,
  ...overrides,
})

const build = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()
  const escalationSvc = {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn().mockResolvedValue({ data: {} }),
  }
  const req = {
    app: { locals: { db: { services: { escalation: escalationSvc } } } } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, escalationSvc }
}

describe(`Escalation endpoints`, () => {
  it(`config paths/methods are correct`, () => {
    expect(listEscalations.path).toBe(`/`)
    expect(listEscalations.method).toBe(EPMethod.Get)
    expect(getEscalation.path).toBe(`/:escalationId`)
    expect(getEscalation.method).toBe(EPMethod.Get)
    expect(resolveEscalation.path).toBe(`/:escalationId/resolve`)
    expect(resolveEscalation.method).toBe(EPMethod.Post)
  })

  describe(`list`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
    })

    it(`lists org escalations with optional status and agentId filters`, async () => {
      ctx.escalationSvc.list.mockResolvedValue({ data: [escalation()] })
      ctx.req.query = { status: `open`, agentId: `agent-1` }
      await listEscalations.action(ctx.req, ctx.res)
      expect(ctx.escalationSvc.list).toHaveBeenCalledWith({
        where: { orgId: `org-1`, status: `open`, agentId: `agent-1` },
      })
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ data: [escalation()] })
      )
    })

    it(`lists with no filters when none supplied`, async () => {
      ctx.escalationSvc.list.mockResolvedValue({ data: [] })
      await listEscalations.action(ctx.req, ctx.res)
      expect(ctx.escalationSvc.list).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
      })
    })

    it(`rejects an invalid ?status= value with 400`, async () => {
      ctx.req.query = { status: `nonsense` }
      await expect(listEscalations.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })
  })

  describe(`get`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, escalationId: `esc_1` } as any
    })

    it(`returns the escalation`, async () => {
      ctx.escalationSvc.get.mockResolvedValue({ data: escalation() })
      await getEscalation.action(ctx.req, ctx.res)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: escalation() })
    })

    it(`404s when the escalation is not found`, async () => {
      ctx.escalationSvc.get.mockResolvedValue({ data: null })
      await expect(getEscalation.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })

    it(`404s a cross-org escalation`, async () => {
      ctx.escalationSvc.get.mockResolvedValue({
        data: escalation({ orgId: `other-org` }),
      })
      await expect(getEscalation.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })
  })

  describe(`resolve`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, escalationId: `esc_1` } as any
    })

    it(`resolves with status=resolved and resolvedRef`, async () => {
      ctx.escalationSvc.get
        .mockResolvedValueOnce({ data: escalation() })
        .mockResolvedValueOnce({
          data: escalation({
            status: EEscalationStatus.resolved,
            resolvedRef: `https://github.com/pr/1`,
          }),
        })
      mockResolveEscalationUtil.mockResolvedValue(`resolved`)
      ctx.req.body = { status: `resolved`, resolvedRef: `https://github.com/pr/1` }
      await resolveEscalation.action(ctx.req, ctx.res)
      expect(mockResolveEscalationUtil).toHaveBeenCalledOnce()
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EEscalationStatus.resolved }),
        })
      )
    })

    it(`rejects with status=rejected and reason`, async () => {
      ctx.escalationSvc.get
        .mockResolvedValueOnce({ data: escalation() })
        .mockResolvedValueOnce({
          data: escalation({
            status: EEscalationStatus.rejected,
            reason: `not worth it`,
          }),
        })
      mockResolveEscalationUtil.mockResolvedValue(`rejected`)
      ctx.req.body = { status: `rejected`, reason: `not worth it` }
      await resolveEscalation.action(ctx.req, ctx.res)
      expect(mockResolveEscalationUtil).toHaveBeenCalledOnce()
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EEscalationStatus.rejected }),
        })
      )
    })

    it(`400s when status is not resolved or rejected`, async () => {
      ctx.req.body = { status: `promoted` }
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
      expect(mockResolveEscalationUtil).not.toHaveBeenCalled()
    })

    it(`400s when status is missing`, async () => {
      ctx.req.body = {}
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
      expect(mockResolveEscalationUtil).not.toHaveBeenCalled()
    })

    it(`400s when resolvedRef is not a string`, async () => {
      ctx.req.body = { status: `resolved`, resolvedRef: 123 }
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })

    it(`400s when reason is not a string`, async () => {
      ctx.req.body = { status: `rejected`, reason: true }
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })

    it(`404s when the escalation is missing`, async () => {
      ctx.escalationSvc.get.mockResolvedValue({ data: null })
      ctx.req.body = { status: `resolved` }
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
      expect(mockResolveEscalationUtil).not.toHaveBeenCalled()
    })

    it(`404s when the escalation belongs to another org`, async () => {
      ctx.escalationSvc.get.mockResolvedValue({
        data: escalation({ orgId: `other-org` }),
      })
      ctx.req.body = { status: `resolved` }
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
      expect(mockResolveEscalationUtil).not.toHaveBeenCalled()
    })

    it(`409s when the util returns null (escalation already terminal)`, async () => {
      ctx.escalationSvc.get.mockResolvedValue({ data: escalation() })
      mockResolveEscalationUtil.mockResolvedValue(null)
      ctx.req.body = { status: `resolved` }
      await expect(resolveEscalation.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 409,
      })
    })
  })
})
