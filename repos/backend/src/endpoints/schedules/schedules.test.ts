import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { listSchedules } from './listSchedules'
import { getSchedule } from './getSchedule'
import { createSchedule } from './createSchedule'
import { updateSchedule } from './updateSchedule'
import { deleteSchedule } from './deleteSchedule'
import { triggerSchedule } from './triggerSchedule'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

vi.mock(`@TBE/services/scheduler/cronParser`, () => ({
  isValidCron: vi.fn().mockReturnValue(true),
  parseNextRun: vi.fn().mockReturnValue(new Date(`2026-04-01T00:00:00Z`)),
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const mockSchedule = {
  id: `sched-1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  cronExpression: `*/5 * * * *`,
  prompt: `Run the task`,
  enabled: true,
  nextRunAt: new Date(`2026-03-01T10:00:00Z`),
  threadId: undefined,
  createThread: true,
  maxConsecutiveErrors: 5,
  consecutiveErrors: 0,
}

const mockAgent = {
  id: `agent-1`,
  name: `Test Agent`,
  orgId: `org-1`,
}

const buildMockReqRes = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()

  const scheduleService = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    markRun: vi.fn(),
  }

  const agentService = {
    get: vi.fn().mockResolvedValue({ data: mockAgent }),
  }

  const threadService = {
    get: vi.fn().mockResolvedValue({ data: { id: `thread-1`, orgId: `org-1` } }),
  }

  const mockRes = {
    status: mockStatus,
    json: mockJson,
  } as unknown as Response

  const mockReq = {
    app: {
      locals: {
        db: {
          services: {
            schedule: scheduleService,
            agent: agentService,
            thread: threadService,
          },
        },
      },
    } as any,
    user: { id: `user-1`, email: `test@example.com` } as any,
    params: { orgId: `org-1` },
    body: {},
  } as unknown as TRequest

  return {
    mockReq,
    mockRes,
    mockJson,
    mockStatus,
    scheduleService,
    agentService,
    threadService,
  }
}

// ── ENDPOINT CONFIG ──────────────────────────────────────────────────

describe(`Schedules endpoint configuration`, () => {
  it(`listSchedules should have correct path and method`, () => {
    expect(listSchedules.path).toBe(`/`)
    expect(listSchedules.method).toBe(EPMethod.Get)
  })

  it(`getSchedule should have correct path and method`, () => {
    expect(getSchedule.path).toBe(`/:scheduleId`)
    expect(getSchedule.method).toBe(EPMethod.Get)
  })

  it(`createSchedule should have correct path and method`, () => {
    expect(createSchedule.path).toBe(`/`)
    expect(createSchedule.method).toBe(EPMethod.Post)
  })

  it(`updateSchedule should have correct path and method`, () => {
    expect(updateSchedule.path).toBe(`/:scheduleId`)
    expect(updateSchedule.method).toBe(EPMethod.Put)
  })

  it(`deleteSchedule should have correct path and method`, () => {
    expect(deleteSchedule.path).toBe(`/:scheduleId`)
    expect(deleteSchedule.method).toBe(EPMethod.Delete)
  })

  it(`triggerSchedule should have correct path and method`, () => {
    expect(triggerSchedule.path).toBe(`/:scheduleId/trigger`)
    expect(triggerSchedule.method).toBe(EPMethod.Post)
  })
})

// ── LIST SCHEDULES ──────────────────────────────────────────────────

describe(`GET / - listSchedules`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
  })

  it(`should return schedules for org`, async () => {
    scheduleService.list.mockResolvedValue({ data: [mockSchedule] })

    await listSchedules.action(mockReq, mockRes)

    expect(scheduleService.list).toHaveBeenCalledWith({ where: { orgId: `org-1` } })
    expect(mockJson).toHaveBeenCalledWith({ data: [mockSchedule] })
  })

  it(`should return empty array when no schedules exist`, async () => {
    scheduleService.list.mockResolvedValue({ data: null })

    await listSchedules.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = {} as any

    await expect(listSchedules.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 500 when service returns error`, async () => {
    scheduleService.list.mockResolvedValue({ error: { message: `DB failure` } })

    await expect(listSchedules.action(mockReq, mockRes)).rejects.toThrow(`DB failure`)
  })
})

// ── GET SCHEDULE ────────────────────────────────────────────────────

describe(`GET /:scheduleId - getSchedule`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any
  })

  it(`should return schedule by id`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })

    await getSchedule.action(mockReq, mockRes)

    expect(scheduleService.get).toHaveBeenCalledWith(`sched-1`)
    expect(mockJson).toHaveBeenCalledWith({ data: mockSchedule })
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when service returns no data`, async () => {
    scheduleService.get.mockResolvedValue({})

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 500 when service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ error: { message: `DB error` } })

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(`DB error`)
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { scheduleId: `sched-1` } as any

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })
})

// ── CREATE SCHEDULE ─────────────────────────────────────────────────

describe(`POST / - createSchedule`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    mockStatus = ctx.mockStatus
    scheduleService = ctx.scheduleService
  })

  it(`should create schedule with valid data`, async () => {
    scheduleService.create.mockResolvedValue({ data: mockSchedule })

    mockReq.body = {
      cronExpression: `*/5 * * * *`,
      prompt: `Run the task`,
      agentId: `agent-1`,
    }

    await createSchedule.action(mockReq, mockRes)

    expect(scheduleService.create).toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: mockSchedule })
  })

  it(`should throw 400 when cronExpression is missing`, async () => {
    mockReq.body = { prompt: `Run it`, agentId: `agent-1` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `cronExpression is required`
    )
  })

  it(`should throw 400 when prompt is missing`, async () => {
    mockReq.body = { cronExpression: `* * * * *`, agentId: `agent-1` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `prompt is required`
    )
  })

  it(`should throw 400 when agentId is missing`, async () => {
    mockReq.body = { cronExpression: `* * * * *`, prompt: `Run it` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `agentId is required`
    )
  })

  it(`should throw 400 when cron expression is invalid`, async () => {
    const { isValidCron } = vi.mocked(await import(`@TBE/services/scheduler/cronParser`))
    isValidCron.mockReturnValueOnce(false)

    mockReq.body = {
      cronExpression: `bad cron`,
      prompt: `Run it`,
      agentId: `agent-1`,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Invalid cron expression`
    )
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = {} as any
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      agentId: `agent-1`,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 404 when agent not found`, async () => {
    const ctx = buildMockReqRes()
    ctx.agentService.get.mockResolvedValue({ data: null })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      agentId: `agent-missing`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`should throw 404 when agent belongs to different org`, async () => {
    const ctx = buildMockReqRes()
    ctx.agentService.get.mockResolvedValue({ data: { ...mockAgent, orgId: `other-org` } })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      agentId: `agent-1`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`should throw 500 when service returns error`, async () => {
    scheduleService.create.mockResolvedValue({ error: { message: `Create failed` } })

    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      agentId: `agent-1`,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(`Create failed`)
  })
})

// ── UPDATE SCHEDULE ─────────────────────────────────────────────────

describe(`PUT /:scheduleId - updateSchedule`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any
  })

  it(`should update schedule fields`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    const updated = { ...mockSchedule, prompt: `Updated prompt` }
    scheduleService.update.mockResolvedValue({ data: updated })

    mockReq.body = { prompt: `Updated prompt` }

    await updateSchedule.action(mockReq, mockRes)

    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: `sched-1`, prompt: `Updated prompt` })
    )
    expect(mockJson).toHaveBeenCalledWith({ data: updated })
  })

  it(`should recalculate nextRunAt when cron expression is updated`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { cronExpression: `0 12 * * *` }

    await updateSchedule.action(mockReq, mockRes)

    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `sched-1`,
        cronExpression: `0 12 * * *`,
        nextRunAt: expect.any(Date),
      })
    )
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    mockReq.body = { prompt: `New prompt` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    mockReq.body = { prompt: `New prompt` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { scheduleId: `sched-1` } as any

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 400 when updated cron expression is invalid`, async () => {
    const { isValidCron } = vi.mocked(await import(`@TBE/services/scheduler/cronParser`))
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    isValidCron.mockReturnValueOnce(false)

    mockReq.body = { cronExpression: `invalid` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Invalid cron expression`
    )
  })

  it(`should only include provided fields in update`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { enabled: false }

    await updateSchedule.action(mockReq, mockRes)

    const updateArg = scheduleService.update.mock.calls[0][0]
    expect(updateArg.id).toBe(`sched-1`)
    expect(updateArg.enabled).toBe(false)
    expect(updateArg).not.toHaveProperty(`prompt`)
    expect(updateArg).not.toHaveProperty(`agentId`)
    expect(updateArg).not.toHaveProperty(`cronExpression`)
  })

  it(`should throw 500 when update service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({ error: { message: `Update failed` } })

    mockReq.body = { prompt: `Updated` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(`Update failed`)
  })
})

