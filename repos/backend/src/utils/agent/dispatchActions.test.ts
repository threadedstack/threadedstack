import type { Schedule } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { dispatchActions } from './dispatchActions'
import { invokeAction } from '@TBE/utils/agent/invokeAction'
import { ActionsBlockFence } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock only the dispatch core — parseActionsBlock stays real so the stdout block
// is parsed end-to-end.
vi.mock(`@TBE/utils/agent/invokeAction`, () => ({
  invokeAction: vi.fn(),
}))

const mockInvoke = invokeAction as ReturnType<typeof vi.fn>

const fence = (json: string) => `\`\`\`${ActionsBlockFence}\n${json}\n\`\`\``

const mockDb = {}
const app = { locals: { db: mockDb } } as any

const buildSchedule = (actions?: any): Schedule =>
  ({ id: `sch-1`, projectId: `proj-1`, actions }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`dispatchActions`, () => {
  it(`is a no-op when the schedule sets no actions (invokeAction not called)`, async () => {
    await expect(
      dispatchActions(app, buildSchedule(undefined), `ag_1`, fence(`[{"function":"f"}]`))
    ).resolves.toBeUndefined()
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it(`is a no-op when the actions allowlist is empty`, async () => {
    await dispatchActions(
      app,
      buildSchedule({ functions: [] }),
      `ag_1`,
      fence(`[{"function":"f"}]`)
    )
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it(`is a no-op when stdout carries no actions block even if opted in`, async () => {
    await dispatchActions(
      app,
      buildSchedule({ functions: [`f`] }),
      `ag_1`,
      `no block here`
    )
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it(`invokes each parsed action through the core with the schedule allowlist`, async () => {
    mockInvoke.mockResolvedValue({ ok: true, data: { done: true } })
    const schedule = buildSchedule({ functions: [`f`] })

    await dispatchActions(
      app,
      schedule,
      `ag_1`,
      fence(`[{"function":"f","args":{"x":1}}]`)
    )

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith(
      app,
      mockDb,
      `proj-1`,
      { function: `f`, args: { x: 1 } },
      [`f`]
    )
  })

  it(`isolates a failing action — a throw does not block the next action or bubble up`, async () => {
    mockInvoke
      .mockRejectedValueOnce(new Error(`kaboom`))
      .mockResolvedValueOnce({ ok: true, data: null })
    const schedule = buildSchedule({ functions: [`f`, `g`] })

    await expect(
      dispatchActions(
        app,
        schedule,
        `ag_1`,
        fence(`[{"function":"f","args":{}},{"function":"g","args":{}}]`)
      )
    ).resolves.toBeUndefined()

    expect(mockInvoke).toHaveBeenCalledTimes(2)
    expect(mockInvoke).toHaveBeenNthCalledWith(
      2,
      app,
      mockDb,
      `proj-1`,
      {
        function: `g`,
        args: {},
      },
      [`f`, `g`]
    )
  })

  it(`passes a non-allowlisted function through to the core (which returns { ok:false }) and continues`, async () => {
    mockInvoke.mockResolvedValue({ ok: false, error: `function not allowed: g` })
    const schedule = buildSchedule({ functions: [`f`] })

    await expect(
      dispatchActions(app, schedule, `ag_1`, fence(`[{"function":"g","args":{}}]`))
    ).resolves.toBeUndefined()

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith(
      app,
      mockDb,
      `proj-1`,
      {
        function: `g`,
        args: {},
      },
      [`f`]
    )
  })
})
