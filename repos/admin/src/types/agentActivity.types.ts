/**
 * One row as the activity endpoints return it.
 *
 * `createdAt` is NOT decoration: `agent_messages` documents carry no timestamp
 * of their own, so it is the only thing the merged timeline can order them by.
 */
export type TActivityRecord = {
  id: string
  data: Record<string, any>
  createdAt: string
}

/** The liveness row from `resident_status`. */
export type TAgentStatus = {
  agentId: string
  sessionId?: string
  queueDepth?: number
  currentActivity?: string
  lastTurnAt?: string
  turnCount?: number
  degraded?: boolean
}

/** Which source a merged timeline entry came from. */
export type TTimelineKind = `turn` | `message` | `memory`

/**
 * A single merged, chronologically sortable timeline entry.
 *
 * `summary` is the collapsed one-liner shown in the feed; `body` (and `input`
 * for turns) is the full log content revealed on expand. `meta` is a short
 * qualifier (a message sender, a memory importance) rendered next to the time.
 */
export type TTimelineEntry = {
  id: string
  kind: TTimelineKind
  at: string
  title: string
  summary?: string
  body?: string
  input?: string
  meta?: string
}

/** One milestone inside a roadmap plan. Fields are best-effort — plans are
 * agent-authored Collection documents, so nothing here is guaranteed present. */
export type TAgentMilestone = {
  title?: string
  status?: string
  size?: string
  detail?: string
}

/**
 * A roadmap entry: one document from the project's `plans` collection. This is
 * what the agent is working toward (an initiative, a company plan, a GTM plan),
 * as opposed to the activity feed, which is what it just did.
 */
export type TAgentPlan = {
  id: string
  title: string
  kind?: string
  status?: string
  owner?: string
  objective?: string
  notes?: string
  milestones?: TAgentMilestone[]
  keyResults?: string[]
}
