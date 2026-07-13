import type { TTaskActionArgs } from '@TSCL/types'

import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@tdsk/logger`, () => ({
  Logger: {
    pair: vi.fn(),
    stdout: vi.fn(),
    stderr: vi.fn(),
    header: vi.fn(),
    error: vi.fn(),
    empty: vi.fn(),
  },
}))

vi.mock(`@TSCL/utils/tasks/error`, () => ({ taskError: vi.fn() }))

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))
vi.mock(`node:child_process`, () => ({ spawn: mockSpawn }))

import { taskError } from '@TSCL/utils/tasks/error'
import { pushSafe } from './pushSafe'

const makeFakeChild = () => {
  const child: any = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stdout.setEncoding = vi.fn()
  child.stderr = new EventEmitter()
  child.stderr.setEncoding = vi.fn()
  // A real killed process eventually emits close with a null exit code
  // (terminated by signal) — mirror that so the timeout path resolves.
  child.kill = vi.fn(() => child.emit(`close`, null))
  return child
}

const config = {
  paths: { repos: `/tmp/repos` },
  envs: { TDSK_DB_URL: `postgresql://fake:fake@localhost:5432/tdsk` },
} as unknown as TTaskActionArgs[`config`]

describe(`pushSafe`, () => {
  let vectorChild: ReturnType<typeof makeFakeChild>
  let pushChild: ReturnType<typeof makeFakeChild>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vectorChild = makeFakeChild()
    pushChild = makeFakeChild()
    // First spawn call is always ensureVectorExtension's `pnpm sql ...`,
    // second is the main `pnpm push` — matches pushSafe's call order.
    mockSpawn.mockReturnValueOnce(vectorChild).mockReturnValueOnce(pushChild)
  })

  it(`triggers taskError and blocks the deploy when destructive output is detected`, async () => {
    const prom = pushSafe({ config })

    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1))
    vectorChild.emit(`close`, 0)

    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2))
    pushChild.stdout.emit(`data`, `Warning: this statement is about to delete data`)
    pushChild.emit(`close`, 0)

    await prom

    expect(taskError).toHaveBeenCalledTimes(1)
    expect(taskError).toHaveBeenCalledWith(
      expect.stringContaining(`Destructive database schema change detected`)
    )
  })

  it(`kills the child and calls taskError when the push hangs past timeoutMs`, async () => {
    vi.useFakeTimers()

    const prom = pushSafe({ config, timeoutMs: 5000 })
    prom.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)
    expect(mockSpawn).toHaveBeenCalledTimes(1)
    vectorChild.emit(`close`, 0)

    await vi.advanceTimersByTimeAsync(0)
    expect(mockSpawn).toHaveBeenCalledTimes(2)

    // Never emit close on pushChild — advance past the timeout so the
    // internal setTimeout fires and kills it.
    await vi.advanceTimersByTimeAsync(5100)

    await prom

    expect(pushChild.kill).toHaveBeenCalledWith(`SIGKILL`)
    expect(taskError).toHaveBeenCalledWith(
      expect.stringContaining(`Destructive database schema change detected`)
    )

    vi.useRealTimers()
  })

  it(`succeeds without calling taskError on clean additive output with exit 0`, async () => {
    const prom = pushSafe({ config })

    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1))
    vectorChild.emit(`close`, 0)

    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2))
    pushChild.stdout.emit(`data`, `Creating table "widgets"...\nDone.`)
    pushChild.emit(`close`, 0)

    await expect(prom).resolves.toBeUndefined()
    expect(taskError).not.toHaveBeenCalled()
  })

  it(`calls taskError on a non-zero exit with no destructive signal`, async () => {
    const prom = pushSafe({ config })

    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(1))
    vectorChild.emit(`close`, 0)

    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(2))
    pushChild.stdout.emit(`data`, `Some unrelated failure output`)
    pushChild.emit(`close`, 1)

    await prom

    expect(taskError).toHaveBeenCalledTimes(1)
    expect(taskError).toHaveBeenCalledWith(
      expect.stringContaining(`Database schema push failed (exit code 1)`)
    )
  })
})
