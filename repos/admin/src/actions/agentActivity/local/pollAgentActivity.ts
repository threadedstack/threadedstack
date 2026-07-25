import { fetchAgentActivity } from '@TAF/actions/agentActivity/api/fetchAgentActivity'

/** Poll cadence. The heartbeat lands every ~30s and transcripts are written
 * after a turn completes, so 5s is comfortably faster than the data changes. */
const PollMs = 5000

type TPollOpts = {
  orgId: string
  agentId: string
  projectId: string
}

let timer: ReturnType<typeof setInterval> | undefined
let inFlight = false

/**
 * Poll one agent's activity from the ACTION layer.
 *
 * This lives here, not in a component effect, because the project forbids
 * `useEffect` for data loading. The route loader starts it after its initial
 * fetch and the route cleanup stops it, so every fetch — first paint and every
 * refresh — goes through the same action, and components only ever read atoms.
 *
 * A tick that lands while the previous request is still open is SKIPPED rather
 * than queued, so a slow response can never stack requests.
 */
export const startAgentActivityPolling = (opts: TPollOpts) => {
  stopAgentActivityPolling()
  timer = setInterval(async () => {
    if (inFlight) return
    inFlight = true
    try {
      await fetchAgentActivity(opts)
    } finally {
      inFlight = false
    }
  }, PollMs)
}

export const stopAgentActivityPolling = () => {
  if (timer) clearInterval(timer)
  timer = undefined
  inFlight = false
}
