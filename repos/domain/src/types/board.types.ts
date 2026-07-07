/**
 * Executive board type definitions (AI Executive Layer SP1).
 * The board is an org-scoped, async, multi-agent decision mechanism: members open
 * decision proposals, post per-round positions, and a proposal commits on unanimous
 * endorsement or a CEO tiebreak. The Company Strategy is the org-level artifact the
 * CEO owns and the whole system (execs + dev loop) consumes.
 * Mirrors the task-proposal / escalation type conventions (enum + `${enum}` string
 * union + input / record shapes).
 */

/** Lifecycle status of a board decision proposal. */
export enum EDecisionStatus {
  open = `open`, // just opened, awaiting positions
  deliberating = `deliberating`, // at least one round posted, not yet converged
  committed = `committed`, // all current members endorsed the latest round
  tiebroken = `tiebroken`, // resolved by CEO decision after the round cap
  rejected = `rejected`, // decided not to act
  aborted = `aborted`, // an active-initiative stop-the-line abort
}

export type TDecisionStatus = `${EDecisionStatus}`

/** The company-direction axis a decision proposal changes. */
export enum EDecisionAxis {
  segment = `segment`,
  positioning = `positioning`,
  pricing = `pricing`,
  activeInitiative = `active-initiative`,
  resourceBet = `resource-bet`,
  other = `other`,
}

export type TDecisionAxis = `${EDecisionAxis}`

/** A board member's stance on a proposal in a given round. */
export enum EStance {
  endorse = `endorse`,
  object = `object`,
  amend = `amend`,
}

export type TStance = `${EStance}`

/** Lifecycle status of the single Active Initiative on a Company Strategy. */
export enum EInitiativeStatus {
  active = `active`,
  complete = `complete`,
  aborted = `aborted`,
}

export type TInitiativeStatus = `${EInitiativeStatus}`

/** Input for opening a board decision proposal (id / org / agent resolved by the caller). */
export type TDecisionProposalInput = {
  title: string
  axis: TDecisionAxis
  description: string
  evidence?: string[]
}

/** Input for posting a per-round board position on a proposal. */
export type TDecisionPositionInput = {
  proposalId: string
  stance: TStance
  reasoning: string
}

/** One prioritized future initiative on the Company Strategy backlog. */
export type TStrategyBacklogItem = {
  title: string
  rationale: string
  priority: number
}

/**
 * A partial update to the non-active-initiative fields of the Company Strategy.
 * Active-Initiative changes never flow through here — only via the completion gate
 * or a committed active-initiative-axis proposal.
 */
export type TStrategyUpdate = {
  northStar?: string
  segments?: string[]
  positioning?: string
  backlog?: TStrategyBacklogItem[]
}

/** A CTO report that the named Active Initiative has been delivered. */
export type TInitiativeComplete = {
  initiativeTitle: string
  evidenceRefs: string[]
}

/**
 * The single frozen Active Initiative on a Company Strategy. Its scope and
 * definition-of-done are fixed at commit time and do not change while in flight.
 */
export type TActiveInitiative = {
  title: string
  definitionOfDone: string
  evidence: string[]
  status: TInitiativeStatus
  committedAt: string | Date
}
