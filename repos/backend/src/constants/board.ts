import type { Schedule } from '@tdsk/domain'

/**
 * Board membership + resolution config (AI Executive Layer SP1).
 *
 * Single source of truth for who sits on the executive board. Every board
 * persist/resolve path in the executor reads membership through the helpers here
 * (never hardcoded inline), so the board is testable independently of the seeded
 * agents — tests inject/override membership by mocking this module.
 *
 * SP1 board = {CEO, CTO}. The CTO reuses the existing steward agent; the CEO is the
 * seeded founder agent. Both stay dormant in prod until the CEO agent + its body
 * sandbox are created there and the board schedules are enabled — the CEO board
 * schedules ship disabled, so no live schedule drives a board path until activation.
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
 * Stable id of the seeded CEO agent — the founder seat and first-among-equals
 * tiebreaker. Kept in lockstep with the CEO agent seeded in the database repo
 * (`fullorg.ts`) and the CEO board schedules (`agentSchedules.ts`). No live prod
 * schedule carries this agentId until the CEO board schedules are enabled, so
 * every CEO-gated path (resolveBoard, persistStrategy) stays inert until activation.
 */
export const CeoAgentId = `ag_ceo0001`

/** Stable id of the CEO agent's body sandbox (its runtime pod). */
export const CeoSandboxId = `sb_ceo0001`

/** The CEO seat is driven by the seeded founder agent. */
export const BoardCeoAgentId = CeoAgentId

/** The CTO seat reuses the existing steward agent. */
export const BoardCtoAgentId = `ag_lvUbjp_`

/** Max deliberation rounds before the CEO breaks the tie (spec §4.2 step 3). */
export const BoardMaxRounds = 3

/**
 * Resolution note recorded when a committed active-initiative proposal cannot swap
 * the Active Initiative because one is already in flight and the proposal is NOT a
 * stop-the-line abort (the routine completion-gate refusal — the frozen initiative
 * only moves via a completion report or the stop-the-line abort below).
 */
export const BoardBlockedActiveInitiativeNote = `blocked: active initiative in flight`

/**
 * The ONLY signal that marks an active-initiative proposal a stop-the-line abort —
 * the rare, high-bar escape hatch that may move an in-flight Active Initiative. A
 * proposal is a stop-the-line abort when its title starts with this prefix OR its
 * evidence carries the `StopTheLineEvidenceFlag` entry. Chosen as an explicit,
 * greppable marker so a routine re-direction can never be mistaken for an abort.
 */
export const StopTheLinePrefix = `STOP-THE-LINE:`

/** Evidence entry that also marks an active-initiative proposal a stop-the-line abort. */
export const StopTheLineEvidenceFlag = `stop-the-line`

/**
 * Resolution note recorded when a stop-the-line abort is refused because it lacks
 * the high bar — every non-CEO board member must endorse the abort (the CEO's
 * tiebreak power alone can NOT abort in-flight work).
 */
export const BoardAbortNotEndorsedNote = `blocked: stop-the-line abort lacks full non-CEO endorsement`

/**
 * Resolution note recorded when a stop-the-line abort is refused because it carries
 * no wind-down plan — an abort must wind the Active Initiative down cleanly
 * (finish-to-safe or fully revert), never leave it dangling.
 */
export const BoardAbortNoWindDownNote = `blocked: stop-the-line abort has no wind-down plan`

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

/**
 * True when the schedule is driven by the CTO board member. The CTO is the only
 * seat that may report an Active Initiative delivered (persistInitiativeComplete),
 * so a non-CTO cycle emitting the completion block is ignored.
 */
export const isCtoSchedule = (schedule: Schedule): boolean => {
  const cto = getBoardMembers().find((member) => member.role === `cto`)
  return !!cto && schedule.agentId === cto.agentId
}

/** True when the schedule is driven by any current board member. */
export const isBoardMemberSchedule = (schedule: Schedule): boolean =>
  getBoardMembers().some((member) => member.agentId === schedule.agentId)
