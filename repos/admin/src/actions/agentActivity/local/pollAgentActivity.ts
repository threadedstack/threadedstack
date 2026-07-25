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
 * fetch, so every fetch — first paint and every refresh — goes through the same
 * action, and components only ever read atoms.
 *
 * LIFECYCLE: a data router has no unmount hook, so the poll owns its own
 * teardown. Navigating from one agent to another restarts it via the next
 * loader (stop-before-start below). Leaving the activity feature entirely fires
 * no loader, so each tick also self-terminates once the browser is no longer on
 * this agent's activity route — otherwise the interval would outlive the page.
 *
 * A tick that lands while the previous request is still open is SKIPPED rather
 * than queued, so a slow response can never stack requests.
 */
export const startAgentActivityPolling = (opts: TPollOpts) => {
  stopAgentActivityPolling()
  timer = setInterval(async () => {
    // Self-terminate once the user has navigated away from this agent's activity
    // page (see LIFECYCLE above). `createBrowserRouter` keeps
    // `window.location.pathname` in sync with client-side navigation, so this is
    // the reliable exit signal in the absence of an unmount hook.
    if (!window.location.pathname.includes(`/agents/${opts.agentId}/activity`)) {
      stopAgentActivityPolling()
      return
    }
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
