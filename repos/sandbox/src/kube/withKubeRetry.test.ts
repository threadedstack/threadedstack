import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TSB/utils/logger`, () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { withKubeRetry } from './withKubeRetry'
import { logger } from '@TSB/utils/logger'
import { KubeRetryInitialDelayMs } from '@TSB/constants/kube'

const statusErr = (code: number) => Object.assign(new Error(`boom`), { code })

describe(`withKubeRetry`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it(`returns the result on first success without retrying`, async () => {
    const fn = vi.fn().mockResolvedValue(`ok`)
    const result = await withKubeRetry(`test`, fn)

    expect(result).toBe(`ok`)
    expect(fn).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it(`retries on a 504 then succeeds, with backoff delay`, async () => {
    const fn = vi.fn().mockRejectedValueOnce(statusErr(504)).mockResolvedValueOnce(`ok`)

    const promise = withKubeRetry(`getPod(foo)`, fn)
    await vi.advanceTimersByTimeAsync(KubeRetryInitialDelayMs)
    const result = await promise

    expect(result).toBe(`ok`)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalledOnce()
  })

  it.each([429, 500, 502, 503, 504])(`treats %d as retryable`, async (code) => {
    const fn = vi.fn().mockRejectedValueOnce(statusErr(code)).mockResolvedValueOnce(`ok`)

    const promise = withKubeRetry(`test`, fn)
    await vi.advanceTimersByTimeAsync(KubeRetryInitialDelayMs)
    const result = await promise

    expect(result).toBe(`ok`)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it(`does not retry a non-retryable error (404) — throws immediately`, async () => {
    const err = statusErr(404)
    const fn = vi.fn().mockRejectedValue(err)

    await expect(withKubeRetry(`test`, fn)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledOnce()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it(`gives up after maxAttempts and throws the last error`, async () => {
    const err = statusErr(503)
    const fn = vi.fn().mockRejectedValue(err)

    const promise = withKubeRetry(`test`, fn)
    const assertion = expect(promise).rejects.toBe(err)

    // Two retries configured (KubeRetryMaxAttempts=2): drain both backoff delays.
    await vi.advanceTimersByTimeAsync(KubeRetryInitialDelayMs)
    await vi.advanceTimersByTimeAsync(KubeRetryInitialDelayMs * 2)
    await assertion

    expect(fn).toHaveBeenCalledTimes(3)
  })

  it(`applies exponential backoff between retries`, async () => {
    const err = statusErr(500)
    const fn = vi.fn().mockRejectedValue(err)
    const waitSpy = vi.spyOn(global, `setTimeout`)

    const promise = withKubeRetry(`test`, fn)
    const assertion = expect(promise).rejects.toBe(err)
    await vi.advanceTimersByTimeAsync(KubeRetryInitialDelayMs)
    await vi.advanceTimersByTimeAsync(KubeRetryInitialDelayMs * 2)
    await assertion

    const delays = waitSpy.mock.calls.map((call) => call[1])
    expect(delays).toContain(KubeRetryInitialDelayMs)
    expect(delays).toContain(KubeRetryInitialDelayMs * 2)
  })
})
