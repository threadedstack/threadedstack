import type { TContextSource, TRecordQuery } from '@tdsk/domain'

import { EQueryOp } from '@tdsk/domain'
import {
  loadPrompt,
  CeoAgentId,
  CmoAgentId,
  CtoAgentId,
  OpsProjectId,
  EngOneAgentId,
  EngTwoAgentId,
  BoardPlansSource,
  BoardStrategySource,
  BoardPositionsSource,
  MarketingArtifactsSource,
  BoardOpenDecisionsSource,
} from '@TDB/seeds/agentSchedules'
import { stableStringify } from '@TDB/seeds/reconcileSchedules'
import { DevTasksCollectionName } from '@TDB/seeds/dev-team/collections'
import {
  ResidentConfigsCollectionName,
  ResidentMemoriesCollectionName,
} from '@TDB/seeds/resident/collections'

/**
 * Durable-recall source: the resident's own most-recent memories (newest first),
 * surfaced back into every turn so learning written via writeMemory survives
 * compaction. Scoped to the resident's agentId (the seed is CMO-specific).
 */
export const CmoMemoriesSource: TContextSource = {
  as: `Recent memories`,
  collection: ResidentMemoriesCollectionName,
  query: {
    where: [{ field: `agentId`, op: EQueryOp.eq, value: CmoAgentId }],
    orderBy: { field: `at`, direction: `desc` },
    limit: 20,
  } as TRecordQuery,
}

/** The CEO resident's durable-recall source (its own memories, newest first). */
export const CeoMemoriesSource: TContextSource = {
  as: `Recent memories`,
  collection: ResidentMemoriesCollectionName,
  query: {
    where: [{ field: `agentId`, op: EQueryOp.eq, value: CeoAgentId }],
    orderBy: { field: `at`, direction: `desc` },
    limit: 20,
  } as TRecordQuery,
}

/** The CTO team-lead resident's durable-recall source (its own memories, newest first). */
export const CtoMemoriesSource: TContextSource = {
  as: `Recent memories`,
  collection: ResidentMemoriesCollectionName,
  query: {
    where: [{ field: `agentId`, op: EQueryOp.eq, value: CtoAgentId }],
    orderBy: { field: `at`, direction: `desc` },
    limit: 20,
  } as TRecordQuery,
}

/**
 * A resident's durable-recall source, keyed per agent — the CmoMemoriesSource
 * shape, parameterized for the engineer seats (each engineer's config is its
 * OWN per-agent JSON document, so the agentId is hardcoded per config).
 */
const memoriesSourceFor = (agentId: string): TContextSource => ({
  as: `Recent memories`,
  collection: ResidentMemoriesCollectionName,
  query: {
    where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }],
    orderBy: { field: `at`, direction: `desc` },
    limit: 20,
  } as TRecordQuery,
})

// ── Dev-team context sources + watch queries (realtime engineering team, Phase 2) ──
// The dev_tasks board views the engineer/CTO residents watch and read. Watch
// queries reference the SAME query objects the context sources carry, so the
// watched sets and the injected context can never drift apart (the CMO
// deliberation-watch pattern).

/** The pickup-ready backlog head, highest priority first (P0 sorts before P3). */
export const DevTasksBacklogSource: TContextSource = {
  as: `Dev-task backlog (pickup-ready head)`,
  collection: DevTasksCollectionName,
  query: {
    where: [{ field: `state`, op: EQueryOp.eq, value: `backlog` }],
    orderBy: { field: `priority`, direction: `asc` },
    limit: 10,
  } as TRecordQuery,
}

/** PRs awaiting a reviewer — the engineer reviews watch's matched set. */
export const DevTasksReviewableQuery: TRecordQuery = {
  where: [{ field: `state`, op: EQueryOp.eq, value: `pr_open` }],
  limit: 20,
}

/** Approved-but-unmerged tasks — the CTO merge-throughput watch's matched set. */
export const DevTasksApprovedQuery: TRecordQuery = {
  where: [{ field: `state`, op: EQueryOp.eq, value: `approved` }],
  limit: 20,
}

