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
  sandboxId: `sb-1`,
  type: `prompt`,
  cronExpression: `*/5 * * * *`,
  prompt: `Run the task`,
  enabled: true,
  nextRunAt: new Date(`2026-03-01T10:00:00Z`),
  threadId: undefined,
  createThread: true,
  maxConsecutiveErrors: 5,
  consecutiveErrors: 0,
}

const mockSandbox = {
  id: `sb-1`,
  name: `Test Sandbox`,
  orgId: `org-1`,
  config: { runtime: `claude-code`, runtimeCommand: `claude` },
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
    incrementErrors: vi.fn(),
  }

  const sandboxService = {
    get: vi.fn().mockResolvedValue({ data: mockSandbox }),
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
            sandbox: sandboxService,
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
    sandboxService,
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

  it(`should create schedule with valid prompt data`, async () => {
    scheduleService.create.mockResolvedValue({ data: mockSchedule })

    mockReq.body = {
      cronExpression: `*/5 * * * *`,
      prompt: `Run the task`,
      sandboxId: `sb-1`,
    }

    await createSchedule.action(mockReq, mockRes)

    expect(scheduleService.create).toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: mockSchedule })
  })

  it(`should create schedule with shell type and command`, async () => {
    const shellSchedule = {
      ...mockSchedule,
      type: `shell`,
      command: `npm test`,
      prompt: undefined,
    }
    scheduleService.create.mockResolvedValue({ data: shellSchedule })

    mockReq.body = {
      cronExpression: `*/5 * * * *`,
      command: `npm test`,
      sandboxId: `sb-1`,
      type: `shell`,
    }

    await createSchedule.action(mockReq, mockRes)

    expect(scheduleService.create).toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: shellSchedule })
  })

  it(`should throw 400 when cronExpression is missing`, async () => {
    mockReq.body = { prompt: `Run it`, sandboxId: `sb-1` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `cronExpression is required`
    )
  })

  it(`should throw 400 when prompt is missing for prompt type`, async () => {
    mockReq.body = { cronExpression: `* * * * *`, sandboxId: `sb-1` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `prompt is required for prompt schedules`
    )
  })

  it(`should throw 400 when command is missing for shell type`, async () => {
    mockReq.body = { cronExpression: `* * * * *`, sandboxId: `sb-1`, type: `shell` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `command is required for shell schedules`
    )
  })

  it(`should throw 400 when sandboxId is missing`, async () => {
    mockReq.body = { cronExpression: `* * * * *`, prompt: `Run it` }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `sandboxId is required`
    )
  })

  it(`should throw 400 when cron expression is invalid`, async () => {
    const { isValidCron } = vi.mocked(await import(`@TBE/services/scheduler/cronParser`))
    isValidCron.mockReturnValueOnce(false)

    mockReq.body = {
      cronExpression: `bad cron`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
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
      sandboxId: `sb-1`,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 404 when sandbox not found`, async () => {
    const ctx = buildMockReqRes()
    ctx.sandboxService.get.mockResolvedValue({ data: null })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-missing`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Sandbox not found`
    )
  })

  it(`should throw 404 when sandbox belongs to different org`, async () => {
    const ctx = buildMockReqRes()
    ctx.sandboxService.get.mockResolvedValue({
      data: { ...mockSandbox, orgId: `other-org` },
    })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Sandbox not found`
    )
  })

  it(`should throw 500 when service returns error`, async () => {
    scheduleService.create.mockResolvedValue({ error: { message: `Create failed` } })

    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
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
  let sandboxService: ReturnType<typeof buildMockReqRes>['sandboxService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    sandboxService = ctx.sandboxService
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

  it(`should validate sandbox when sandboxId is updated`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({
      data: { ...mockSchedule, sandboxId: `sb-2` },
    })
    sandboxService.get.mockResolvedValue({ data: { id: `sb-2`, orgId: `org-1` } })

    mockReq.body = { sandboxId: `sb-2` }

    await updateSchedule.action(mockReq, mockRes)

    expect(sandboxService.get).toHaveBeenCalledWith(`sb-2`)
    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: `sched-1`, sandboxId: `sb-2` })
    )
  })

  it(`should throw 404 when updated sandbox not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    sandboxService.get.mockResolvedValue({ data: null })

    mockReq.body = { sandboxId: `sb-missing` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Sandbox not found`
    )
  })

  it(`should throw 404 when updated sandbox belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    sandboxService.get.mockResolvedValue({ data: { id: `sb-2`, orgId: `other-org` } })

    mockReq.body = { sandboxId: `sb-2` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Sandbox not found`
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
    expect(updateArg).not.toHaveProperty(`sandboxId`)
    expect(updateArg).not.toHaveProperty(`cronExpression`)
  })

  it(`should throw 500 when update service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({ error: { message: `Update failed` } })

    mockReq.body = { prompt: `Updated` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(`Update failed`)
  })

  it(`should throw 400 when type is changed to shell but command is missing`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, command: undefined },
    })

    mockReq.body = { type: `shell` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `command is required for shell schedules`
    )
  })

  it(`should throw 400 when type is changed to prompt but prompt is missing`, async () => {
    const shellSchedule = {
      ...mockSchedule,
      type: `shell`,
      command: `npm test`,
      prompt: undefined,
    }
    scheduleService.get.mockResolvedValue({ data: shellSchedule })

    mockReq.body = { type: `prompt` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `prompt is required for prompt schedules`
    )
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

  it(`should call scheduleExecutor when configured`, async () => {
    const mockExecutor = vi.fn().mockResolvedValue(undefined)
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.markRun.mockResolvedValue({})
    ;(mockReq.app as any).locals.scheduleExecutor = mockExecutor

    await triggerSchedule.action(mockReq, mockRes)

    expect(mockExecutor).toHaveBeenCalledWith(mockSchedule)
  })

  it(`should throw 500 when scheduleExecutor fails`, async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error(`Execution error`))
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.incrementErrors.mockResolvedValue({})
    ;(mockReq.app as any).locals.scheduleExecutor = mockExecutor

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule execution failed: Execution error`
    )
    expect(scheduleService.incrementErrors).toHaveBeenCalledWith(`sched-1`)
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

  it(`should throw 500 when markRun fails`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.markRun.mockResolvedValue({ error: { message: `Mark run error` } })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to trigger schedule`
    )
  })
})