// ── DELETE SCHEDULE ─────────────────────────────────────────────────

describe(`DELETE /:scheduleId - deleteSchedule`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any
  })

  it(`should delete schedule and return id`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.delete.mockResolvedValue({})

    await deleteSchedule.action(mockReq, mockRes)

    expect(scheduleService.delete).toHaveBeenCalledWith(`sched-1`)
    expect(mockJson).toHaveBeenCalledWith({ data: { id: `sched-1` } })
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { scheduleId: `sched-1` } as any

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 500 when delete service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.delete.mockResolvedValue({ error: { message: `Delete failed` } })

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(`Delete failed`)
  })
})

// ── TRIGGER SCHEDULE ────────────────────────────────────────────────

describe(`POST /:scheduleId/trigger - triggerSchedule`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any
  })

  it(`should trigger schedule and return data with triggered flag`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.markRun.mockResolvedValue({})

    await triggerSchedule.action(mockReq, mockRes)

    expect(scheduleService.get).toHaveBeenCalledWith(`sched-1`)
    expect(scheduleService.markRun).toHaveBeenCalledWith(`sched-1`, expect.any(Date))
    const responseData = mockJson.mock.calls[0][0].data
    expect(responseData.triggered).toBe(true)
    expect(responseData.id).toBe(`sched-1`)
    expect(responseData.nextRunAt).toBeInstanceOf(Date)
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { scheduleId: `sched-1` } as any

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 404 when service returns no data`, async () => {
    scheduleService.get.mockResolvedValue({})

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 500 when service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ error: { message: `DB error` } })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(`DB error`)
  })
})