/** The CTO's whole-board view: every non-terminal task, for grooming + health. */
export const DevTasksInFlightSource: TContextSource = {
  as: `Dev tasks in flight`,
  collection: DevTasksCollectionName,
  query: {
    where: [
      {
        field: `state`,
        op: EQueryOp.in,
        value: [
          `backlog`,
          `claimed`,
          `pr_open`,
          `in_review`,
          `approved`,
          `changes_requested`,
        ],
      },
    ],
    limit: 30,
  } as TRecordQuery,
}

/** An engineer's own active WORK claims (assignee = the seat's hardcoded id). */
const engineerWorkSource = (agentId: string): TContextSource => ({
  as: `My dev tasks (work I hold)`,
  collection: DevTasksCollectionName,
  query: {
    where: [
      { field: `assignee`, op: EQueryOp.eq, value: agentId },
      {
        field: `state`,
        op: EQueryOp.in,
        value: [`claimed`, `pr_open`, `in_review`, `approved`, `changes_requested`],
      },
    ],
    limit: 10,
  } as TRecordQuery,
})

/** An engineer's own active REVIEW claims (reviewer = the seat's hardcoded id). */
const engineerReviewSource = (agentId: string): TContextSource => ({
  as: `My reviews (reviews I hold)`,
  collection: DevTasksCollectionName,
  query: {
    where: [
      { field: `reviewer`, op: EQueryOp.eq, value: agentId },
      { field: `state`, op: EQueryOp.in, value: [`in_review`, `approved`] },
    ],
    limit: 10,
  } as TRecordQuery,
})

/**
 * An engineer's my-changes watch query: changes_requested tasks ASSIGNED TO
 * THIS SEAT. The per-agent value filter is expressible precisely because each
 * config is a per-agent JSON document — the seat's own id is hardcoded into
 * its query (the prompt still tells the engineer to verify assignee == self
 * and stand down otherwise, defense in depth).
 */
const engineerChangesQuery = (agentId: string): TRecordQuery => ({
  where: [
    { field: `state`, op: EQueryOp.eq, value: `changes_requested` },
    { field: `assignee`, op: EQueryOp.eq, value: agentId },
  ],
  limit: 20,
})

/**
 * Resident config seed records — Resident Agents R4 (CMO pilot activation).
 *
 * One declarative `resident_configs` record per ACTIVATED resident, reconciled
 * by `reconcileResidentConfigs` below: created if absent, and re-applied from
 * this seed on drift WHILE the platform owns it, so a capability/prompt update
 * here reaches a live resident. The moment the agent evolves the record via
 * updateResidentConfig it is stamped `evolvedByAgent` and becomes its OWN
 * document — from there a deploy never overwrites it. Every field name and unit matches what
 * the R2 runtime reads (repos/resident/src/config.ts `normalizeResidentConfig`
 * / types/resident.types.ts `TResidentConfig`); the records.test.ts guard runs
 * this seed through that exact parser so config/runtime drift can never land.
 *
 * The seed stays INERT in prod until the CMO's body sandbox is flipped to
 * resident mode (`sandbox.config.resident`) — the watchdog skips a
 * resident_configs record whose sandbox is not in resident mode.
 */

/** A resident config seed: a stable record id + the config document. */
export type TResidentConfigSeedRecord = {
  /** Stable `records.id` (rec_ prefix, 10-char id shape). */
  id: string
  data: {
    agentId: string
    agenda: { key: string; cron: string; prompt: string }[]
    watches: {
      key: string
      collection: string
      query: TRecordQuery
      prompt: string
      debounceMs?: number
      pollMs?: number
    }[]
    inbox: { pollMs: number }
    compaction: { maxTurns: number; maxBytes: number }
    session: { seedPrompt: string; contextSources: TContextSource[] }
    subAgents: { maxConcurrent: number }
    selfDirected: { prompt: string; minIdleMs: number }
    actions: string[]
    functions: Record<string, string>
  }
}

