import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchAgentActivity = vi.hoisted(() => vi.fn())

vi.mock(`@TAF/actions/agentActivity/api/fetchAgentActivity`, () => ({
  fetchAgentActivity,
}))

import {
  startAgentActivityPolling,
  stopAgentActivityPolling,
} from './pollAgentActivity'

/** Put the browser on an agent's activity route so the poll's self-terminate
 * guard (which checks `window.location.pathname`) lets ticks through. */
const visitActivity = (agentId: string) =>
  window.history.pushState({}, ``, `/orgs/o/projects/p/agents/${agentId}/activity`)

describe(`pollAgentActivity`, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchAgentActivity.mockReset()
    fetchAgentActivity.mockResolvedValue({ errors: [] })
    visitActivity(`a`)
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
    visitActivity(`b`)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)
    expect(fetchAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: `b` })
    )
  })

  it(`self-terminates once the browser leaves this agent's activity page`, async () => {
    startAgentActivityPolling({ orgId: `o`, projectId: `p`, agentId: `a` })

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)

    // Navigate away to a non-activity route: no loader restarts the poll, so the
    // next tick must detect the change and stop the interval for good.
    window.history.pushState({}, ``, `/orgs/o/projects/p/agents/a`)
    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetchAgentActivity).toHaveBeenCalledTimes(1)
  })
})
