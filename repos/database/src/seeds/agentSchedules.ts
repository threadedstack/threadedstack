import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Canonical, git-versioned definitions of the autonomous agent's own operating
 * schedules — its "curriculum" (planning, work cycle, coordinator, sensor, etc.).
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
// config — the agnostic behavior lives entirely in the prompt files below.
export const OpsOrgId = `og_0000001`
export const OpsProjectId = `pj_tIly2F1`
const StewardAgentId = `ag_lvUbjp_`
const StewardSandboxId = `sb_i42zg3p`
const AdversaryAgentId = `ag_2qSTfBI`
const AdversarySandboxId = `sb_xg7h1wl`
// Executive board (AI Executive Layer SP1). The CEO seat is the seeded founder
// agent + its body sandbox; these ids match the backend board constants
// (CeoAgentId / CeoSandboxId) and the fullorg seed. The CTO seat reuses the
// steward agent + sandbox above. All board schedules below ship `enabled:false`
// and stay inert until the activation phase seeds the CEO agent in prod and
// enables them.
const CeoAgentId = `ag_ceo0001`
const CeoSandboxId = `sb_ceo0001`

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
  /** Loaded from ./agent-schedules/<key>.md at module load. */
  prompt: string
}

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), `agent-schedules`)

/**
 * Load a prompt `.md` and strip the single trailing newline the file carries,
 * so the stored value matches the intended prompt and the reconciler's
 * change-detection does not churn on a cosmetic newline every deploy.
 */
const loadPrompt = (key: string): string =>
  readFileSync(join(promptsDir, `${key}.md`), `utf8`).replace(/\n$/, ``)

type TDefCore = {
  key: string
  id: string
  cronExpression: string
  timeoutMs: number | null
  maxConsecutiveErrors: number
  enabled?: boolean
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
    prompt: loadPrompt(d.key),
  })

const steward = make(StewardAgentId, StewardSandboxId)
const adversary = make(AdversaryAgentId, AdversarySandboxId)
const ceo = make(CeoAgentId, CeoSandboxId)

/**
 * The 11 live self-development schedules plus the 3 executive-board schedules
 * (AI Executive Layer SP1), which ship `enabled:false` and stay inert until the
 * activation phase. Cadence + bindings are pinned to the production rows; the
 * behavior is entirely in the referenced prompt files.
 */
export const AgentScheduleDefs: TAgentScheduleDef[] = [
  steward({
    key: `planning`,
    id: `sd_6TnydNv`,
    cronExpression: `0 6 * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
  }),
  steward({
    key: `work-cycle`,
    id: `sd_CUOT7Vu`,
    cronExpression: `30 * * * *`,
    timeoutMs: 14_400_000,
    maxConsecutiveErrors: 6,
  }),
  steward({
    key: `coordinator`,
    id: `sd_0HqZFQ_`,
    cronExpression: `0 5 * * *`,
    timeoutMs: 14_400_000,
    maxConsecutiveErrors: 6,
  }),
  steward({
    key: `sensor`,
    id: `sd_lSst6Tq`,
    cronExpression: `40 */2 * * *`,
    timeoutMs: 5_400_000,
    maxConsecutiveErrors: 6,
  }),
  steward({
    key: `observer`,
    id: `sd_e3bURkR`,
    cronExpression: `10 * * * *`,
    timeoutMs: null,
    maxConsecutiveErrors: 5,
  }),
  steward({
    key: `pr-response`,
    id: `sd_EAz_2r5`,
    // Every 15 min. On a multi-round adversary review, the steward's fix waits
    // for the next pr-response cycle before it lands, so a 30-min cadence made
    // each change-request round cost ~50 min and pushed multi-round PRs past the
    // "one new PR per hour" target (the review gate blocks new work-cycle PRs
    // while one is open). 15-min pr-response mirrors the 15-min adversary cadence
    // so a request→fix→re-review round completes fast. `5,20,35,50` is a superset
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
    cronExpression: `12,42 * * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
  }),
  adversary({
    key: `adversary-review`,
    id: `sd_nPDxUUG`,
    // Every 15 min. A steward PR that falls BEHIND (concurrent merge to main)
    // costs one adversary cycle to rebase (rule 2a: update-branch then defer)
    // plus one to review, so at the old 30-min cadence a rebased PR could sit
    // ~60 min before merge — past the "one new PR per hour" throughput target.
    // 15-min cadence halves that. `5,20,35,50` is a superset of the old
    // `20,50`, so the reconciler transition skips no fire; :05/:35 land ~5 min
    // after the :30 work cycle opens a PR, giving fast first-review pickup.
    cronExpression: `5,20,35,50 * * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 3,
  }),
  // ── Executive board (AI Executive Layer SP1) — all disabled until activation ──
  // The CEO strategy cycle runs daily (research + metrics -> strategy); the two
  // board cycles run a few times/day so a decision can open and resolve within a
  // day while the Active Initiative stays frozen. The CTO board cycle runs on the
  // steward agent+sandbox (the CTO seat) but is a distinct schedule from the
  // steward's dev-loop cycles.
  ceo({
    key: `ceo-strategy`,
    id: `sd_ceostr1`,
    cronExpression: `0 4 * * *`,
    timeoutMs: 3_600_000,
    maxConsecutiveErrors: 6,
    enabled: false,
  }),
  ceo({
    key: `ceo-board`,
    id: `sd_ceobrd1`,
    cronExpression: `0 */6 * * *`,
    timeoutMs: 1_800_000,
    maxConsecutiveErrors: 6,
    enabled: false,
  }),
  steward({
    key: `cto-board`,
    id: `sd_ctobrd1`,
    cronExpression: `30 */6 * * *`,
    timeoutMs: 1_800_000,
    maxConsecutiveErrors: 6,
    enabled: false,
  }),
]