/**
 * The CMO resident config (the R4 pilot). Prompt reuse: the agenda item and
 * the deliberation watch load the SAME `agent-schedules/{cmo-marketing,
 * cmo-board}.md` files the (now disabled) scheduled defs load, via the same
 * `loadPrompt`; the session seed is `agent-schedules/cmo-resident-session.md`
 * (the soul paragraph + standing directives, drawn from those two files).
 * Context reuse: the session's contextSources are the exact five source
 * objects the two scheduled defs carried (Strategy, MarketingArtifacts,
 * OpenDecisions, Positions, Plans), and the two watch queries reference the
 * matching sources' queries so the watched sets and the injected context can
 * never drift apart.
 */
export const CmoResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_cmores`,
  data: {
    agentId: CmoAgentId,
    // The daily marketing cycle, unchanged cadence — the resident agenda
    // replaces the disabled sd_cmomkt1 cron def.
    agenda: [
      {
        key: `marketing`,
        cron: `0 5 * * *`,
        prompt: loadPrompt(`cmo-marketing`),
      },
    ],
    watches: [
      // Replaces the disabled sd_cmobrd1 deliberation cron: a new/deliberating
      // decision fires this watch, so positions post within minutes instead of
      // at the next :45. 60s debounce = the runtime's DefaultWatchDebounceMs —
      // one turn per change burst, never a hot loop.
      {
        key: `deliberation`,
        collection: BoardOpenDecisionsSource.collection,
        query: BoardOpenDecisionsSource.query,
        debounceMs: 60_000,
        prompt: loadPrompt(`cmo-board`),
      },
      // Plans move slower than decisions — a 10-minute debounce keeps this to
      // lane-review cadence rather than reacting to every milestone patch.
      {
        key: `plans`,
        collection: BoardPlansSource.collection,
        query: BoardPlansSource.query,
        debounceMs: 600_000,
        prompt: [
          `The active plans changed — review whether your GTM lane needs action.`,
          `Check the gtm plan's open milestones and keyResults against the change shown in the matched records: if your lane is affected, act (advance a milestone, draft or update an artifact, or prepare a board decision); if it is not, say so in one line and stop.`,
        ].join(`\n`),
      },
    ],
    inbox: { pollMs: 15_000 },
    // Explicit copies of the R2 defaults (constants.ts DefaultMaxTurns /
    // DefaultMaxBytes) so the thresholds are visible config, not implicit.
    compaction: { maxTurns: 40, maxBytes: 400_000 },
    session: {
      seedPrompt: loadPrompt(`cmo-resident-session`),
      contextSources: [
        BoardStrategySource,
        MarketingArtifactsSource,
        BoardOpenDecisionsSource,
        BoardPositionsSource,
        BoardPlansSource,
        CmoMemoriesSource,
      ],
    },
    subAgents: { maxConcurrent: 2 },
    selfDirected: {
      minIdleMs: 600_000,
      prompt: `Advance your GTM lane: pick the highest-value next action from your active plans' open milestones; research, draft artifacts, or prepare decisions.`,
    },
    // The server-side dispatch allowlist (resolveResidentAllowlist reads this
    // array): the union of the two scheduled defs' allowlists plus the five R3
    // housekeeping Functions.
    actions: [
      `postPosition`,
      `openDecision`,
      `saveMarketingArtifact`,
      `upsertPlan`,
      `updateMilestone`,
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ],
    // The housekeeping map the R2 runtime dispatches through (TResidentFunctions).
    // `writeMemory` persists a turn's tdsk-memories block into resident_memories;
    // CmoMemoriesSource above surfaces them back, so learning survives compaction.
    functions: {
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
      writeMemory: `writeMemory`,
    },
  },
}

