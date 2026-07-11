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
import { listScheduleRuns } from './listScheduleRuns'
import { getScheduleRun } from './getScheduleRun'
import { getScheduleRunOutput } from './getScheduleRunOutput'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

// Partial mock: the cron helpers live in @tdsk/domain (shared with the resident
// runtime); everything else (Schedule model, Exception, enums) stays real.
vi.mock(`@tdsk/domain`, async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tdsk/domain')>()),
  isValidCron: vi.fn().mockReturnValue(true),
  parseNextRun: vi.fn().mockReturnValue(new Date(`2026-04-01T00:00:00Z`)),
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const mockSchedule = {
  id: `sched-1`,
  orgId: `org-1`,
  projectId: `proj-1`,
  sandboxId: `sb-1`,
  type: `prompt`,
  cronExpression: `*/5 * * * *`,
  prompt: `Run the task`,
  enabled: true,
  nextRunAt: new Date(`2026-03-01T10:00:00Z`),
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
    getProjectConfig: vi
      .fn()
      .mockResolvedValue({ data: { sandboxId: `sb-1`, projectId: `proj-1` } }),
  }

  const projectService = {
    get: vi.fn().mockResolvedValue({ data: { id: `proj-1`, orgId: `org-1` } }),
  }

  const scheduleRunService = {
    listBySchedule: vi.fn(),
    get: vi.fn(),
    hasRunning: vi.fn(),
  }

  const agentService = {
    get: vi.fn(),
  }

  const s3 = {
    active: true,
    getObject: vi.fn(),
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
            agent: agentService,
            schedule: scheduleService,
            sandbox: sandboxService,
            project: projectService,
            scheduleRun: scheduleRunService,
          },
        },
        s3,
      },
    } as any,
    user: { id: `user-1`, email: `test@example.com` } as any,
    params: { orgId: `org-1`, projectId: `proj-1` },
    query: {},
    body: {},
  } as unknown as TRequest

  return {
    mockReq,
    mockRes,
    mockJson,
    mockStatus,
    agentService,
    scheduleService,
    sandboxService,
    projectService,
    scheduleRunService,
    s3,
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

    expect(scheduleService.list).toHaveBeenCalledWith({
      where: { orgId: `org-1`, projectId: `proj-1` },
    })
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

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(listSchedules.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
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
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any
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
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    await expect(getSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
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
    const { isValidCron } = vi.mocked(await import(`@tdsk/domain`))
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

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 404 when project not found`, async () => {
    const ctx = buildMockReqRes()
    ctx.projectService.get.mockResolvedValue({ data: null })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Project not found`
    )
  })

  it(`should throw 404 when project belongs to different org`, async () => {
    const ctx = buildMockReqRes()
    ctx.projectService.get.mockResolvedValue({
      data: { id: `proj-1`, orgId: `other-org` },
    })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Project not found`
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

  it(`should throw 404 when sandbox is not linked to project`, async () => {
    const ctx = buildMockReqRes()
    ctx.sandboxService.getProjectConfig.mockResolvedValue({
      error: new Error(`Sandbox is not linked to this project`),
    })
    ctx.mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
    }

    await expect(createSchedule.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Sandbox is not linked to this project`
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

  it(`accepts a valid agentId and passes it to schedule.create`, async () => {
    const {
      mockReq,
      mockRes,
      mockStatus,
      agentService,
      sandboxService,
      scheduleService,
    } = buildMockReqRes()
    agentService.get.mockResolvedValue({ data: { id: `ag_1`, orgId: `org-1` } })
    sandboxService.get.mockResolvedValue({ data: { id: `sb-1`, orgId: `org-1` } })
    sandboxService.getProjectConfig.mockResolvedValue({ data: {} })
    scheduleService.create.mockResolvedValue({ data: { id: `sd_1` } })
    mockReq.body = {
      agentId: `ag_1`,
      sandboxId: `sb-1`,
      prompt: `Review platform state`,
      cronExpression: `0 * * * *`,
    }
    await createSchedule.action(mockReq, mockRes)
    expect(scheduleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: `ag_1` })
    )
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`rejects a timeoutMs below the minimum`, async () => {
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
      timeoutMs: 59_999,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `timeoutMs must be an integer between 60000 and 28800000`
    )
    expect(scheduleService.create).not.toHaveBeenCalled()
  })

  it(`rejects a timeoutMs above the maximum`, async () => {
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
      timeoutMs: 28_800_001,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `timeoutMs must be an integer between 60000 and 28800000`
    )
    expect(scheduleService.create).not.toHaveBeenCalled()
  })

  it(`rejects a non-integer timeoutMs`, async () => {
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
      timeoutMs: 90_000.5,
    }

    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `timeoutMs must be an integer between 60000 and 28800000`
    )
    expect(scheduleService.create).not.toHaveBeenCalled()
  })

  it(`accepts a valid timeoutMs and passes it to schedule.create`, async () => {
    scheduleService.create.mockResolvedValue({ data: mockSchedule })
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
      timeoutMs: 3_600_000,
    }

    await createSchedule.action(mockReq, mockRes)

    expect(scheduleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 3_600_000 })
    )
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`accepts a null timeoutMs on create`, async () => {
    scheduleService.create.mockResolvedValue({ data: mockSchedule })
    mockReq.body = {
      cronExpression: `* * * * *`,
      prompt: `Run it`,
      sandboxId: `sb-1`,
      timeoutMs: null,
    }

    await createSchedule.action(mockReq, mockRes)

    expect(scheduleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: null })
    )
    expect(mockStatus).toHaveBeenCalledWith(201)
  })

  it(`rejects an agentId belonging to another org`, async () => {
    const { mockReq, mockRes, agentService, sandboxService } = buildMockReqRes()
    agentService.get.mockResolvedValue({ data: { id: `ag_1`, orgId: `other-org` } })
    sandboxService.get.mockResolvedValue({ data: { id: `sb-1`, orgId: `org-1` } })
    sandboxService.getProjectConfig.mockResolvedValue({ data: {} })
    mockReq.body = {
      agentId: `ag_1`,
      sandboxId: `sb-1`,
      prompt: `x`,
      cronExpression: `0 * * * *`,
    }
    await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Agent not found`
    )
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
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any
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
    sandboxService.getProjectConfig.mockResolvedValue({
      data: { sandboxId: `sb-2`, projectId: `proj-1` },
    })

    mockReq.body = { sandboxId: `sb-2` }

    await updateSchedule.action(mockReq, mockRes)

    expect(sandboxService.get).toHaveBeenCalledWith(`sb-2`)
    expect(sandboxService.getProjectConfig).toHaveBeenCalledWith(`sb-2`, `proj-1`)
    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: `sched-1`, sandboxId: `sb-2` })
    )
  })

  it(`should throw 404 when updated sandbox is not linked to project`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    sandboxService.get.mockResolvedValue({ data: { id: `sb-2`, orgId: `org-1` } })
    sandboxService.getProjectConfig.mockResolvedValue({
      error: new Error(`Sandbox is not linked to this project`),
    })

    mockReq.body = { sandboxId: `sb-2` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Sandbox is not linked to this project`
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
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    mockReq.body = { prompt: `New prompt` }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 400 when updated cron expression is invalid`, async () => {
    const { isValidCron } = vi.mocked(await import(`@tdsk/domain`))
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

  it(`rejects a timeoutMs below the minimum on update`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { timeoutMs: 59_999 }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `timeoutMs must be an integer between 60000 and 28800000`
    )
    expect(scheduleService.update).not.toHaveBeenCalled()
  })

  it(`rejects a timeoutMs above the maximum on update`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { timeoutMs: 28_800_001 }

    await expect(updateSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `timeoutMs must be an integer between 60000 and 28800000`
    )
    expect(scheduleService.update).not.toHaveBeenCalled()
  })

  it(`accepts a valid timeoutMs and passes it to schedule.update`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { timeoutMs: 3_600_000 }

    await updateSchedule.action(mockReq, mockRes)

    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: `sched-1`, timeoutMs: 3_600_000 })
    )
  })

  it(`accepts a null timeoutMs to clear the override`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, timeoutMs: 3_600_000 },
    })
    scheduleService.update.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { timeoutMs: null }

    await updateSchedule.action(mockReq, mockRes)

    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: `sched-1`, timeoutMs: null })
    )
  })

  it(`does not include timeoutMs in the update when not provided`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.update.mockResolvedValue({ data: mockSchedule })

    mockReq.body = { enabled: false }

    await updateSchedule.action(mockReq, mockRes)

    expect(scheduleService.update.mock.calls[0][0]).not.toHaveProperty(`timeoutMs`)
  })

  it(`clears the continuity threadId when agentId changes`, async () => {
    const { mockReq, mockRes, agentService, scheduleService } = buildMockReqRes()
    scheduleService.get.mockResolvedValue({
      data: {
        id: `sd_1`,
        orgId: `org-1`,
        projectId: `proj-1`,
        type: `prompt`,
        prompt: `x`,
        agentId: `ag_old`,
        threadId: `th_old`,
      },
    })
    agentService.get.mockResolvedValue({ data: { id: `ag_new`, orgId: `org-1` } })
    scheduleService.update.mockResolvedValue({ data: { id: `sd_1` } })
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sd_1` } as any
    mockReq.body = { agentId: `ag_new` }
    await updateSchedule.action(mockReq, mockRes)
    expect(scheduleService.update).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: `ag_new`, threadId: null })
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
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any
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
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    await expect(deleteSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
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

  let scheduleRunService: ReturnType<typeof buildMockReqRes>['scheduleRunService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    scheduleRunService = ctx.scheduleRunService
    scheduleRunService.hasRunning.mockResolvedValue({ data: false })
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any
  })

  it(`should trigger schedule and return data with triggered flag`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleService.markRun.mockResolvedValue({})

    await triggerSchedule.action(mockReq, mockRes)

    expect(scheduleRunService.hasRunning).toHaveBeenCalledWith(`sched-1`)

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
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
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
      `Failed to trigger schedule: Mark run error`
    )
  })

  it(`should throw 409 when a run is already in flight`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.hasRunning.mockResolvedValue({ data: true })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `A run for this schedule is already in progress`
    )
    expect(scheduleService.markRun).not.toHaveBeenCalled()
  })

  it(`should throw 500 when hasRunning check fails`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.hasRunning.mockResolvedValue({
      error: { message: `hasRunning DB error` },
    })

    await expect(triggerSchedule.action(mockReq, mockRes)).rejects.toThrow(
      `hasRunning DB error`
    )
    expect(scheduleService.markRun).not.toHaveBeenCalled()
  })
})

