import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@tdsk/logger`, () => ({
  Logger: { pair: vi.fn(), stdout: vi.fn(), stderr: vi.fn() },
}))

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }))
vi.mock(`node:child_process`, () => ({ spawn: mockSpawn }))

import { Logger } from '@tdsk/logger'

import { spawn } from './spawn'

const makeFakeChild = () => {
  const child: any = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stdout.setEncoding = vi.fn()
  child.stderr = new EventEmitter()
  child.stderr.setEncoding = vi.fn()
  child.stdin = { write: vi.fn(), end: vi.fn() }
  child.unref = vi.fn()
  child.kill = vi.fn()
  return child
}

describe(`spawn`, () => {
  let child: ReturnType<typeof makeFakeChild>

  beforeEach(() => {
    vi.clearAllMocks()
    child = makeFakeChild()
    mockSpawn.mockReturnValue(child)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it(`writes and closes stdin when a stdin string is provided, forcing a pipe on fd 0`, async () => {
    const prom = spawn({ cmd: `docker`, args: [`login`], cwd: `/tmp`, stdin: `s3cr3t` })

    expect(mockSpawn).toHaveBeenCalledWith(
      `docker`,
      [`login`],
      expect.objectContaining({ stdio: [`pipe`, `inherit`, `inherit`] })
    )
    expect(child.stdin.write).toHaveBeenCalledWith(`s3cr3t`)
    expect(child.stdin.end).toHaveBeenCalled()

    child.emit(`close`, 0)
    await expect(prom).resolves.toBe(0)
  })

  it(`never forces a pipe and never touches stdin when no stdin string is given`, async () => {
    const prom = spawn({ cmd: `echo`, args: [`hi`], cwd: `/tmp` })

    expect(mockSpawn).toHaveBeenCalledWith(
      `echo`,
      [`hi`],
      expect.objectContaining({ stdio: `inherit` })
    )
    expect(child.stdin.write).not.toHaveBeenCalled()
    expect(child.stdin.end).not.toHaveBeenCalled()

    child.emit(`close`, 0)
    await expect(prom).resolves.toBe(0)
  })

  it(`redacts the value following a sensitive flag in the [Running CMD] log line`, async () => {
    const prom = spawn({
      cmd: `docker`,
      args: [`login`, `registry.example.com`, `-u`, `alice`, `-p`, `s3cr3t`],
      cwd: `/tmp`,
      log: true,
    })

    expect(Logger.pair).toHaveBeenCalledWith(
      `[Running CMD]`,
      `docker login registry.example.com -u alice -p ***REDACTED***`
    )
    // The real secret string is never passed to the logger at all.
    expect(Logger.pair).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining(`s3cr3t`)
    )

    child.emit(`close`, 0)
    await expect(prom).resolves.toBe(0)
  })

  it(`does not touch args with no sensitive flags`, async () => {
    const prom = spawn({
      cmd: `docker`,
      args: [`build`, `-t`, `myimage`],
      cwd: `/tmp`,
      log: true,
    })

    expect(Logger.pair).toHaveBeenCalledWith(`[Running CMD]`, `docker build -t myimage`)

    child.emit(`close`, 0)
    await expect(prom).resolves.toBe(0)
  })

  it(`resolves with the exit code on close and forwards it via the close callback`, async () => {
    const close = vi.fn()
    const prom = spawn({ cmd: `docker`, args: [`push`], cwd: `/tmp`, close })

    child.emit(`close`, 1)
    await expect(prom).resolves.toBe(1)
    expect(close).toHaveBeenCalledWith(1)
  })

  const ProcessExitEvents = [
    `exit`,
    `SIGINT`,
    `SIGUSR1`,
    `SIGUSR2`,
    `uncaughtException`,
    `SIGTERM`,
  ] as const

  it(`removes its process-level exit-signal listeners once the child closes (no leak)`, async () => {
    const before = ProcessExitEvents.map((e) => process.listenerCount(e))

    const prom = spawn({ cmd: `docker`, args: [`ps`], cwd: `/tmp` })

    // Each of the 6 events gains exactly one listener while the child is alive.
    ProcessExitEvents.forEach((e, i) =>
      expect(process.listenerCount(e)).toBe(before[i] + 1)
    )

    child.emit(`close`, 0)
    await prom

    ProcessExitEvents.forEach((e, i) => expect(process.listenerCount(e)).toBe(before[i]))
  })

  it(`does not accumulate listeners across many sequential spawn calls`, async () => {
    const before = ProcessExitEvents.map((e) => process.listenerCount(e))

    for (let i = 0; i < 10; i++) {
      const localChild = makeFakeChild()
      mockSpawn.mockReturnValue(localChild)
      const prom = spawn({ cmd: `docker`, args: [`ps`], cwd: `/tmp` })
      localChild.emit(`close`, 0)
      await prom
    }

    ProcessExitEvents.forEach((e, i) => expect(process.listenerCount(e)).toBe(before[i]))
  })

  it(`removes its process-level exit-signal listeners when the child errors`, async () => {
    const before = ProcessExitEvents.map((e) => process.listenerCount(e))

    const prom = spawn({ cmd: `docker`, args: [`ps`], cwd: `/tmp` })
    prom.catch(() => {})

    child.emit(`error`, new Error(`spawn failed`))
    await expect(prom).rejects.toThrow(`spawn failed`)

    ProcessExitEvents.forEach((e, i) => expect(process.listenerCount(e)).toBe(before[i]))
  })

  describe(`timeoutMs`, () => {
    it(`SIGTERMs a hanging process and rejects with a timeout error when timeoutMs elapses, then SIGKILLs after the grace period if it still hasn't exited`, async () => {
      vi.useFakeTimers()

      const prom = spawn({
        cmd: `sleep`,
        args: [`9999`],
        cwd: `/tmp`,
        timeoutMs: 1_000,
      })
      prom.catch(() => {})

      await vi.advanceTimersByTimeAsync(1_000)
      expect(child.kill).toHaveBeenCalledWith(`SIGTERM`)
      await expect(prom).rejects.toThrow(`Command timed out after 1000ms: sleep 9999`)

      expect(child.kill).not.toHaveBeenCalledWith(`SIGKILL`)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(child.kill).toHaveBeenCalledWith(`SIGKILL`)
    })

    it(`does not SIGKILL after the grace period if the process already exited from the SIGTERM`, async () => {
      vi.useFakeTimers()

      const prom = spawn({
        cmd: `sleep`,
        args: [`9999`],
        cwd: `/tmp`,
        timeoutMs: 1_000,
      })
      prom.catch(() => {})

      await vi.advanceTimersByTimeAsync(1_000)
      expect(child.kill).toHaveBeenCalledWith(`SIGTERM`)
      await expect(prom).rejects.toThrow(`timed out`)

      child.emit(`exit`, null, `SIGTERM`)
      await vi.advanceTimersByTimeAsync(5_000)
      expect(child.kill).not.toHaveBeenCalledWith(`SIGKILL`)
    })

    it(`never fires the timeout/kill if the process closes on its own before timeoutMs elapses`, async () => {
      vi.useFakeTimers()

      const prom = spawn({ cmd: `echo`, args: [`hi`], cwd: `/tmp`, timeoutMs: 5_000 })
      child.emit(`close`, 0)
      await expect(prom).resolves.toBe(0)

      await vi.advanceTimersByTimeAsync(5_000)
      expect(child.kill).not.toHaveBeenCalled()
    })

    it(`never starts a timer when timeoutMs is not provided (unbounded, existing behavior)`, async () => {
      vi.useFakeTimers()

      const prom = spawn({ cmd: `sleep`, args: [`9999`], cwd: `/tmp` })
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
      expect(child.kill).not.toHaveBeenCalled()

      child.emit(`close`, 0)
      await expect(prom).resolves.toBe(0)
    })
  })
})