/**
 * The CEO resident config (Resident Agents R5). Prompt reuse: the strategy
 * agenda loads `agent-schedules/ceo-strategy.md` and the board-review agenda
 * loads `agent-schedules/ceo-board.md` (the SAME files the disabled sd_ceostr1/
 * sd_ceobrd1 crons load), via the same `loadPrompt`; the session seed is
 * `agent-schedules/ceo-resident-session.md`.
 *
 * Board resolution is a PERIODIC agenda (every 3h), NOT a fast watch: the CEO
 * RESOLVES decisions (unlike the CMO, which only POSTS positions on its fast
 * deliberation watch), and resolution must be paced to the board's deliberation
 * window. A 60s decision watch would spin uselessly against the CTO's slower
 * position cadence and would collapse the deliberate openDecision (strategy
 * cycle) vs resolveBoard (board cycle) separation. The only watch is `plans`.
 */
export const CeoResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_ceores`,
  data: {
    agentId: CeoAgentId,
    agenda: [
      // The daily strategy cycle, unchanged cadence — replaces sd_ceostr1.
      {
        key: `strategy`,
        cron: `0 4 * * *`,
        prompt: loadPrompt(`ceo-strategy`),
      },
      // Board review every 3h (NOT a fast watch): post the CEO's position and
      // resolve RIPE decisions. Paced so resolveBoard sees accrued positions
      // rather than spinning; replaces the 6-hourly sd_ceobrd1 cron.
      {
        key: `board-review`,
        cron: `0 */3 * * *`,
        prompt: loadPrompt(`ceo-board`),
      },
    ],
    watches: [
      // Plans move slower than decisions — a 10-minute debounce keeps this to
      // lane-review cadence. The CEO owns the company + initiative plans. There
      // is deliberately NO decision watch: the CEO resolves, and resolution is
      // agenda-paced (see the doc above), never watch-fast.
      {
        key: `plans`,
        collection: BoardPlansSource.collection,
        query: BoardPlansSource.query,
        debounceMs: 600_000,
        prompt: [
          `The active plans changed — review whether the company or initiative plans need action.`,
          `Check your company and initiative plans' open milestones and keyResults against the change shown in the matched records: if a plan you own is affected, act (advance a milestone, update strategy, or prepare a board decision); if not, say so in one line and stop.`,
        ].join(`\n`),
      },
    ],
    inbox: { pollMs: 15_000 },
    compaction: { maxTurns: 40, maxBytes: 400_000 },
    session: {
      seedPrompt: loadPrompt(`ceo-resident-session`),
      contextSources: [
        BoardStrategySource,
        BoardOpenDecisionsSource,
        BoardPositionsSource,
        BoardPlansSource,
        CeoMemoriesSource,
      ],
    },
    subAgents: { maxConcurrent: 2 },
    selfDirected: {
      minIdleMs: 600_000,
      prompt: `Advance company strategy: refine positioning and segments from research, maintain the company and initiative plans' open milestones, and prepare decisions for the board. NEVER resolve a decision you opened this turn.`,
    },
    // The dispatch allowlist: the union of the strategy cycle (upsertStrategy,
    // openDecision, upsertPlan, updateMilestone) and the board cycle
    // (postPosition, resolveBoard) allowlists, plus the housekeeping Functions.
    // openDecision and resolveBoard stay prompt-separated (strategy agenda opens,
    // board-review agenda resolves) per the ceo-resident-session guard.
    actions: [
      `upsertStrategy`,
      `openDecision`,
      `upsertPlan`,
      `updateMilestone`,
      `postPosition`,
      `resolveBoard`,
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ],
    functions: {
      heartbeat: `heartbeat`,
      appendTranscript: `appendTranscript`,
      markMessageRead: `markMessageRead`,
      writeMemory: `writeMemory`,
    },
  },
}

// ── Realtime engineering team (Phase 2 — SHADOW: seeded inert) ───────────────
// A CTO lead + two engineer residents working the `dev_tasks` state machine
// concurrently. These configs reconcile like every other resident config but
// stay INERT until each seat's body sandbox is flipped to resident mode (the
// watchdog skips a non-resident sandbox); the flip is deliberately NOT part of
// any seed — the inert-first pattern (ship + verify, THEN activate).

