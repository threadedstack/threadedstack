import type { Schedule } from '@tdsk/domain'

/**
 * Board membership + resolution config (AI Executive Layer SP1).
 *
 * Single source of truth for who sits on the executive board. Every board
 * persist/resolve path in the executor reads membership through the helpers here
 * (never hardcoded inline), so this phase is testable before the CEO agent is
 * seeded (Phase 6/7) — tests inject/override membership by mocking this module.
 *
 * SP1 board = {CEO, CTO}. The CTO reuses the existing steward agent; the CEO is a
 * placeholder that Phase 6 replaces with the seeded agent id. Everything stays
 * dormant in prod until the CEO agent exists and the board schedules are enabled,
 * because no live schedule's agentId matches the placeholder CEO id yet.
 */

/** Board seat roles. The CMO seat is designed-for now; its agent ships in SP2. */
export type TBoardRole = `ceo` | `cto` | `cmo`

/** One executive board member. `isCEO` flags the first-among-equals tiebreaker. */
export type TBoardMember = {
  agentId: string
  role: TBoardRole
  isCEO: boolean
}

/**
 * Placeholder CEO agent id — Phase 6 replaces this with the seeded CEO agent id.
 * Until then no live schedule carries this agentId, so every CEO-gated path
 * (resolveBoard, persistStrategy) stays inert in prod.
 */
export const BoardCeoAgentId = `ag_CEO_PLACEHOLDER`

/** The CTO seat reuses the existing steward agent. */
export const BoardCtoAgentId = `ag_lvUbjp_`

/** Max deliberation rounds before the CEO breaks the tie (spec §4.2 step 3). */
export const BoardMaxRounds = 3

/**
 * Resolution note recorded when a committed active-initiative proposal cannot swap
 * the Active Initiative because one is already in flight (the Phase 4 completion
 * gate refines this into the stop-the-line abort path).
 */
export const BoardBlockedActiveInitiativeNote = `blocked: active initiative in flight`

/** The current executive board membership. SP1 = {CEO, CTO}. */
export const getBoardMembers = (): TBoardMember[] => [
  { agentId: BoardCeoAgentId, role: `ceo`, isCEO: true },
  { agentId: BoardCtoAgentId, role: `cto`, isCEO: false },
]

/** True when the schedule is driven by the CEO board member (first among equals). */
export const isCeoSchedule = (schedule: Schedule): boolean => {
  const ceo = getBoardMembers().find((member) => member.isCEO)
  return !!ceo && schedule.agentId === ceo.agentId
}

/** True when the schedule is driven by any current board member. */
export const isBoardMemberSchedule = (schedule: Schedule): boolean =>
  getBoardMembers().some((member) => member.agentId === schedule.agentId)
