import { EFunLanguage } from '@tdsk/domain'

/**
 * `resolveBoard` — board resolution Function (Exec-Board on Primitives ⑤a-3).
 *
 * Verbatim parity port of `resolveBoard` + `commitProposalEffect` (repos/
 * backend/src/utils/agent/resolveBoard.ts:52-250), against the ① `records`
 * capability, with the board constants (repos/backend/src/constants/board.ts)
 * inlined into the body:
 *   - unanimous endorse at the proposal's current round → committed (consensus)
 *   - an objection/amend under the round cap (BoardMaxRounds=3) → advance a round
 *   - at/over the cap → CEO tiebreak: latest endorse commits (tiebroken),
 *     object rejects (ceo-tiebreak-reject); amend / no stance leaves it open
 * A committed / tiebroken proposal writes its outcome into the company strategy:
 * active-initiative freeze (blocked mid-flight unless a fully-endorsed
 * stop-the-line abort with a wind-down plan), positioning overwrite, or a
 * prioritized backlog append for every other axis.
 *
 * Membership comes from `board_members` records (getBoardMembers-as-data);
 * invocation is gated by the CEO board schedule's `actions` allowlist (spec §5
 * pins resolution to the CEO deliberation cycle), so no caller gate is needed.
 * A per-proposal failure is captured in the outcome list and skipped, so one
 * bad proposal never fails the run (resolveBoard.ts:243-248).
 */
