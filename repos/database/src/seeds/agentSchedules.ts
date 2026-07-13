import type { TActionsConfig, TContextSource } from '@tdsk/domain'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  EQueryOp,
  VerifyInjectMax,
  VerifyLookbackPrs,
  EscalationInjectMax,
  TaskBacklogInjectMax,
} from '@tdsk/domain'
import { RecordQueryMaxLimit } from '@TDB/utils/database/recordQuery'

/**
 * Canonical, git-versioned definitions of the autonomous agent's own operating
 * schedules Ã¢ÂÂ its "curriculum" (planning, work cycle, coordinator, sensor, etc.).
 *
 * `scripts/reconcileSchedules.ts` runs as a deploy step and upserts each row's
 * DECLARATIVE fields from here into the live `schedules` table, so the agent's
 * operating prompts live in the repo and evolve through the normal
 * steward PR -> CI -> adversary -> deploy pipeline instead of ad-hoc production
 * edits. Only declarative fields are reconciled; runtime bookkeeping
 * (lastRunAt, nextRunAt, consecutiveErrors) is never touched.
 */

// Stable identities of the live self-development org/project, the two agents,
// and their sandboxes. These are wiring (which rows to reconcile), not product
// config Ã¢ÂÂ the agnostic behavior lives entirely in the prompt files below.
export const OpsOrgId = `og_0000001`
export const OpsProjectId = `pj_tIly2F1`
// The ops project's display name — doubles as the agent_projects alias the
// seed/reconcile paths write when binding an agent to the ops project.
export const OpsProjectName = `ThreadedStack Platform`
// The system/ops user every agent-backed schedule runs as. The executor
// requires a userId on agent-backed schedules (executor.ts throws without one),
// and all 11 live rows carry this value — declaring it here means the
// reconciler creates new schedules runnable and repairs any null rows, with
// zero churn on the live ones.
export const OpsUserId = `00000000-0000-0000-0000-000000000000`
// The steward agent is ALSO the CTO board seat (the cto-board def below runs on
// it; exec-board BoardCtoAgentId matches). The steward carries the scheduled
// dev-loop and the board seat ONLY — the dev-team lead is a separate agent
// (CtoAgentId below), so flipping the lead's sandbox to resident mode never
// touches the live dev-loop driver.
export const StewardAgentId = `ag_lvUbjp_`
const StewardSandboxId = `sb_i42zg3p`
const AdversaryAgentId = `ag_2qSTfBI`
const AdversarySandboxId = `sb_xg7h1wl`
// Executive board (AI Executive Layer SP1). The CEO seat is the seeded founder
// agent + its body sandbox; these ids match the backend board constants
// (CeoAgentId / CeoSandboxId) and the fullorg seed. The CTO seat reuses the
// steward agent + sandbox above. The board runs LIVE on the platform primitives
// (the 5a activation, 2026-07-08): Collections for state, Functions invoked via
// tdsk-actions for effects, contextSources for context.
// Exported: the CEO's resident config seed (seeds/resident/records.ts) keys its
// record by this id (Resident Agents R5 — CEO activation).
export const CeoAgentId = `ag_ceo0001`
const CeoSandboxId = `sb_ceo0001`
// The CMO seat is the seeded founder-CMO agent + its body sandbox; these ids
// match the fullorg seed (Ids.agent.cmo / Ids.sandbox.cmoBody) and the
// exec-board membership record (BoardCmoAgentId). Exported: the CMO's
// resident config seed (seeds/resident/records.ts) keys its record by this id.
export const CmoAgentId = `ag_cmo0001`
const CmoSandboxId = `sb_cmo0001`
// Realtime engineering team (Phase 2) — the dedicated dev-team LEAD seat plus
// the two resident engineer seats; ids match the fullorg seed (Ids.agent.cto /
// engineerOne/Two + their body sandboxes). Exported: the resident config seeds
// (seeds/resident/records.ts) key their records AND their per-agent dev_tasks
// watch/source queries by these ids. No schedule def runs on ANY of them — the
// team is resident-only (agenda/watch/inbox/self-directed), and the seeds stay
// inert until the body sandboxes are flipped to resident mode. The lead is
// deliberately NOT the steward (StewardAgentId above): the steward keeps the
// scheduled dev-loop + the board CTO seat, and the lead coordinates the team
// via inbox/records without either identity.
export const CtoAgentId = `ag_cto0001`
export const EngOneAgentId = `ag_eng0001`
export const EngTwoAgentId = `ag_eng0002`
export const EngThreeAgentId = `ag_eng0003`

