import type { TTaskActionArgs } from '@TSCL/types'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@tdsk/logger`, () => ({
  Logger: {
    header: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    pair: vi.fn(),
    stdout: vi.fn(),
    empty: vi.fn(),
  },
}))

vi.mock(`@TSCL/utils/config/getCtx`, () => ({
  getCtx: (props: any) => ({ deployment: `tdsk-${props.params.context}` }),
}))

vi.mock(`@TSCL/utils/kube/getKubeMeta`, () => ({
  getKubeMeta: () => ({ context: `test-ctx`, namespace: `test-ns` }),
}))

const { mockCapture } = vi.hoisted(() => ({ mockCapture: vi.fn() }))
vi.mock(`@TSCL/utils/proc/capture`, () => ({ capture: mockCapture }))

vi.mock(`@TSCL/utils/tasks/error`, () => ({ taskError: vi.fn() }))

import { taskError } from '@TSCL/utils/tasks/error'
import { rollback, verifyOrRollback, writeRollbackOutcome } from './verify'

const props = {
  params: {},
  config: { envs: { TDSK_PX_URL: `https://example.test` } },
} as unknown as TTaskActionArgs

const previous = { caddy: `caddy:old`, proxy: `proxy:old`, backend: `backend:old` }

/** curl calls: 2 per health check (proxy, backend). `healthyFromCall` marks the
 *  1-indexed curl call number at which health flips to OK (and stays OK). */
const mockCaptureWithHealthFlip = (healthyFromCall: number) => {
  let curlCalls = 0
  mockCapture.mockImplementation((cmd: string) => {
    if (cmd === `curl`) {
      curlCalls++
      const healthy = curlCalls >= healthyFromCall
      return Promise.resolve({ code: 0, output: healthy ? `200` : `000`, error: `` })
    }
    // kubectl set image / rollout status — always succeed
    return Promise.resolve({ code: 0, output: ``, error: `` })
  })
  return () => curlCalls
}

describe(`rollback`, () => {
  beforeEach(() => {
    mockCapture.mockReset()
  })

  it(`returns false immediately when there is no previous image data`, async () => {
    const result = await rollback(props, {})
    expect(result).toBe(false)
    expect(mockCapture).not.toHaveBeenCalled()
  })

  it(`succeeds on the first attempt when rollback health checks pass`, async () => {
    const getCurlCalls = mockCaptureWithHealthFlip(1)
    const result = await rollback(props, previous)
    expect(result).toBe(true)
    expect(getCurlCalls()).toBe(2)
  })

  it(`retries once and recovers when the first attempt is unhealthy`, async () => {
    // First attempt (calls 1-2) unhealthy, second attempt (calls 3-4) healthy
    const getCurlCalls = mockCaptureWithHealthFlip(3)
    const result = await rollback(props, previous)
    expect(result).toBe(true)
    expect(getCurlCalls()).toBe(4)
  })

  it(`returns false after exhausting all retry attempts`, async () => {
    const getCurlCalls = mockCaptureWithHealthFlip(Number.POSITIVE_INFINITY)
    const result = await rollback(props, previous)
    expect(result).toBe(false)
    // 2 attempts x 2 health-check calls each
    expect(getCurlCalls()).toBe(4)
  })

  it(`honors an explicit lower attempts count (no retry)`, async () => {
    const getCurlCalls = mockCaptureWithHealthFlip(Number.POSITIVE_INFINITY)
    const result = await rollback(props, previous, 1)
    expect(result).toBe(false)
    expect(getCurlCalls()).toBe(2)
  })
})

describe(`writeRollbackOutcome`, () => {
  const original = process.env.GITHUB_OUTPUT
  let tmpFile: string

  beforeEach(() => {
    tmpFile = path.join(
      os.tmpdir(),
      `verify-test-github-output-${Date.now()}-${Math.random()}`
    )
    fs.writeFileSync(tmpFile, ``)
    process.env.GITHUB_OUTPUT = tmpFile
  })

  afterEach(() => {
    fs.rmSync(tmpFile, { force: true })
    original === undefined
      ? delete process.env.GITHUB_OUTPUT
      : (process.env.GITHUB_OUTPUT = original)
  })

  it(`writes rollback_failed=true when recovery failed`, () => {
    writeRollbackOutcome(false)
    expect(fs.readFileSync(tmpFile, `utf8`)).toBe(`rollback_failed=true\n`)
  })

  it(`writes rollback_failed=false when recovery succeeded`, () => {
    writeRollbackOutcome(true)
    expect(fs.readFileSync(tmpFile, `utf8`)).toBe(`rollback_failed=false\n`)
  })

  it(`is a no-op when GITHUB_OUTPUT is unset`, () => {
    delete process.env.GITHUB_OUTPUT
    expect(() => writeRollbackOutcome(false)).not.toThrow()
  })
})

describe(`verifyOrRollback`, () => {
  beforeEach(() => {
    mockCapture.mockReset()
    vi.mocked(taskError).mockReset()
    delete process.env.GITHUB_OUTPUT
  })

  it(`succeeds without rolling back or erroring when the deploy is healthy`, async () => {
    mockCaptureWithHealthFlip(1)
    await verifyOrRollback(props, previous)
    expect(taskError).not.toHaveBeenCalled()
  })

  it(`rolls back, records the outcome, and still fails the task when unhealthy`, async () => {
    const tmpFile = path.join(
      os.tmpdir(),
      `verify-test-vor-${Date.now()}-${Math.random()}`
    )
    fs.writeFileSync(tmpFile, ``)
    process.env.GITHUB_OUTPUT = tmpFile

    // Initial waitForRollout + healthCheck (2 curl calls) unhealthy, then
    // rollback's own attempts also stay unhealthy forever.
    mockCaptureWithHealthFlip(Number.POSITIVE_INFINITY)

    await verifyOrRollback(props, previous)

    expect(taskError).toHaveBeenCalledWith(
      expect.stringContaining(`Deployment failed health checks`)
    )
    expect(fs.readFileSync(tmpFile, `utf8`)).toBe(`rollback_failed=true\n`)
    fs.rmSync(tmpFile, { force: true })
  })
})
