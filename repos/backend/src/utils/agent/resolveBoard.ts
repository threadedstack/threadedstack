import type { TApp } from '@TBE/types'
import type { Schedule, DecisionProposal, DecisionPosition } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { EStance, EDecisionAxis, EDecisionStatus, EInitiativeStatus } from '@tdsk/domain'
import {
  BoardMaxRounds,
  getBoardMembers,
  BoardBlockedActiveInitiativeNote,
} from '@TBE/constants/board'

/**
 * Apply a committed / tiebroken proposal's intent to the org Company Strategy.
 *
 * - `active-initiative` axis: freeze the proposal as the single Active Initiative,
 *   but ONLY when none is in flight. If one already exists the strategy is left
 *   untouched and the caller records the blocked note (Phase 4 refines this into a
 *   stop-the-line abort).
 * - `positioning` axis: overwrite the strategy positioning with the proposal.
 * - every other axis: append the proposal as a prioritized backlog item.
 *
 * Returns a `note` only when the effect was intentionally NOT applied (the blocked
 * active-initiative case), so the caller can surface it in the resolution.
 */
async function commitProposalEffect(
  app: TApp,
  proposal: DecisionProposal
): Promise<{ note?: string }> {
  const { db } = app.locals
  const orgId = proposal.orgId

  if (proposal.axis === EDecisionAxis.activeInitiative) {
    const { data: strategy } = await db.services.companyStrategy.getByOrg(orgId)
    // Completion gate: the frozen Active Initiative is never swapped mid-flight.
    if (strategy?.activeInitiative) return { note: BoardBlockedActiveInitiativeNote }

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
  baseResolution: string
): Promise<void> {
  const { db } = app.locals
  const { note } = await commitProposalEffect(app, proposal)
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

      if (allEndorseThisRound) {
        await commitProposal(app, proposal, EDecisionStatus.committed, `consensus`)
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
            `ceo-tiebreak: ${ceoPosition.reasoning}`
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