// Ã¢ÂÂÃ¢ÂÂ Board cycle context sources (generalization Ã¢ÂÂ¢) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Declarative replacements for the hard-coded board context builders: every
// board cycle reads the durable strategy singleton and the still-open decision
// proposals from the board Collections (seeds/exec-board/collections.ts); the
// two deliberation cycles additionally read the posted per-round positions.
// Positions cannot be filtered per-proposal in a static query, so the source
// injects the most recent rounds (orderBy round desc, limit 50) and the prompts
// match them to proposals by `proposalId`. Exported: the CMO's resident config
// seed (seeds/resident/records.ts) reuses these exact source shapes as the
// resident session's contextSources.
export const BoardStrategySource: TContextSource = {
  collection: `company_strategy`,
  query: {},
  as: `Company Strategy`,
}
export const BoardOpenDecisionsSource: TContextSource = {
  collection: `decision_proposals`,
  query: {
    where: [{ field: `status`, op: EQueryOp.in, value: [`open`, `deliberating`] }],
  },
  as: `Open board decisions`,
}
export const BoardPositionsSource: TContextSource = {
  collection: `decision_positions`,
  query: { orderBy: { field: `round`, direction: `desc` }, limit: 50 },
  as: `Board positions`,
}
// The CMO marketing cycle's view of its own drafting surface: the most recent
// marketing_artifacts records (newest first via the record service's default
// createdAt-desc order), so a cycle advances existing drafts by their record id
// instead of duplicating them.
export const MarketingArtifactsSource: TContextSource = {
  collection: `marketing_artifacts`,
  query: { limit: 20 },
  as: `Recent marketing artifacts`,
}
// Every exec cycle's view of the ACTIVE long-term plans (planning system):
// the board maintains plans records (kind company|gtm|initiative) via
// upsertPlan/updateMilestone, and every exec prompt reads the active ones so
// research stays targeted at open milestones and positions cite plan progress.
export const BoardPlansSource: TContextSource = {
  collection: `plans`,
  query: {
    where: [{ field: `status`, op: EQueryOp.eq, value: `active` }],
    limit: 10,
  },
  as: `Plans`,
}

// ── Dev-loop workflow context sources (Dev-Loop on Primitives ⑤b-3) ──────────
// Declarative replacements for the hard-coded dev-loop context builders in
// repos/backend/src/services/scheduler/executor.ts, reading the ⑤b-2 dev-loop
// Collections (seeds/dev-loop/collections.ts). Defined here but attached to NO
// schedule def — the Phase 4 cutovers wire them def-by-def, so every live def
// below stays byte-identical. Where a legacy builder merged two reads, two
// sources express it. A query that omits `orderBy` renders newest-first (the
// record service defaults to createdAt desc), matching the legacy services'
// newest-first reads. Exported so the backend rendering-parity tests and the
// Phase 4 cutover defs reference one canonical definition.

/**
 * Replaces `buildTaskBacklogContext` (executor.ts:646 — the WORK cycle's
 * pickup-ready backlog via taskProposal.listBacklog): scanned proposals,
 * priority-ordered P0-first, capped at the legacy entry budget. listBacklog's
 * SECONDARY newest-first tiebreak is not expressible in the single-field
 * orderBy; the cutover prompt treats equal-priority entries as unordered
 * (pick any — priority is the only load-bearing order).
 */
export const DevTaskBacklogSource: TContextSource = {
  collection: `task_proposals`,
  query: {
    where: [{ field: `status`, op: EQueryOp.eq, value: `scanned` }],
    orderBy: { field: `priority`, direction: `asc` },
    limit: TaskBacklogInjectMax,
  },
  as: `Proposed backlog (sensor-detected)`,
  // The SOLE-groomer CTO must see the WHOLE scanned backlog to find buildable
  // work. The default per-section char cap (ContextSourceInjectMaxChars, 8000)
  // bound at ~5 proposals, and priority ordering surfaced only the hard/blocked
  // P1s — the tractable P2/P3 work fell off the bottom, so the CTO saw only
  // un-buildable proposals and groomed nothing, starving the team. Raise the cap
  // to fit the full injected set (up to TaskBacklogInjectMax rows).
  max: 40000,
}

