import type { TApp } from '@TBE/types'
import type { Schedule, DecisionProposal, DecisionPosition } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { EStance, EDecisionAxis, EDecisionStatus, EInitiativeStatus } from '@tdsk/domain'
import {
  BoardMaxRounds,
  getBoardMembers,
  StopTheLinePrefix,
  StopTheLineEvidenceFlag,
  BoardAbortNoWindDownNote,
  BoardAbortNotEndorsedNote,
  BoardBlockedActiveInitiativeNote,
} from '@TBE/constants/board'

/**
 * Whether a committed proposal may act on the frozen Active Initiative. Only ever
 * true for a stop-the-line abort that clears the high bar (every non-CEO member
 * endorses); a routine active-initiative re-direction never carries it.
 */
type TCommitContext = { allNonCeoEndorse: boolean }

/**
 * A stop-the-line abort is the ONLY way a committed active-initiative proposal may
 * move an in-flight Active Initiative. It is explicitly flagged so a routine
 * re-direction can never be mistaken for one: the proposal title starts with
 * `StopTheLinePrefix` OR its evidence carries the `StopTheLineEvidenceFlag` entry.
 */
const isStopTheLineAbort = (proposal: DecisionProposal): boolean => {
  const title = (proposal.title ?? ``).trim().toUpperCase()
  if (title.startsWith(StopTheLinePrefix.toUpperCase())) return true
  return (proposal.evidence ?? []).some(
    (ref) => ref.trim().toLowerCase() === StopTheLineEvidenceFlag
  )
}

/**
 * Apply a committed / tiebroken proposal's intent to the org Company Strategy.
 *
 * - `active-initiative` axis: freeze the proposal as the single Active Initiative,
 *   but ONLY when none is in flight (status `active`). The completion gate keeps a
 *   frozen initiative from being swapped mid-flight — the sole exception is a
 *   stop-the-line abort that clears the high bar (all non-CEO members endorse) and
 *   carries a wind-down plan; it marks the initiative `aborted` and promotes the
 *   next backlog bet.
 * - `positioning` axis: overwrite the strategy positioning with the proposal.
 * - every other axis: append the proposal as a prioritized backlog item.
 *
 * Returns a `note` only when the effect was intentionally NOT applied (a blocked
 * gate case) or to record the abort, so the caller can surface it in the resolution.
 */
async function commitProposalEffect(
  app: TApp,
  proposal: DecisionProposal,
  ctx: TCommitContext
): Promise<{ note?: string }> {
  const { db } = app.locals
  const orgId = proposal.orgId

  if (proposal.axis === EDecisionAxis.activeInitiative) {
    const { data: strategy } = await db.services.companyStrategy.getByOrg(orgId)
    const active = strategy?.activeInitiative
    const inFlight = !!active && active.status === EInitiativeStatus.active

    if (inFlight) {
      // Completion gate (the core stability guarantee): a frozen Active Initiative
      // is NEVER swapped by a routine re-direction. It only moves via a completion
      // report (persistInitiativeComplete) or the rare stop-the-line abort below —
      // this is what stops strategy churn from thrashing the dev loop.
      if (!isStopTheLineAbort(proposal)) return { note: BoardBlockedActiveInitiativeNote }
      // High bar: EVERY non-CEO board member must endorse the abort. The CEO's
      // tiebreak power alone can NOT abort in-flight work.
      if (!ctx.allNonCeoEndorse) return { note: BoardAbortNotEndorsedNote }
      // The abort must wind down cleanly — the proposal description is the wind-down
      // plan (finish-to-safe or fully revert) and must be non-empty.
      const windDown = (proposal.description ?? ``).trim()
      if (!windDown) return { note: BoardAbortNoWindDownNote }

      // Mark the in-flight initiative aborted (audit), then advance: promote the
      // next backlog bet, or clear the Active Initiative when the backlog is empty.
      await db.services.companyStrategy.setActiveInitiative(orgId, {
        ...active,
        status: EInitiativeStatus.aborted,
      })
      const backlog = strategy?.backlog ?? []
      if (backlog.length > 0)
        await db.services.companyStrategy.promoteNextFromBacklog(orgId)
      else await db.services.companyStrategy.clearActiveInitiative(orgId)

      return { note: `stop-the-line abort — wind-down: ${windDown}` }
    }

    // No initiative in flight (none, or a completed/aborted one left in place):
    // freeze this proposal as the new Active Initiative.
    await db.services.companyStrategy.setActiveInitiative(orgId, {
      title: proposal.title,
      definitionOfDone: proposal.description,
      evidence: proposal.evidence ?? [],
      status: EInitiativeStatus.active,
      committedAt: new Date(),
    })
    return {}
  }

  if (proposal.axis === EDecisionAxis.positioning) {
    await db.services.companyStrategy.upsertByOrg(orgId, {
      positioning: proposal.description,
      updatedByAgentId: proposal.openedByAgentId,
    })
    return {}
  }

  // Default: append the proposal to the strategy backlog, one past the current top.
  const { data: strategy } = await db.services.companyStrategy.getByOrg(orgId)
  const backlog = strategy?.backlog ?? []
  const nextPriority = backlog.reduce((max, item) => Math.max(max, item.priority), 0) + 1
  await db.services.companyStrategy.upsertByOrg(orgId, {
    backlog: [
      ...backlog,
      { title: proposal.title, rationale: proposal.description, priority: nextPriority },
    ],
    updatedByAgentId: proposal.openedByAgentId,
  })
  return {}
}