// ── LIST SCHEDULE RUNS ────────────────────────────────────────────

const mockRun = {
  id: `run-1`,
  orgId: `org-1`,
  projectId: `proj-1`,
  scheduleId: `sched-1`,
  status: `success`,
  startedAt: new Date(`2026-03-01T10:00:00Z`),
  durationMs: 5000,
}

describe(`GET /:scheduleId/runs - listScheduleRuns`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']
  let scheduleRunService: ReturnType<typeof buildMockReqRes>['scheduleRunService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    scheduleRunService = ctx.scheduleRunService
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any
  })

  it(`should return runs for schedule`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.listBySchedule.mockResolvedValue({ data: [mockRun] })

    await listScheduleRuns.action(mockReq, mockRes)

    expect(scheduleService.get).toHaveBeenCalledWith(`sched-1`)
    expect(scheduleRunService.listBySchedule).toHaveBeenCalledWith(`sched-1`, {
      limit: 20,
      offset: 0,
    })
    expect(mockJson).toHaveBeenCalledWith({ data: [mockRun] })
  })

  it(`should return empty array when no runs exist`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.listBySchedule.mockResolvedValue({ data: null })

    await listScheduleRuns.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1` } as any

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1` } as any

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 500 when schedule service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ error: { message: `DB error` } })

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(`DB error`)
  })

  it(`should throw 500 when run service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.listBySchedule.mockResolvedValue({
      error: { message: `Run list failed` },
    })

    await expect(listScheduleRuns.action(mockReq, mockRes)).rejects.toThrow(
      `Run list failed`
    )
  })
})

// ── GET SCHEDULE RUN ──────────────────────────────────────────────

describe(`GET /:scheduleId/runs/:runId - getScheduleRun`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']
  let scheduleRunService: ReturnType<typeof buildMockReqRes>['scheduleRunService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    scheduleService = ctx.scheduleService
    scheduleRunService = ctx.scheduleRunService
    mockReq.params = {
      orgId: `org-1`,
      projectId: `proj-1`,
      scheduleId: `sched-1`,
      runId: `run-1`,
    } as any
  })

  it(`should return run by id`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({ data: mockRun })

    await getScheduleRun.action(mockReq, mockRes)

    expect(scheduleService.get).toHaveBeenCalledWith(`sched-1`)
    expect(scheduleRunService.get).toHaveBeenCalledWith(`run-1`)
    expect(mockJson).toHaveBeenCalledWith({ data: mockRun })
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1`, runId: `run-1` } as any

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1`, runId: `run-1` } as any

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `projectId is required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, runId: `run-1` } as any

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId is required`
    )
  })

  it(`should throw 400 when runId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `runId is required`
    )
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when run not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({ data: null })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule run not found`
    )
  })

  it(`should throw 404 when run belongs to different schedule`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, scheduleId: `other-sched` },
    })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule run not found`
    )
  })

  it(`should throw 500 when schedule service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ error: { message: `DB error` } })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(`DB error`)
  })

  it(`should throw 500 when run service returns error`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({ error: { message: `Run get failed` } })

    await expect(getScheduleRun.action(mockReq, mockRes)).rejects.toThrow(
      `Run get failed`
    )
  })
})

// ── GET SCHEDULE RUN OUTPUT ───────────────────────────────────────

describe(`GET /:scheduleId/runs/:runId/output - getScheduleRunOutput`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let scheduleService: ReturnType<typeof buildMockReqRes>['scheduleService']
  let scheduleRunService: ReturnType<typeof buildMockReqRes>['scheduleRunService']
  let s3: ReturnType<typeof buildMockReqRes>['s3']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    scheduleService = ctx.scheduleService
    scheduleRunService = ctx.scheduleRunService
    s3 = ctx.s3
    mockReq.params = {
      orgId: `org-1`,
      projectId: `proj-1`,
      scheduleId: `sched-1`,
      runId: `run-1`,
    } as any
    mockReq.query = { stream: `stdout` } as any
    ;(mockRes as any).setHeader = vi.fn()
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { projectId: `proj-1`, scheduleId: `sched-1`, runId: `run-1` } as any

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `orgId parameter required`
    )
  })

  it(`should throw 400 when projectId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, scheduleId: `sched-1`, runId: `run-1` } as any

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `projectId parameter required`
    )
  })

  it(`should throw 400 when scheduleId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, runId: `run-1` } as any

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `scheduleId parameter required`
    )
  })

  it(`should throw 400 when runId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sched-1` } as any

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `runId parameter required`
    )
  })

  it(`should throw 503 when s3 is not active`, async () => {
    s3.active = false

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `S3 not configured`
    )
  })

  it(`should throw 400 when stream is invalid`, async () => {
    mockReq.query = { stream: `invalid` } as any

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `stream must be "stdout" or "stderr"`
    )
  })

  it(`should throw 404 when schedule not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: null })

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different project`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, projectId: `other-proj` },
    })

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when schedule belongs to different org`, async () => {
    scheduleService.get.mockResolvedValue({
      data: { ...mockSchedule, orgId: `other-org` },
    })

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule not found`
    )
  })

  it(`should throw 404 when run not found`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({ data: null })

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule run not found`
    )
  })

  it(`should throw 404 when run belongs to different schedule`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, scheduleId: `other-sched` },
    })

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Schedule run not found`
    )
  })

  it(`should throw 404 when no output key exists`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, stdoutKey: undefined },
    })

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `No stdout output recorded for this run`
    )
  })

  it(`should throw 404 when S3 returns NoSuchKey`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, stdoutKey: `org-1/runs/run-1/stdout` },
    })
    s3.getObject.mockRejectedValue(
      Object.assign(new Error(`not found`), { name: `NoSuchKey` })
    )

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Run output is no longer available`
    )
  })

  it(`should throw 502 when S3 returns other error`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, stdoutKey: `org-1/runs/run-1/stdout` },
    })
    s3.getObject.mockRejectedValue(new Error(`S3 connection failed`))

    await expect(getScheduleRunOutput.action(mockReq, mockRes)).rejects.toThrow(
      `Failed to retrieve run output`
    )
  })

  it(`should stream stdout output on success`, async () => {
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, stdoutKey: `org-1/runs/run-1/stdout` },
    })
    const mockReadable = { on: vi.fn(), pipe: vi.fn() }
    s3.getObject.mockResolvedValue(mockReadable)

    await getScheduleRunOutput.action(mockReq, mockRes)

    expect(s3.getObject).toHaveBeenCalledWith(`org-1/runs/run-1/stdout`)
    expect((mockRes as any).setHeader).toHaveBeenCalledWith(
      `Content-Type`,
      `application/octet-stream`
    )
    expect(mockReadable.pipe).toHaveBeenCalledWith(mockRes)
  })

  it(`should use stderrKey when stream=stderr`, async () => {
    mockReq.query = { stream: `stderr` } as any
    scheduleService.get.mockResolvedValue({ data: mockSchedule })
    scheduleRunService.get.mockResolvedValue({
      data: { ...mockRun, stderrKey: `org-1/runs/run-1/stderr` },
    })
    const mockReadable = { on: vi.fn(), pipe: vi.fn() }
    s3.getObject.mockResolvedValue(mockReadable)

    await getScheduleRunOutput.action(mockReq, mockRes)

    expect(s3.getObject).toHaveBeenCalledWith(`org-1/runs/run-1/stderr`)
    expect(mockReadable.pipe).toHaveBeenCalledWith(mockRes)
  })
})
