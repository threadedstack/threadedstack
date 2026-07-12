import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * stdio.ts monkey-patches process.stdout.write / process.stderr.write at
 * import time. Each test reassigns those to fresh spies BEFORE dynamically
 * (re-)importing the module (via vi.resetModules()), so stdio.ts's captured
 * `orgStdOut`/`orgStdErr` closures point at OUR spies — letting us assert on
 * exactly what reaches the "real" write after redaction, without leaking the
 * patch into any other test file.
 */
describe(`stdio`, () => {
  const realStdoutWrite = process.stdout.write.bind(process.stdout)
  const realStderrWrite = process.stderr.write.bind(process.stderr)

  let stdoutSpy: ReturnType<typeof vi.fn>
  let stderrSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    delete process.env.STL_FORCE_DISABLE_SAFE
    process.env.TDSK_TEST_COLORS = `0`

    stdoutSpy = vi.fn().mockReturnValue(true)
    stderrSpy = vi.fn().mockReturnValue(true)
    process.stdout.write = stdoutSpy as any
    process.stderr.write = stderrSpy as any

    await import(`./stdio`)
  })

  afterEach(() => {
    process.stdout.write = realStdoutWrite
    process.stderr.write = realStderrWrite
    delete process.env.STL_FORCE_DISABLE_SAFE
    delete process.env.TDSK_TEST_COLORS
  })

  it(`strips ANSI color codes and redacts a secret pattern before the real stdout write`, () => {
    process.stdout.write(`\x1b[31mtoken: super-secret-value\x1b[0m`)

    expect(stdoutSpy).toHaveBeenCalledTimes(1)
    const written = stdoutSpy.mock.calls[0][0] as string
    expect(written).not.toContain(`\x1b[31m`)
    expect(written).toContain(`****`)
    expect(written).not.toContain(`super-secret-value`)
  })

  it(`strips ANSI color codes and redacts a secret pattern before the real stderr write`, () => {
    process.stderr.write(`\x1b[31mpassword: hunter2\x1b[0m`)

    expect(stderrSpy).toHaveBeenCalledTimes(1)
    const written = stderrSpy.mock.calls[0][0] as string
    expect(written).not.toContain(`\x1b[31m`)
    expect(written).toContain(`****`)
    expect(written).not.toContain(`hunter2`)
  })

  it(`bypasses redaction but still strips colors when STL_FORCE_DISABLE_SAFE is set`, () => {
    process.env.STL_FORCE_DISABLE_SAFE = `true`

    process.stdout.write(`\x1b[31mtoken: super-secret-value\x1b[0m`)

    expect(stdoutSpy).toHaveBeenCalledTimes(1)
    const written = stdoutSpy.mock.calls[0][0] as string
    expect(written).not.toContain(`\x1b[31m`)
    expect(written).toContain(`super-secret-value`)
  })

  it(`bypasses redaction on stderr too when STL_FORCE_DISABLE_SAFE is set`, () => {
    process.env.STL_FORCE_DISABLE_SAFE = `true`

    process.stderr.write(`password: hunter2`)

    expect(stderrSpy).toHaveBeenCalledWith(`password: hunter2`)
  })

  it(`passes through text with no colors or secrets unchanged`, () => {
    process.stdout.write(`hello world`)

    expect(stdoutSpy).toHaveBeenCalledWith(`hello world`)
  })

  it(`forwards additional write() arguments (encoding/callback) to the real write`, () => {
    const cb = vi.fn()
    process.stdout.write(`hello`, `utf-8`, cb)

    expect(stdoutSpy).toHaveBeenCalledWith(`hello`, `utf-8`, cb)
  })
})