/** The engineer housekeeping map (identical to the exec residents'). */
const ResidentHousekeepingFunctions = {
  heartbeat: `heartbeat`,
  appendTranscript: `appendTranscript`,
  markMessageRead: `markMessageRead`,
  writeMemory: `writeMemory`,
}

/**
 * Build one engineer resident config. The two engineer seats are IDENTICAL
 * apart from the agentId (a single factory guarantees it): both watch the same
 * backlog and review sets, and each watches its OWN changes_requested set via
 * its hardcoded id. Engineers hold the state machine's seven WORK-PATH
 * Functions — grooming (devAddTask), reaping (devReapExpired), and the
 * explicit close-out (devAbandon) are the CTO lead's duties, deliberately NOT
 * on the engineer allowlist (one owner per duty; the machine's identity gates
 * are enforced in the Functions either way).
 */
const buildEngineerResidentConfig = (
  agentId: string
): TResidentConfigSeedRecord[`data`] => ({
  agentId,
  // No agenda: engineers are purely reactive (watches + inbox) and
  // self-directed — the REALTIME half of the team.
  agenda: [],
  watches: [
    // A task hit the backlog — claim-and-execute. 30s debounce: one turn per
    // grooming burst, and a lost claim race just moves to the next task.
    {
      key: `backlog`,
      collection: DevTasksCollectionName,
      query: DevTasksBacklogSource.query,
      debounceMs: 30_000,
      prompt: [
        `New work is available on the dev_tasks backlog.`,
        `Pick ONE task from the matched records (highest priority first), win it with a SYNCHRONOUS devClaimTask (curl the dispatch endpoint per your standing directives and READ the result — write no code until it returns claimed: true), then execute it end to end: branch, implement, run pnpm types + pnpm test until green, open the PR with gh, then record it with devSubmitPr (prNumber, prUrl, branch, headSha). Renew your lease with a synchronous devRenewLease about every 10 minutes while you work. If devClaimTask returns conflict, your teammate won it — move to the next task or stand down.`,
      ].join(`\n`),
    },
    // A PR opened — claim-and-review. The Function refuses your own PR, so the
    // author's seat simply loses this race by design.
    {
      key: `reviews`,
      collection: DevTasksCollectionName,
      query: DevTasksReviewableQuery,
      debounceMs: 30_000,
      prompt: [
        `A PR is awaiting review on the dev_tasks board.`,
        `Pick ONE pr_open task from the matched records and win the review with a SYNCHRONOUS devClaimReview (curl the dispatch endpoint and READ the result before reviewing) — the platform refuses your own PRs (reviewer can never equal assignee), so a refusal or conflict means stand down. Review for real: fetch the branch, read the FULL diff, run pnpm types + pnpm test locally, then record your verdict with devCompleteReview bound to the exact headSha you reviewed (approved, or changes_requested with actionable notes). An approved verdict starts YOUR 60-minute merge lease: verify CI is green, merge with gh pr merge --admin, and close the loop with devMarkMerged before it expires — or the reaper returns the task to pr_open for a fresh review.`,
      ].join(`\n`),
    },
    // A reviewer requested changes on THIS seat's PR (assignee hardcoded in
    // the query; the prompt re-verifies as defense in depth).
    {
      key: `my-changes`,
      collection: DevTasksCollectionName,
      query: engineerChangesQuery(agentId),
      debounceMs: 30_000,
      prompt: [
        `A review requested changes on YOUR PR (this watch matches only tasks assigned to you — if a matched record's assignee is not you, stand down).`,
        `The verdict started your 60-minute fix lease. Read the reviewer's notes on the record, fix the code on your branch, run pnpm types + pnpm test until green, push, then record the new head with devUpdatePr (headSha) — it clears the reviewer and voids the stale review, so the task re-enters pr_open for a fresh review. An expired fix lease is reaped back to backlog for rework (your branch and PR anchors survive on the record), so land the fix inside the window.`,
      ].join(`\n`),
    },
  ],
  inbox: { pollMs: 15_000 },
  compaction: { maxTurns: 40, maxBytes: 400_000 },
  session: {
    seedPrompt: loadPrompt(`engineer-resident-session`),
    contextSources: [
      engineerWorkSource(agentId),
      engineerReviewSource(agentId),
      DevTasksBacklogSource,
      memoriesSourceFor(agentId),
    ],
  },
  subAgents: { maxConcurrent: 2 },
  selfDirected: {
    minIdleMs: 600_000,
    prompt: `Check the dev_tasks backlog first: if pickup-ready work exists, claim and execute it (devClaimTask, branch, code, green pnpm types + pnpm test, PR via gh, devSubmitPr). If the backlog is empty, deepen your understanding of the ThreadedStack codebase (read code, trace flows, run tests) and write what you learn as durable memories. ONLY dev_tasks work — never invent work on the live scheduled loop's backlog.`,
  },
  // The seven work-path dev* Functions + messaging + the housekeeping five —
  // the CMO actions-list shape. Identity gates (assignee-only submits,
  // reviewer !== assignee, verdict binds to headSha) live IN the Functions.
  actions: [
    `devClaimTask`,
    `devSubmitPr`,
    `devClaimReview`,
    `devCompleteReview`,
    `devUpdatePr`,
    `devMarkMerged`,
    `devRenewLease`,
    `sendAgentMessage`,
    `updateResidentConfig`,
    `heartbeat`,
    `appendTranscript`,
    `markMessageRead`,
    `writeMemory`,
  ],
  functions: { ...ResidentHousekeepingFunctions },
})