export const ResolveBoardFunctionSource = `export default async (request, context) => {
  const records = context.records

  // Constants inlined from repos/backend/src/constants/board.ts:46-80.
  const BoardMaxRounds = 3
  const StopTheLinePrefix = 'STOP-THE-LINE:'
  const StopTheLineEvidenceFlag = 'stop-the-line'
  const BoardBlockedActiveInitiativeNote = 'blocked: active initiative in flight'
  const BoardAbortNotEndorsedNote = 'blocked: stop-the-line abort lacks full non-CEO endorsement'
  const BoardAbortNoWindDownNote = 'blocked: stop-the-line abort has no wind-down plan'

  // getBoardMembers() as data — board.ts:83-86 replaced by board_members records.
  const memberRecs = await records.query('board_members', {})
  const members = memberRecs.map((rec) => rec.data)
  const ceo = members.find((member) => member.isCEO === true)

  // company_strategy singleton helpers — ports of the companyStrategy service
  // methods the handler calls (repos/database/src/services/companyStrategy.ts).
  const getStrategy = async () => {
    const rows = await records.query('company_strategy', {})
    return rows[0] || null
  }
  // upsertByOrg (companyStrategy.ts:60-78): create-or-patch the singleton.
  const patchStrategy = async (patch) => {
    const current = await getStrategy()
    if (current)
      return records.upsert('company_strategy', {
        id: current.id,
        data: Object.assign({}, current.data, patch),
      })
    return records.upsert('company_strategy', {
      data: Object.assign(
        { northStar: '', segments: [], positioning: '', backlog: [], activeInitiative: null },
        patch
      ),
    })
  }
  // setActiveInitiative (companyStrategy.ts:85-102): update-only, no-op when absent.
  const setActiveInitiative = async (initiative) => {
    const current = await getStrategy()
    if (!current) return
    return records.upsert('company_strategy', {
      id: current.id,
      data: Object.assign({}, current.data, { activeInitiative: initiative }),
    })
  }
  // clearActiveInitiative (companyStrategy.ts:105-119).
  const clearActiveInitiative = async () => setActiveInitiative(null)
  // promoteNextFromBacklog (companyStrategy.ts:128-152): the FIRST backlog item
  // becomes the new Active Initiative (rationale -> definition-of-done, empty
  // evidence, status active) and is dropped from the backlog.
  const promoteNextFromBacklog = async () => {
    const current = await getStrategy()
    if (!current) return
    const backlog = Array.isArray(current.data.backlog) ? current.data.backlog : []
    if (!backlog.length) return
    const next = backlog[0]
    return records.upsert('company_strategy', {
      id: current.id,
      data: Object.assign({}, current.data, {
        activeInitiative: {
          title: next.title,
          definitionOfDone: next.rationale,
          evidence: [],
          status: 'active',
          committedAt: new Date().toISOString(),
        },
        backlog: backlog.slice(1),
      }),
    })
  }

  // isStopTheLineAbort — resolveBoard.ts:29-35: title starts with the prefix
  // OR the evidence carries the flag entry.
  const isStopTheLineAbort = (proposal) => {
    const title = String(proposal.title || '').trim().toUpperCase()
    if (title.startsWith(StopTheLinePrefix.toUpperCase())) return true
    return (proposal.evidence || []).some(
      (ref) => String(ref).trim().toLowerCase() === StopTheLineEvidenceFlag
    )
  }

  // commitProposalEffect — resolveBoard.ts:52-125, verbatim against records.
  const commitProposalEffect = async (proposal, ctx) => {
    if (proposal.axis === 'active-initiative') {
      const strategyRec = await getStrategy()
      const strategy = strategyRec ? strategyRec.data : null
      const active = strategy ? strategy.activeInitiative : null
      const inFlight = !!active && active.status === 'active'

      if (inFlight) {
        // Completion gate (resolveBoard.ts:65-70): a frozen Active Initiative
        // is NEVER swapped by a routine re-direction.
        if (!isStopTheLineAbort(proposal)) return { note: BoardBlockedActiveInitiativeNote }
        // High bar (resolveBoard.ts:71-73): EVERY non-CEO member must endorse;
        // the CEO's tiebreak power alone can NOT abort in-flight work.
        if (!ctx.allNonCeoEndorse) return { note: BoardAbortNotEndorsedNote }
        // The abort must wind down cleanly (resolveBoard.ts:74-77): the
        // description is the wind-down plan and must be non-empty.
        const windDown = String(proposal.description || '').trim()
        if (!windDown) return { note: BoardAbortNoWindDownNote }

        // Mark the in-flight initiative aborted, then advance — resolveBoard.ts:79-88.
        await setActiveInitiative(Object.assign({}, active, { status: 'aborted' }))
        const backlog = (strategy && Array.isArray(strategy.backlog)) ? strategy.backlog : []
        if (backlog.length > 0) await promoteNextFromBacklog()
        else await clearActiveInitiative()

        return { note: 'stop-the-line abort — wind-down: ' + windDown }
      }

      // No initiative in flight: freeze this proposal as the new Active
      // Initiative — resolveBoard.ts:93-102.
      await setActiveInitiative({
        title: proposal.title,
        definitionOfDone: proposal.description,
        evidence: proposal.evidence || [],
        status: 'active',
        committedAt: new Date().toISOString(),
      })
      return {}
    }

    if (proposal.axis === 'positioning') {
      // Positioning overwrite — resolveBoard.ts:105-111.
      await patchStrategy({
        positioning: proposal.description,
        updatedByAgentId: proposal.openedByAgentId,
      })
      return {}
    }

    // Default: append the proposal to the strategy backlog, one past the
    // current top — resolveBoard.ts:113-124.
    const strategyRec = await getStrategy()
    const backlog =
      strategyRec && Array.isArray(strategyRec.data.backlog) ? strategyRec.data.backlog : []
    const nextPriority = backlog.reduce((max, item) => Math.max(max, item.priority), 0) + 1
    await patchStrategy({
      backlog: backlog.concat([
        { title: proposal.title, rationale: proposal.description, priority: nextPriority },
      ]),
      updatedByAgentId: proposal.openedByAgentId,
    })
    return {}
  }

  // commitProposal — resolveBoard.ts:128-142: apply the effect + set status.
  const commitProposal = async (proposalRec, proposal, status, baseResolution, ctx) => {
    const effect = await commitProposalEffect(proposal, ctx)
    await records.upsert('decision_proposals', {
      id: proposalRec.id,
      data: Object.assign({}, proposal, {
        status: status,
        resolution: effect.note ? baseResolution + '; ' + effect.note : baseResolution,
      }),
    })
  }

  // Load open proposals — resolveBoard.ts:162-173 (decisionProposal.listOpenByOrg
  // = status open|deliberating; org scoping is the project scoping here).
  const openRecs = await records.query('decision_proposals', {
    where: [{ field: 'status', op: 'in', value: ['open', 'deliberating'] }],
  })
  if (!openRecs.length) return { ok: true, resolved: 0 }

  const outcomes = []
  for (const proposalRec of openRecs) {
    try {
      const proposal = proposalRec.data

      // Latest position per member — decisionPosition.latestByProposal
      // (decisionPosition.ts:46-65) orders (round asc, createdAt asc) and keeps
      // the last per agent. postPosition replaces in place per (agent, round),
      // so ordering by round is the total per-member order here.
      const positionRecs = await records.query('decision_positions', {
        where: [{ field: 'proposalId', op: 'eq', value: proposalRec.id }],
      })
      const positions = positionRecs
        .map((rec) => rec.data)
        .sort((a, b) => (a.round || 0) - (b.round || 0))
      const latestByAgent = new Map()
      for (const position of positions) latestByAgent.set(position.agentId, position)

      const memberPositions = members.map((member) => latestByAgent.get(member.agentId))

      // resolveBoard.ts:186-191.
      const allEndorseThisRound = memberPositions.every(
        (position) =>
          !!position && position.round === proposal.round && position.stance === 'endorse'
      )
      // resolveBoard.ts:192-195.
      const anyDissent = memberPositions.some(
        (position) =>
          position && (position.stance === 'object' || position.stance === 'amend')
      )

      // Stop-the-line high bar — resolveBoard.ts:197-206: every non-CEO
      // member's LATEST position is an endorse.
      const nonCeoMembers = members.filter((member) => !member.isCEO)
      const allNonCeoEndorse =
        nonCeoMembers.length > 0 &&
        nonCeoMembers.every((member) => {
          const position = latestByAgent.get(member.agentId)
          return !!position && position.stance === 'endorse'
        })
      const ctx = { allNonCeoEndorse: allNonCeoEndorse }

      if (allEndorseThisRound) {
        // resolveBoard.ts:208-212.
        await commitProposal(proposalRec, proposal, 'committed', 'consensus', ctx)
        outcomes.push({ id: proposalRec.id, action: 'committed' })
        continue
      }

      if (anyDissent && proposal.round < BoardMaxRounds) {
        // advanceRound port (decisionProposal.ts:77-95): round+1, status
        // deliberating — resolveBoard.ts:214-220.
        await records.upsert('decision_proposals', {
          id: proposalRec.id,
          data: Object.assign({}, proposal, {
            round: proposal.round + 1,
            status: 'deliberating',
          }),
        })
        outcomes.push({ id: proposalRec.id, action: 'advanced', round: proposal.round + 1 })
        continue
      }

      if (proposal.round >= BoardMaxRounds) {
        // CEO tiebreak — resolveBoard.ts:222-242.
        const ceoPosition = ceo ? latestByAgent.get(ceo.agentId) : undefined
        if (ceoPosition && ceoPosition.stance === 'endorse') {
          await commitProposal(
            proposalRec,
            proposal,
            'tiebroken',
            'ceo-tiebreak: ' + ceoPosition.reasoning,
            ctx
          )
          outcomes.push({ id: proposalRec.id, action: 'tiebroken' })
        } else if (ceoPosition && ceoPosition.stance === 'object') {
          await records.upsert('decision_proposals', {
            id: proposalRec.id,
            data: Object.assign({}, proposal, {
              status: 'rejected',
              resolution: 'ceo-tiebreak-reject',
            }),
          })
          outcomes.push({ id: proposalRec.id, action: 'rejected' })
        }
        // CEO amend / no CEO position at the cap → leave open for a decisive
        // stance (resolveBoard.ts:241).
      }
    } catch (err) {
      // Per-proposal failures never fail the run — resolveBoard.ts:243-248.
      outcomes.push({
        id: proposalRec.id,
        action: 'error',
        message: err && err.message ? err.message : String(err),
      })
    }
  }
  return { ok: true, outcomes: outcomes }
}
`

/** Seed record for the `resolveBoard` Function (stable id — idempotent reconcile). */
export const ResolveBoardFunctionDef = {
  id: `fn_bresol1`,
  name: `resolveBoard`,
  description: `Resolve the open board decision proposals from the members' latest positions: consensus commit, round advance (cap 3), CEO tiebreak, and the commit effects (active-initiative freeze, stop-the-line abort, positioning overwrite, backlog append). Replaces the hard-coded resolveBoard engine.`,
  language: EFunLanguage.javascript,
  content: ResolveBoardFunctionSource,
}