/**
 * Replaces `buildOpenProposalsDigest` (executor.ts:613 — the SENSOR cycle's
 * do-not-duplicate digest): every still-open (pending + scanned) proposal.
 * The legacy read was unbounded; the query API caps at 100 (newest first via
 * the default createdAt-desc order), far above any observed open-backlog size.
 */
export const DevOpenProposalsSource: TContextSource = {
  collection: `task_proposals`,
  query: {
    where: [{ field: `status`, op: EQueryOp.in, value: [`pending`, `scanned`] }],
    limit: RecordQueryMaxLimit,
  },
  as: `Recently proposed backlog (do not duplicate)`,
}

/**
 * Dev-team OUTPUT-liveness signals for the sensor: the resident seats' status
 * rows (turn counters — a seat whose turns climb while the board never moves
 * is failing silently, the exact activation-day failure mode) and the newest
 * dev_tasks rows (stuck states, stale leases, an empty board while the team
 * idles). The sensor interprets these read-only digests as signal 7 — the
 * fix, as always, flows through a filed proposal, never a manual hand.
 */
export const DevTeamStatusSource: TContextSource = {
  collection: `resident_status`,
  query: {
    where: [
      {
        field: `agentId`,
        op: EQueryOp.in,
        value: [CtoAgentId, EngOneAgentId, EngTwoAgentId, EngThreeAgentId],
      },
    ],
    limit: 10,
  },
  as: `Dev-team resident status`,
}

export const DevTeamTasksSource: TContextSource = {
  collection: `dev_tasks`,
  query: {
    orderBy: { field: `state`, direction: `asc` },
    limit: 30,
  },
  as: `Dev-team board (newest 30)`,
}

/**
 * Replaces `buildEscalationContext` (executor.ts:769 — every runtime cycle's
 * open-escalations view): routed + open escalations with routed listed FIRST
 * (text desc: 'routed' > 'open' — the same routed-first order the legacy
 * builder produced by concatenating its two reads), capped at the legacy
 * entry budget.
 */
export const DevEscalationsSource: TContextSource = {
  collection: `escalations`,
  query: {
    where: [{ field: `status`, op: EQueryOp.in, value: [`routed`, `open`] }],
    orderBy: { field: `status`, direction: `desc` },
    limit: EscalationInjectMax,
  },
  as: `Open escalations (do NOT re-raise; act on routed ones)`,
}

/**
 * Replaces the in-flight half of `buildVerifyContext` (executor.ts:891):
 * pending + verifying rows that still need probing, pending listed first
 * (text asc: 'pending' < 'verifying' — the legacy concatenation order),
 * capped at the legacy entry budget.
 */
export const DevVerificationsInFlightSource: TContextSource = {
  collection: `verifications`,
  query: {
    where: [{ field: `status`, op: EQueryOp.in, value: [`pending`, `verifying`] }],
    orderBy: { field: `status`, direction: `asc` },
    limit: VerifyInjectMax,
  },
  as: `Verifications in flight (probe these)`,
}

/**
 * Replaces the done-set half of `buildVerifyContext` (executor.ts:891): the
 * most recent terminal (verified | regressed) rows, whose prNumbers the
 * cutover prompt skips as already probed. Newest-first via the default
 * createdAt-desc order — sharper than the legacy read, which filtered the
 * terminal rows out of the newest VerifyLookbackPrs rows overall and so
 * could surface fewer.
 */
export const DevVerificationsRecentSource: TContextSource = {
  collection: `verifications`,
  query: {
    where: [{ field: `status`, op: EQueryOp.in, value: [`verified`, `regressed`] }],
    limit: VerifyLookbackPrs,
  },
  as: `Recent terminal verifications (done-set — skip these PR numbers)`,
}

