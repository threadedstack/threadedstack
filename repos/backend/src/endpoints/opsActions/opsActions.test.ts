import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { EOpsActionStatus } from '@tdsk/domain'
import { getOpsAction } from './getOpsAction'
import { listOpsActions } from './listOpsActions'
import { overrideOpsAction } from './overrideOpsAction'

const mockCheckPermission = vi.hoisted(() => vi.fn())
const mockApplyOpsReview = vi.hoisted(() => vi.fn())
const mockRevertOpsAction = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))
vi.mock(`@TBE/utils/agent/opsPromotion`, () => ({
  applyOpsReview: mockApplyOpsReview,
  revertOpsAction: mockRevertOpsAction,
}))

const opsAction = (overrides = {}) => ({
  id: `oa_1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  action: `restartDeployment`,
  params: { deployment: `tdsk-backend`, reason: `Memory leak` },
  dryRun: true,
  dryRunResult: null,
  result: null,
  status: EOpsActionStatus.dryRun,
  scanResult: { passed: true, findings: [] },
  reviewVerdict: null,
  rollback: { kind: `restart`, prevRevision: `1` },
  reason: null,
  meta: null,
  ...overrides,
})

const build = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()
  const opsActionSvc = {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn().mockResolvedValue({ data: {} }),
  }
  const req = {
    app: {
      locals: { db: { services: { opsAction: opsActionSvc } } },
    } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  // req.app is the app itself in Express
  Object.defineProperty(req, `app`, {
    value: {
      locals: { db: { services: { opsAction: opsActionSvc } } },
    },
    writable: true,
  })
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, opsActionSvc }
}

describe(`OpsActions endpoints`, () => {
  it(`config paths/methods are correct`, () => {
    expect(listOpsActions.path).toBe(`/`)
    expect(listOpsActions.method).toBe(EPMethod.Get)
    expect(getOpsAction.path).toBe(`/:opsActionId`)
    expect(getOpsAction.method).toBe(EPMethod.Get)
    expect(overrideOpsAction.path).toBe(`/:opsActionId/override`)
    expect(overrideOpsAction.method).toBe(EPMethod.Post)
  })

  describe(`list`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
    })

    it(`lists org ops actions with optional status and agentId filters`, async () => {
      ctx.opsActionSvc.list.mockResolvedValue({ data: [opsAction()] })
      ctx.req.query = { status: `dryRun`, agentId: `agent-1` }
      await listOpsActions.action(ctx.req, ctx.res)
      expect(ctx.opsActionSvc.list).toHaveBeenCalledWith({
        where: { orgId: `org-1`, status: `dryRun`, agentId: `agent-1` },
      })
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ data: [opsAction()] })
      )
    })

    it(`lists with no filters when none supplied`, async () => {
      ctx.opsActionSvc.list.mockResolvedValue({ data: [] })
      await listOpsActions.action(ctx.req, ctx.res)
      expect(ctx.opsActionSvc.list).toHaveBeenCalledWith({
        where: { orgId: `org-1` },
      })
    })

    it(`rejects an invalid ?status= value with 400`, async () => {
      ctx.req.query = { status: `bogus` }
      await expect(listOpsActions.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })

    it(`accepts all valid status values`, async () => {
      ctx.opsActionSvc.list.mockResolvedValue({ data: [] })
      for (const status of Object.values(EOpsActionStatus)) {
        ctx.req.query = { status }
        await expect(listOpsActions.action(ctx.req, ctx.res)).resolves.toBeUndefined()
      }
    })
  })

  describe(`get`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, opsActionId: `oa_1` } as any
    })

    it(`returns the ops action`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({ data: opsAction() })
      await getOpsAction.action(ctx.req, ctx.res)
      expect(ctx.mockJson).toHaveBeenCalledWith({ data: opsAction() })
    })

    it(`404s when the ops action is not found`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({ data: null })
      await expect(getOpsAction.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })

    it(`404s a cross-org ops action`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({
        data: opsAction({ orgId: `other-org` }),
      })
      await expect(getOpsAction.action(ctx.req, ctx.res)).rejects.toThrow(`not found`)
    })
  })

  describe(`override`, () => {
    let ctx: ReturnType<typeof build>
    beforeEach(() => {
      vi.clearAllMocks()
      ctx = build()
      ctx.req.params = { orgId: `org-1`, opsActionId: `oa_1` } as any
    })

    it(`approve=true on dryRun row calls applyOpsReview and returns updated row`, async () => {
      const row = opsAction()
      const updatedRow = opsAction({ status: EOpsActionStatus.executed, dryRun: false })
      ctx.opsActionSvc.get
        .mockResolvedValueOnce({ data: row })
        .mockResolvedValueOnce({ data: updatedRow })
      mockApplyOpsReview.mockResolvedValue({ status: EOpsActionStatus.executed })
      ctx.req.body = { approve: true, reason: `Looks good` }
      await overrideOpsAction.action(ctx.req, ctx.res)
      expect(mockApplyOpsReview).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ services: { opsAction: ctx.opsActionSvc } }),
        `org-1`,
        { opsActionId: `oa_1`, approve: true, reason: `Looks good` },
        `user-1`
      )
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: updatedRow,
          note: expect.stringContaining(`Async override applied`),
        })
      )
    })

    it(`approve=false on dryRun row calls applyOpsReview and returns updated row`, async () => {
      const row = opsAction()
      const rejectedRow = opsAction({ status: EOpsActionStatus.rejected })
      ctx.opsActionSvc.get
        .mockResolvedValueOnce({ data: row })
        .mockResolvedValueOnce({ data: rejectedRow })
      mockApplyOpsReview.mockResolvedValue({ status: EOpsActionStatus.rejected })
      ctx.req.body = { approve: false, reason: `Too risky` }
      await overrideOpsAction.action(ctx.req, ctx.res)
      expect(mockApplyOpsReview).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ services: { opsAction: ctx.opsActionSvc } }),
        `org-1`,
        { opsActionId: `oa_1`, approve: false, reason: `Too risky` },
        `user-1`
      )
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: rejectedRow,
        })
      )
    })

    it(`approve=false on executed row calls revertOpsAction`, async () => {
      const row = opsAction({ status: EOpsActionStatus.executed, dryRun: false })
      ctx.opsActionSvc.get.mockResolvedValue({ data: row })
      mockRevertOpsAction.mockResolvedValue({ ok: true, data: { kind: `restart` } })
      ctx.req.body = { approve: false }
      await overrideOpsAction.action(ctx.req, ctx.res)
      expect(mockRevertOpsAction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ services: { opsAction: ctx.opsActionSvc } }),
        `oa_1`
      )
      expect(ctx.mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ok: true, data: { kind: `restart` } },
          note: expect.stringContaining(`reverted`),
        })
      )
    })

    it(`approve=true on executed row returns 400`, async () => {
      const row = opsAction({ status: EOpsActionStatus.executed, dryRun: false })
      ctx.opsActionSvc.get.mockResolvedValue({ data: row })
      ctx.req.body = { approve: true }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
      expect(mockApplyOpsReview).not.toHaveBeenCalled()
    })

    it(`409s when row is rejected (terminal)`, async () => {
      const row = opsAction({ status: EOpsActionStatus.rejected })
      ctx.opsActionSvc.get.mockResolvedValue({ data: row })
      ctx.req.body = { approve: true }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 409,
      })
    })

    it(`409s when row is failed (terminal)`, async () => {
      const row = opsAction({ status: EOpsActionStatus.failed })
      ctx.opsActionSvc.get.mockResolvedValue({ data: row })
      ctx.req.body = { approve: false }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 409,
      })
    })

    it(`409s when applyOpsReview returns null`, async () => {
      const row = opsAction()
      ctx.opsActionSvc.get.mockResolvedValue({ data: row })
      mockApplyOpsReview.mockResolvedValue(null)
      ctx.req.body = { approve: true }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 409,
      })
    })

    it(`404s when the ops action is not found`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({ data: null })
      ctx.req.body = { approve: true }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
    })

    it(`404s cross-org ops action`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({
        data: opsAction({ orgId: `other-org` }),
      })
      ctx.req.body = { approve: true }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toThrow(
        `not found`
      )
    })

    it(`400s when approve is missing`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({ data: opsAction() })
      ctx.req.body = {}
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })

    it(`400s when reason is not a string`, async () => {
      ctx.opsActionSvc.get.mockResolvedValue({ data: opsAction() })
      ctx.req.body = { approve: true, reason: 123 }
      await expect(overrideOpsAction.action(ctx.req, ctx.res)).rejects.toMatchObject({
        status: 400,
      })
    })
  })

  describe(`feature gate`, () => {
    it(`orgOpsActions config has featureGate('ops') in middleware`, async () => {
      const { orgOpsActions } = await import('./opsActions')
      expect(orgOpsActions.middleware).toBeDefined()
      expect(orgOpsActions.middleware!.length).toBeGreaterThan(0)
    })
  })
})