/** Commit a proposal (consensus or CEO tiebreak): apply the effect + set status. */
async function commitProposal(
  app: TApp,
  proposal: DecisionProposal,
  status: EDecisionStatus,
  baseResolution: string,
  ctx: TCommitContext
): Promise<void> {
  const { db } = app.locals
  const { note } = await commitProposalEffect(app, proposal, ctx)
  await db.services.decisionProposal.update({
    id: proposal.id,
    status,
    resolution: note ? `${baseResolution}; ${note}` : baseResolution,
  })
}

/**
 * Resolve the org's open board proposals from the current members' latest
 * positions (spec §4.2 step 3):
 *   - unanimous endorse at the proposal's current round → committed (consensus).
 *   - an objection/amend while under the round cap → advance a round to re-position.
 *   - at/over the round cap → CEO tiebreak: the CEO's latest endorse commits
 *     (tiebroken), its object rejects; the CEO is first among equals.
 * A committed / tiebroken proposal writes its outcome into the Company Strategy.
 *
 * Never throws — a per-proposal failure is logged and skipped so one bad proposal
 * never fails the run.
 */
export async function resolveBoard(app: TApp, schedule: Schedule): Promise<void> {
  const { db } = app.locals
  const orgId = schedule.orgId
  const members = getBoardMembers()
  const ceo = members.find((member) => member.isCEO)

  let open: DecisionProposal[]
  try {
    const { data } = await db.services.decisionProposal.listOpenByOrg(orgId)
    open = data ?? []
  } catch (err) {
    logger.error(
      `[Board] Schedule ${schedule.id} — failed to load open proposals:`,
      (err as Error).message
    )
    return
  }
  if (!open.length) return

  for (const proposal of open) {
    try {
      const { data: positions } = await db.services.decisionPosition.latestByProposal(
        proposal.id
      )
      const latestByAgent = new Map<string, DecisionPosition>()
      for (const position of positions ?? [])
        latestByAgent.set(position.agentId, position)

      const memberPositions = members.map((member) => latestByAgent.get(member.agentId))

      const allEndorseThisRound = memberPositions.every(
        (position) =>
          !!position &&
          position.round === proposal.round &&
          position.stance === EStance.endorse
      )
      const anyDissent = memberPositions.some(
        (position) =>
          position?.stance === EStance.object || position?.stance === EStance.amend
      )

      // The stop-the-line abort high bar: every non-CEO member's LATEST position is
      // an endorse. Threaded into the commit effect so only a fully-endorsed abort
      // may move an in-flight Active Initiative (the CEO tiebreak alone cannot).
      const nonCeoMembers = members.filter((member) => !member.isCEO)
      const allNonCeoEndorse =
        nonCeoMembers.length > 0 &&
        nonCeoMembers.every(
          (member) => latestByAgent.get(member.agentId)?.stance === EStance.endorse
        )
      const ctx: TCommitContext = { allNonCeoEndorse }

      if (allEndorseThisRound) {
        await commitProposal(app, proposal, EDecisionStatus.committed, `consensus`, ctx)
        logger.info(`[Board] Proposal ${proposal.id} committed by consensus`)
        continue
      }

      if (anyDissent && proposal.round < BoardMaxRounds) {
        await db.services.decisionProposal.advanceRound(proposal.id)
        logger.info(
          `[Board] Proposal ${proposal.id} advanced to round ${proposal.round + 1}`
        )
        continue
      }

      if (proposal.round >= BoardMaxRounds) {
        const ceoPosition = ceo ? latestByAgent.get(ceo.agentId) : undefined
        if (ceoPosition?.stance === EStance.endorse) {
          await commitProposal(
            app,
            proposal,
            EDecisionStatus.tiebroken,
            `ceo-tiebreak: ${ceoPosition.reasoning}`,
            ctx
          )
          logger.info(`[Board] Proposal ${proposal.id} tiebroken (CEO endorse)`)
        } else if (ceoPosition?.stance === EStance.object) {
          await db.services.decisionProposal.update({
            id: proposal.id,
            status: EDecisionStatus.rejected,
            resolution: `ceo-tiebreak-reject`,
          })
          logger.info(`[Board] Proposal ${proposal.id} rejected (CEO object)`)
        }
        // CEO amend / no CEO position at the cap → leave open for a decisive stance.
      }
    } catch (err) {
      logger.error(
        `[Board] Schedule ${schedule.id} — failed to resolve proposal ${proposal.id}:`,
        (err as Error).message
      )
    }
  }
}
