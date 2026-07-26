import type { TSandboxActionOpts } from '@TTH/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockToastError = vi.fn()
const mockOpenSession = vi.fn()
const mockGetSessionsForSandbox = vi.fn()
const mockStopSandbox = vi.fn()
const mockEstimateTerminalDimensions = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
  },
}))

vi.mock('@TTH/actions/sessions', () => ({
  openSession: (...args: any[]) => mockOpenSession(...args),
}))

vi.mock('@TTH/state/accessors', () => ({
  getSessionsForSandbox: (...args: any[]) => mockGetSessionsForSandbox(...args),
}))

vi.mock('@TTH/actions/sandboxes/stopSandbox', () => ({
  stopSandbox: (...args: any[]) => mockStopSandbox(...args),
}))

vi.mock('@TTH/utils/terminal', () => ({
  estimateTerminalDimensions: () => mockEstimateTerminalDimensions(),
}))

import { restartSandbox } from './restartSandbox'

const opts: TSandboxActionOpts = {
  orgId: `og_1`,
  projectId: `pj_1`,
  sandboxId: `sb_1`,
  instanceId: `in_1`,
}

const dims = { cols: 80, rows: 24 }

describe(`restartSandbox`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStopSandbox.mockResolvedValue(undefined)
    mockEstimateTerminalDimensions.mockReturnValue(dims)
    mockOpenSession.mockResolvedValue(undefined)
  })

  it(`clamps total to 1 and still opens one fresh session when there are no prior sessions`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([])

    const result = await restartSandbox(opts)

    expect(result).toEqual({ opened: 1, total: 1 })
    expect(mockOpenSession).toHaveBeenCalledTimes(1)
  })

  it(`uses the prior session count as total and reopens that many sessions on full success`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }, { id: `s3` }])

    const result = await restartSandbox(opts)

    expect(result).toEqual({ opened: 3, total: 3 })
    expect(mockOpenSession).toHaveBeenCalledTimes(3)
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it(`always awaits stopSandbox with force:true before any openSession call`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }])
    const order: string[] = []
    mockStopSandbox.mockImplementation(async () => {
      order.push(`stopSandbox`)
    })
    mockOpenSession.mockImplementation(async () => {
      order.push(`openSession`)
    })

    await restartSandbox(opts)

    expect(mockStopSandbox).toHaveBeenCalledWith({
      sandboxId: `sb_1`,
      orgId: `og_1`,
      projectId: `pj_1`,
      instanceId: `in_1`,
      force: true,
    })
    expect(order).toEqual([`stopSandbox`, `openSession`])
  })

  it(`passes the estimated cols/rows through to every openSession call unchanged`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }])
    mockEstimateTerminalDimensions.mockReturnValue({ cols: 120, rows: 40 })

    await restartSandbox(opts)

    expect(mockOpenSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ cols: 120, rows: 40 })
    )
    expect(mockOpenSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cols: 120, rows: 40 })
    )
  })

  it(`always passes sessionId:null and newInstance:true on every call`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }])

    await restartSandbox(opts)

    expect(mockOpenSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sessionId: null, newInstance: true })
    )
    expect(mockOpenSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sessionId: null, newInstance: true })
    )
  })

  it(`passes orgId/projectId/sandboxId through on every openSession call`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }])

    await restartSandbox(opts)

    expect(mockOpenSession).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: `og_1`, projectId: `pj_1`, sandboxId: `sb_1` })
    )
  })

  it(`breaks the loop on the first openSession failure and returns opened:0`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }, { id: `s3` }])
    mockOpenSession.mockRejectedValueOnce(new Error(`boom`))

    const result = await restartSandbox(opts)

    expect(result).toEqual({ opened: 0, total: 3 })
    expect(mockOpenSession).toHaveBeenCalledTimes(1)
  })

  it(`breaks after a later failure and returns the partial opened count`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }, { id: `s3` }])
    mockOpenSession
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(`boom`))

    const result = await restartSandbox(opts)

    expect(result).toEqual({ opened: 1, total: 3 })
    expect(mockOpenSession).toHaveBeenCalledTimes(2)
  })

  it(`uses the "Reopened X of Y sessions" message (opened count at time of failure) when total > 1`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }, { id: `s3` }])
    mockOpenSession
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error(`boom`))

    await restartSandbox(opts)

    expect(mockToastError).toHaveBeenCalledWith(
      `Reopened 1 of 3 sessions`,
      expect.objectContaining({ description: `boom` })
    )
  })

  it(`uses the fixed "Failed to reopen session after restart" message when total === 1`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([])
    mockOpenSession.mockRejectedValueOnce(new Error(`boom`))

    await restartSandbox(opts)

    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to reopen session after restart`,
      expect.objectContaining({ description: `boom` })
    )
  })

  it(`uses the fixed single-session message even when total===1 from a single prior session (not the zero-clamp)`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }])
    mockOpenSession.mockRejectedValueOnce(new Error(`boom`))

    await restartSandbox(opts)

    expect(mockToastError).toHaveBeenCalledWith(
      `Failed to reopen session after restart`,
      expect.objectContaining({ description: `boom` })
    )
  })

  it(`uses err.message for a real Error instance`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([])
    mockOpenSession.mockRejectedValueOnce(new Error(`disk full`))

    await restartSandbox(opts)

    expect(mockToastError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: `disk full` })
    )
  })

  it(`uses the fallback description for a non-Error throw`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([])
    mockOpenSession.mockRejectedValueOnce(`nope`)

    await restartSandbox(opts)

    expect(mockToastError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: `An unexpected error occurred` })
    )
  })

  it(`always resolves (never rejects) even when every openSession call fails`, async () => {
    mockGetSessionsForSandbox.mockReturnValue([{ id: `s1` }, { id: `s2` }])
    mockOpenSession.mockRejectedValue(new Error(`boom`))

    await expect(restartSandbox(opts)).resolves.toEqual({ opened: 0, total: 2 })
  })
})