/**
 * Replaces `buildCoordinatorContext` (executor.ts:1140 — the COORDINATOR
 * cycle's initiative ledger). The ONE intent a static query cannot express is
 * the initiative filter (the live marker is `auto`, resolved from the roadmap
 * at runtime), so the source injects EVERY initiative-carrying proposal
 * (`ne ''` — records without an initiative compare as SQL NULL and never
 * match), grouped by initiative via orderBy, at the API's max limit. The
 * cutover prompt selects its current initiative's rows by their `initiative`
 * field and rebuilds the parent/child ledger from `parentId` — the hierarchy
 * was always assembled app-side; the source only needs the records.
 */
export const DevCoordinatorLedgerSource: TContextSource = {
  collection: `task_proposals`,
  query: {
    where: [{ field: `initiative`, op: EQueryOp.ne, value: `` }],
    orderBy: { field: `initiative`, direction: `asc` },
    limit: RecordQueryMaxLimit,
  },
  as: `Coordinator ledger (all initiatives)`,
}

export type TAgentScheduleDef = {
  /** Prompt filename stem under ./agent-schedules and the human-facing label. */
  key: string
  /** Stable production `schedules.id`. */
  id: string
  cronExpression: string
  enabled: boolean
  type: `prompt`
  timeoutMs: number | null
  maxConsecutiveErrors: number
  agentId: string
  sandboxId: string
  orgId: string
  projectId: string
  /** System user the schedule runs as — required by the executor for agent-backed schedules. */
  userId: string
  /**
   * Optional declarative context sources injected into the cycle prompt. Absent
   * on every live schedule today (they use the hard-coded builders), so the
   * reconciler treats undefined here as equal to a null DB column Ã¢ÂÂ no churn.
   */
  contextSources?: TContextSource[]
  /**
   * Optional opt-in effect-surface allowlist (generalization Ã¢ÂÂ¡). Absent on every
   * live schedule today, so the reconciler treats undefined here as equal to a
   * null DB column Ã¢ÂÂ no churn Ã¢ÂÂ and the effect surface stays inert.
   */
  actions?: TActionsConfig | null
  /** Loaded from ./agent-schedules/<key>.md at module load. */
  prompt: string
}

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), `agent-schedules`)

/**
 * Load a prompt `.md` and strip the single trailing newline the file carries,
 * so the stored value matches the intended prompt and the reconciler's
 * change-detection does not churn on a cosmetic newline every deploy.
 * Exported: the CMO's resident config seed (seeds/resident/records.ts) loads
 * its agenda/watch/session prompts through the same mechanism, from the same
 * directory.
 */
export const loadPrompt = (key: string): string =>
  readFileSync(join(promptsDir, `${key}.md`), `utf8`).replace(/\n$/, ``)

type TDefCore = {
  key: string
  id: string
  cronExpression: string
  timeoutMs: number | null
  maxConsecutiveErrors: number
  enabled?: boolean
  contextSources?: TContextSource[]
  actions?: TActionsConfig
}

const make =
  (agentId: string, sandboxId: string) =>
  (d: TDefCore): TAgentScheduleDef => ({
    key: d.key,
    id: d.id,
    cronExpression: d.cronExpression,
    timeoutMs: d.timeoutMs,
    maxConsecutiveErrors: d.maxConsecutiveErrors,
    enabled: d.enabled ?? true,
    type: `prompt`,
    agentId,
    sandboxId,
    orgId: OpsOrgId,
    projectId: OpsProjectId,
    userId: OpsUserId,
    // Conditional spread keeps the keys ABSENT on the 11 live dev-loop defs, so
    // they stay byte-identical (reconciler: undefined == null DB column, no churn).
    ...(d.contextSources ? { contextSources: d.contextSources } : {}),
    ...(d.actions ? { actions: d.actions } : {}),
    prompt: loadPrompt(d.key),
  })

const steward = make(StewardAgentId, StewardSandboxId)
const adversary = make(AdversaryAgentId, AdversarySandboxId)
const ceo = make(CeoAgentId, CeoSandboxId)
const cmo = make(CmoAgentId, CmoSandboxId)

/**
 * The 11 live self-development schedules plus the 5 executive-board schedules
 * (LIVE on the primitives since the ⑤a activation, 2026-07-08). The CMO seat
 * runs as a RESIDENT (Resident Agents R4 — seeds/resident/records.ts), so its
 * two defs ship DISABLED: the resident's agenda carries the marketing cycle
 * and its deliberation watch replaces the board cron. Cadence + bindings are
 * pinned to the production rows; the behavior is entirely in the referenced
 * prompt files.
 */