/** Engineer One — resident engineer seat (identical to Two apart from agentId). */
export const EngOneResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_en1res`,
  data: buildEngineerResidentConfig(EngOneAgentId),
}

/** Engineer Two — resident engineer seat (identical to One apart from agentId). */
export const EngTwoResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_en2res`,
  data: buildEngineerResidentConfig(EngTwoAgentId),
}

/**
 * The CTO resident config — the dev-team LEAD, on its OWN dedicated agent
 * (`CtoAgentId`, Ids.agent.cto + its body sandbox Ids.sandbox.ctoBody).
 * Deliberately NOT the steward: the steward keeps the scheduled dev-loop's 9
 * defs AND the board CTO seat (the still-enabled sd_ctobrd1 cron), so flipping
 * this lead's sandbox to resident mode never touches the live dev-loop driver.
 * The lead coordinates via inbox/records without the board seat's identity —
 * board membership (and postPosition/reportInitiativeComplete/updateMilestone,
 * which gate on it) stays with the steward. The lead's duties: hourly backlog
 * grooming (devAddTask, SMALL bounded shadow tasks), a 15-minute lease reap
 * (devReapExpired run SYNCHRONOUSLY + gh reconciliation from its VM), the
 * explicit close-out (devAbandon), and an approved-watch that sanity-checks
 * merge throughput. The CTO deliberately does NOT hold the engineers'
 * claim/review Functions — it leads the team, it never works the board itself.
 */
