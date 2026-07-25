import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchAgentActivity = vi.hoisted(() => vi.fn())

vi.mock(`@TAF/actions/agentActivity/api/fetchAgentActivity`, () => ({
  fetchAgentActivity,
}))

import {
  startAgentActivityPolling,
  stopAgentActivityPolling,
} from './pollAgentActivity'

describe(`pollAgentActivity`, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchAgentActivity.mockReset()
    fetchAgentActivity.mockResolvedValue({ errors: [] })
  })

  afterEach(() => {
    stopAgentActivityPolling()
    vi.useRealTimers()
  })

  it(`polls on an interval until stopped`, async () => {
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(2)

    stopAgentActivityPolling()
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(2)
  })

  it(`skips a tick while a request is still in flight instead of stacking`, async () => {
    let release: (v: unknown) => void = () => {}
    fetchAgentActivity.mockReturnValue(new Promise((res) => (release = res)))

    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    // A slow response must not queue a second request behind it.
    await vi.advanceTimersByTimeAsync(15000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    release({ errors: [] })
  })

  it(`starting again replaces the previous timer rather than adding one`, async () => {
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `b` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)
    expect(fetchAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: `b` })
    )
  })
})