export const AgentScheduleDefs: TAgentScheduleDef[] = [
  steward({
    key: `planning`,
    id: `sd_6TnydNv`,
    // CUTOVER (Deploy E): DECOMMISSIONED. The resident CTO grooms the real
    // task_proposals backlog into dev_tasks (Deploy B/B.1), so the scheduled
    // planning cycle's grooming is replaced. Retained-and-enabled: sensor
    // (proposal source), verify (revert net), cto-board (strategy bridge),
    // reflection, curation. Reversible: set enabled true to bring it back.
    enabled: false,
    cronExpression: `0 6 * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
    // ⑤b-4b DUAL-EMIT cutover: every tdsk-tasks-emitting cycle (planning,
    // coordinator, sensor) may invoke `proposeTask`
    // (seeds/dev-loop/functions/proposeTask.ts) so its proposals ALSO land in
    // the task_proposals Collection while the legacy tdsk-tasks fence keeps the
    // table authoritative. NO contextSources here: the legacy sensor faculties
    // (run outcomes + open-proposals digest) keep flowing because their gate
    // reads the PROMPT text — executor.ts:1397
    // `promptOptsIn(schedule, TasksBlockFence)` checks
    // `schedule.prompt.includes('tdsk-tasks')`, and the dual-emit prompts keep
    // that fence verbatim.
    actions: { functions: [`proposeTask`] },
  }),
  steward({
    key: `work-cycle`,
    id: `sd_CUOT7Vu`,
    // CUTOVER (Deploy E): DECOMMISSIONED. The resident engineers author PRs
    // from the dev_tasks board; the scheduled coding work-cycle is replaced.
    enabled: false,
    cronExpression: `30 * * * *`,
    timeoutMs: 14_400_000,
    maxConsecutiveErrors: 6,
    // ⑤b-4a DUAL-EMIT cutover: the work cycle may invoke `pickupTask`
    // (seeds/dev-loop/functions/pickupTask.ts) so its pickups ALSO land in the
    // task_proposals Collection while the legacy tdsk-task-picked fence keeps
    // the table authoritative. NO contextSources here: the legacy backlog
    // builder keeps flowing because its gate reads the PROMPT text —
    // executor.ts:1401 `promptOptsIn(schedule, TaskPickupsBlockFence)` checks
    // `schedule.prompt.includes('tdsk-task-picked')`, and the dual-emit prompt
    // keeps that fence verbatim.
    actions: { functions: [`pickupTask`] },
  }),
  steward({
    key: `coordinator`,
    id: `sd_0HqZFQ_`,
    // CUTOVER (Deploy E): DECOMMISSIONED. Coordination now flows through the
    // resident CTO + the retained cto-board seat (strategy → engineering).
    enabled: false,
    cronExpression: `0 5 * * *`,
    timeoutMs: 14_400_000,
    maxConsecutiveErrors: 6,
    // ⑤b-4b DUAL-EMIT cutover: `proposeTask` allowlisted — see the planning
    // def's comment; the legacy tdsk-tasks fence stays verbatim and the table
    // stays authoritative.
    actions: { functions: [`proposeTask`] },
  }),
  steward({
    key: `sensor`,
    id: `sd_lSst6Tq`,
    cronExpression: `40 */2 * * *`,
    timeoutMs: 5_400_000,
    maxConsecutiveErrors: 6,
    // Dev-team output-liveness digests for signal 7 (see sensor.md): the
    // resident seats' turn counters + the board's newest rows, injected
    // read-only so the sensor can flag silent-turn failures, stuck states,
    // and a starved board without any new access surface.
    contextSources: [DevTeamStatusSource, DevTeamTasksSource],
    // ⑤b-4b DUAL-EMIT cutover: `proposeTask` allowlisted — see the planning
    // def's comment; the legacy tdsk-tasks fence stays verbatim and the table
    // stays authoritative.
    actions: { functions: [`proposeTask`] },
  }),
  steward({
    key: `observer`,
    id: `sd_e3bURkR`,
    // CUTOVER (Deploy E): DECOMMISSIONED. The always-on residents + sensor
    // signal-7 cover observation; the hourly steward wake is redundant.
    enabled: false,
    cronExpression: `10 * * * *`,
    timeoutMs: null,
    maxConsecutiveErrors: 5,
  }),
  steward({
    key: `pr-response`,
    id: `sd_EAz_2r5`,
    // CUTOVER (Deploy E): DECOMMISSIONED. The resident engineers service their
    // own reviews and fixes on the dev_tasks board (claim → review → merge).
    enabled: false,
    // Every 15 min. On a multi-round adversary review, the steward's fix waits
    // for the next pr-response cycle before it lands, so a 30-min cadence made
    // each change-request round cost ~50 min and pushed multi-round PRs past the
    // "one new PR per hour" target (the review gate blocks new work-cycle PRs
    // while one is open). 15-min pr-response mirrors the 15-min adversary cadence
    // so a requestÃ¢ÂÂfixÃ¢ÂÂre-review round completes fast. `5,20,35,50` is a superset
    // of `5,35`, so the reconciler transition skips no fire.
    cronExpression: `5,20,35,50 * * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 3,
  }),
  steward({
    key: `verify`,
    id: `sd_sLWvMuD`,
    cronExpression: `7,22,37,52 * * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
  }),
  steward({
    key: `reflection`,
    id: `sd_ROO3t4S`,
    cronExpression: `0 8 * * *`,
    timeoutMs: null,
    maxConsecutiveErrors: 6,
  }),
  steward({
    key: `curation`,
    id: `sd_IOf9soP`,
    cronExpression: `0 7 * * *`,
    timeoutMs: 1_800_000,
    maxConsecutiveErrors: 6,
  }),
  adversary({
    key: `ops-review`,
    id: `sd_MaQz9xT`,
    // CUTOVER (Deploy E): DECOMMISSIONED. The resident team does its own peer
    // review; the adversary ops-review cycle is retired with the scheduled loop.
    enabled: false,
    cronExpression: `12,42 * * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
  }),
  adversary({
    key: `adversary-review`,
    id: `sd_nPDxUUG`,
    // CUTOVER (Deploy E): DECOMMISSIONED. Independent review is now the resident
    // engineers' platform-enforced peer review (reviewer !== assignee, verdict
    // bound to headSha); the scheduled adversary gate is retired.
    enabled: false,
    // Every 15 min. A steward PR that falls BEHIND (concurrent merge to main)
    // costs one adversary cycle to rebase (rule 2a: update-branch then defer)
    // plus one to review, so at the old 30-min cadence a rebased PR could sit
    // ~60 min before merge Ã¢ÂÂ past the "one new PR per hour" throughput target.
    // 15-min cadence halves that. `5,20,35,50` is a superset of the old
    // `20,50`, so the reconciler transition skips no fire; :05/:35 land ~5 min
    // after the :30 work cycle opens a PR, giving fast first-review pickup.
    cronExpression: `5,20,35,50 * * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 3,
  }),
  // Ã¢ÂÂÃ¢ÂÂ Executive board (AI Executive Layer SP1) Ã¢ÂÂ all disabled until activation Ã¢ÂÂÃ¢ÂÂ
  // The CEO strategy cycle runs daily (research + metrics -> strategy) and the
  // CMO marketing cycle follows an hour later (research -> GTM/marketing drafts);
  // the three board cycles run a few times/day so a decision can open, gather
  // every seat's position, and resolve within a day while the Active Initiative
  // stays frozen. The CTO board cycle runs on the steward agent+sandbox (the CTO
  // seat) but is a distinct schedule from the steward's dev-loop cycles.
  // Each board schedule carries the Ã¢ÂÂ¡ effect-surface allowlist of exactly the
  // Functions its role may invoke (seeds/exec-board/functions/*) and the Ã¢ÂÂ¢
  // contextSources that inject the board Collections into its prompt. The CEO
  // board cycle owns resolution (spec ÃÂ§5: it closes its tdsk-actions block with
  // `resolveBoard`), mirroring the hard-coded isCeoSchedule executor branch.
  // Every exec def reads the active plans (BoardPlansSource); plan authorship
  // is lane-scoped — the CEO strategy cycle writes company/initiative plans,
  // the CMO marketing cycle writes the gtm plan (upsertPlan validates the
  // caller's role against the plan's owner) — and progress reporting
  // (updateMilestone) additionally rides the CTO board cycle, which reports
  // execution progress.
  // DISABLED: the CEO runs as a RESIDENT (Resident Agents R5). The daily
  // strategy cycle moved to the resident's `strategy` agenda item (same
  // `0 4 * * *` cadence, same prompt file — seeds/resident/records.ts). The def
  // is kept (disabled) so the reconciler holds the prod row off and the prompt
  // file stays the single source the resident agenda reuses.
  ceo({
    key: `ceo-strategy`,
    id: `sd_ceostr1`,
    cronExpression: `0 4 * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
    enabled: false,
    contextSources: [BoardStrategySource, BoardOpenDecisionsSource, BoardPlansSource],
    actions: {
      functions: [`upsertStrategy`, `openDecision`, `upsertPlan`, `updateMilestone`],
    },
  }),
  // DISABLED: the CEO runs as a RESIDENT (Resident Agents R5). Board review
  // moved to the resident's `board-review` agenda item (`0 */3 * * *`, same
  // prompt file — seeds/resident/records.ts). Resolution is agenda-paced, NOT a
  // fast watch: the CEO holds resolveBoard, so it must give the board a
  // deliberation window rather than resolve on every decision change. The def
  // is kept (disabled) as the single prompt source the resident agenda reuses.
  ceo({
    key: `ceo-board`,
    id: `sd_ceobrd1`,
    cronExpression: `0 */6 * * *`,
    timeoutMs: 1_800_000,
    maxConsecutiveErrors: 6,
    enabled: false,
    contextSources: [
      BoardStrategySource,
      BoardOpenDecisionsSource,
      BoardPositionsSource,
      BoardPlansSource,
    ],
    actions: { functions: [`postPosition`, `resolveBoard`] },
  }),
  steward({
    key: `cto-board`,
    id: `sd_ctobrd1`,
    cronExpression: `30 */6 * * *`,
    timeoutMs: 1_800_000,
    maxConsecutiveErrors: 6,
    enabled: true,
    contextSources: [
      BoardStrategySource,
      BoardOpenDecisionsSource,
      BoardPositionsSource,
      BoardPlansSource,
    ],
    actions: {
      functions: [`postPosition`, `reportInitiativeComplete`, `updateMilestone`],
    },
  }),
  // DISABLED: the CMO runs as a RESIDENT (Resident Agents R4). Its
  // deliberation moved to the resident's `deliberation` watch on
  // decision_proposals (seeds/resident/records.ts) — positions post within
  // minutes of a decision appearing instead of waiting for the :45 cron. The
  // def is kept (disabled) so the reconciler holds the prod row off and the
  // prompt file stays the single source the resident watch reuses. The CMO
  // still holds `openDecision` on its resident allowlist; only the CEO board
  // cycle holds `resolveBoard`.
  cmo({
    key: `cmo-board`,
    id: `sd_cmobrd1`,
    cronExpression: `45 */6 * * *`,
    timeoutMs: 1_800_000,
    maxConsecutiveErrors: 6,
    enabled: false,
    contextSources: [
      BoardStrategySource,
      BoardOpenDecisionsSource,
      BoardPositionsSource,
      BoardPlansSource,
    ],
    actions: { functions: [`postPosition`, `openDecision`] },
  }),
  // DISABLED: the CMO runs as a RESIDENT (Resident Agents R4). The daily
  // marketing cycle moved to the resident's `marketing` agenda item (same
  // `0 5 * * *` cadence, same prompt file — seeds/resident/records.ts). The
  // def is kept (disabled) so the reconciler holds the prod row off and the
  // prompt file stays the single source the resident agenda reuses.
  cmo({
    key: `cmo-marketing`,
    id: `sd_cmomkt1`,
    cronExpression: `0 5 * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
    enabled: false,
    contextSources: [
      BoardStrategySource,
      MarketingArtifactsSource,
      BoardOpenDecisionsSource,
      BoardPlansSource,
    ],
    actions: {
      functions: [
        `saveMarketingArtifact`,
        `openDecision`,
        `upsertPlan`,
        `updateMilestone`,
      ],
    },
  }),
]