export const CtoResidentConfigSeed: TResidentConfigSeedRecord = {
  id: `rec_ctores`,
  data: {
    agentId: CtoAgentId,
    agenda: [
      // Hourly backlog grooming: SMALL, bounded, shadow-safe tasks only.
      {
        key: `groom`,
        cron: `0 * * * *`,
        prompt: [
          `Groom the shadow dev-task backlog.`,
          `Review the "Dev tasks in flight" context and the team's recent throughput, then add SMALL, sharply-scoped tasks with devAddTask — docs fixes, unit-test coverage gaps, small refactors, lint/type hygiene: work an engineer completes in a single sitting, each with a description precise enough to build from and a definition of done. ENFORCE THE SHADOW BOUNDARY: before adding anything, check the live steward's open PRs and its task_proposals backlog with gh from your VM and never groom a task that overlaps an in-flight change. Keep the open backlog small (under ~10 tasks); devAddTask dedupes exact titles, so refine by messaging the engineers (sendAgentMessage), not by re-adding. When the backlog is healthy and nothing needs adding, say so in one line and stop.`,
        ].join(`\n`),
      },
      // 15-minute lease reap + GitHub reconciliation (gh runs in the CTO's VM,
      // never in the Function isolate).
      {
        key: `reap`,
        cron: `*/15 * * * *`,
        prompt: [
          `Run the lease reaper: invoke devReapExpired SYNCHRONOUSLY (curl the dispatch endpoint per your standing directives and READ the returned lists — they are this turn's work).`,
          `Reclaims land as claimed → backlog, in_review → pr_open, approved → pr_open (re-review), changes_requested → backlog (rework). Then reconcile the returned reaped + candidates lists against REAL GitHub state with gh from your VM (gh pr view <prNumber>, gh pr list): a reaped task whose PR is actually merged should be driven to merged through the state machine (message the engineers); a reaped backlog task whose branch or PR already exists must not be rebuilt from scratch (the PR anchors survive on the record — message the next claimer with the existing branch); a wedged engineer gets a sendAgentMessage with what you found; a task that is genuinely dead (superseded, invalid, unrecoverable) gets an explicit devAbandon with the reason. When devReapExpired returns nothing expired, say so in one line and stop.`,
        ].join(`\n`),
      },
    ],
    watches: [
      // A review verdict landed approved — sanity-check the merge lane. 60s
      // debounce = the runtime's default: one turn per approval burst.
      {
        key: `approved`,
        collection: DevTasksCollectionName,
        query: DevTasksApprovedQuery,
        debounceMs: 60_000,
        prompt: [
          `A task reached approved — sanity-check merge throughput.`,
          `Approved means the RECORDED REVIEWER owns the merge (gh pr merge --admin, then devMarkMerged) inside a 60-minute merge lease — the platform-recorded verdict is the gate, while the CI check and the merge itself are prompt discipline on the shared GitHub account (GitHub's same-account approval UI cannot arbitrate). If approved tasks are sitting unmerged, verify CI state with gh from your VM and nudge the recorded reviewer via sendAgentMessage — an expired merge lease is reaped back to pr_open for a fresh review; if the lane is flowing, say so in one line and stop.`,
        ].join(`\n`),
      },
    ],
    inbox: { pollMs: 15_000 },
    compaction: { maxTurns: 40, maxBytes: 400_000 },
    session: {
      seedPrompt: loadPrompt(`cto-resident-session`),
      contextSources: [
        BoardStrategySource,
        BoardPlansSource,
        DevTasksInFlightSource,
        CtoMemoriesSource,
      ],
    },
    subAgents: { maxConcurrent: 2 },
    selfDirected: {
      minIdleMs: 600_000,
      prompt: `Review team health: lease liveness, backlog depth, review latency, and merge throughput on the dev_tasks board; message the engineers about anything wedged (sendAgentMessage). NEVER claim, review, or merge a dev task yourself — you lead, groom, reap, and close out.`,
    },
    // The three lead duties + messaging + the housekeeping five. Deliberately
    // NO engineer claim/review Functions (the lead never works its own board)
    // and NO board-seat Functions (postPosition/reportInitiativeComplete/
    // updateMilestone gate on board membership, which stays with the steward's
    // scheduled seat).
    actions: [
      `devAddTask`,
      `devReapExpired`,
      `devAbandon`,
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ],
    functions: { ...ResidentHousekeepingFunctions },
  },
}

/** Every resident config seed, in activation order. */
export const ResidentConfigSeedRecords: TResidentConfigSeedRecord[] = [
  CmoResidentConfigSeed,
  CeoResidentConfigSeed,
  EngOneResidentConfigSeed,
  EngTwoResidentConfigSeed,
  CtoResidentConfigSeed,
]

/** The record-service slice the reconcile needs (project+collection-scoped). */
export type TResidentConfigRecordService = {
  query: (
    projectId: string,
    collectionName: string,
    query: TRecordQuery
  ) => Promise<{ data?: any[]; error?: any }>
  upsert: (
    projectId: string,
    collectionName: string,
    input: { id?: string; data: Record<string, unknown> }
  ) => Promise<{ data?: any; error?: any }>
  replaceIfMarkerUnset: (
    projectId: string,
    collectionName: string,
    id: string,
    markerKey: string,
    data: Record<string, unknown>
  ) => Promise<{ data?: any; error?: any; skipped?: boolean }>
}

export type TResidentConfigsAction = `created` | `updated` | `unchanged` | `error`

export type TResidentConfigsSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: {
    agentId: string
    action: TResidentConfigsAction
    message?: string
  }[]
}

/**
 * Reconcile the resident config records so platform capability/prompt updates
 * propagate to live residents. A resident with NO `resident_configs` record is
 * created from its seed. An EXISTING record is UPDATED from the seed UNLESS the
 * agent has taken ownership (`data.evolvedByAgent === true`, stamped by
 * updateResidentConfig) — an agent-evolved config is left byte-untouched. So an
 * added capability (an added Function, an updated prompt) reaches a resident
 * that has not customized its own config, while an agent that has evolved its
 * config keeps it. Never throws — every outcome is captured in the summary.
 */
export const reconcileResidentConfigs = async (
  service: TResidentConfigRecordService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TResidentConfigsSummary> => {
  const summary: TResidentConfigsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (agentId: string, message?: string) => {
    summary.errors++
    summary.results.push({ agentId, action: `error`, message })
    log(`  ❌ resident config ${agentId} — ${message ?? `unknown error`}`)
  }

  for (const seed of ResidentConfigSeedRecords) {
    const { agentId } = seed.data
    try {
      const existing = await service.query(projectId, ResidentConfigsCollectionName, {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }],
        limit: 1,
      })
      if (existing.error) {
        fail(agentId, `query failed: ${existing.error.message}`)
        continue
      }

      if (existing.data?.length) {
        const row = existing.data[0]
        // Agent has taken ownership → never touch it.
        if (row.data?.evolvedByAgent === true) {
          summary.unchanged++
          summary.results.push({ agentId, action: `unchanged` })
          log(`  ➖ resident config ${agentId} — agent-evolved, untouched`)
          continue
        }
        // Platform still owns it → re-apply the seed ONLY when it drifts, so a
        // re-run of an up-to-date config is a true no-op (stable, order-
        // independent compare — a jsonb round trip reorders keys).
        if (stableStringify(row.data) === stableStringify(seed.data)) {
          summary.unchanged++
          summary.results.push({ agentId, action: `unchanged` })
          log(`  ➖ resident config ${agentId} — up to date`)
          continue
        }
        // Drift → propagate the capability/prompt update. The write is an ATOMIC
        // guarded replace (only lands while the row is still platform-owned), so
        // an updateResidentConfig call that stamps `evolvedByAgent` between the
        // read above and this write is never clobbered — the guard skips instead.
        const upd = await service.replaceIfMarkerUnset(
          projectId,
          ResidentConfigsCollectionName,
          row.id,
          `evolvedByAgent`,
          seed.data
        )
        if (upd.error) fail(agentId, `update failed: ${upd.error.message}`)
        else if (upd.skipped) {
          summary.unchanged++
          summary.results.push({ agentId, action: `unchanged` })
          log(
            `  ➖ resident config ${agentId} — agent claimed ownership mid-reconcile, untouched`
          )
        } else {
          summary.updated++
          summary.results.push({ agentId, action: `updated` })
          log(
            `  🔄 resident config ${agentId} — updated from seed (not yet agent-evolved)`
          )
        }
        continue
      }

      const res = await service.upsert(projectId, ResidentConfigsCollectionName, {
        id: seed.id,
        data: seed.data,
      })
      if (res.error) fail(agentId, `create failed: ${res.error.message}`)
      else {
        summary.created++
        summary.results.push({ agentId, action: `created` })
        log(`  ✅ resident config ${agentId} — created`)
      }
    } catch (err: any) {
      fail(agentId, err?.message)
    }
  }

  return summary
}
