# Autonomous Agent — P2.5 activation + P3 handoff task list

> Spec: `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md`. Written 2026-07-04 as a
> hand-off for the agent watching CI/CD. Steward `ag_lvUbjp_`, org `og_0000001`,
> project `pj_tIly2F1`, body sandbox `sb_i42zg3p`, Civo prod (kube-context `tdsk`,
> namespace `tdsk-production`).

## Status at hand-off

- **P2.5 (self-hosted embeddings)** — code merged; DB schema pushed. Cutover steps remain (Group A0).
- **P3b (self-authored skills)** — code merged + green; `skill_proposals` schema pushed. Activation
  + verify remain (Group A). Plan: this repo's prior plan file; memory `project-agent-p3b-implementation`.
- **P3a (delegation)** — NOT started; full implementation below (Group B).

All prod data steps use the seed-org master key via the prod API helper
(`scratchpad/steward/prodapi.sh`), mirroring `scratchpad/steward/activate-p2-prod.sh`.
Never print secret values.

---

## Group A0 — P2.5 cutover (deploy-gated)

Follow `scratchpad/steward/RUNBOOK-p2.5.md` and run `scratchpad/steward/seed-tei-embeddings.sh`.
In short, in order, so there is no vector-dimension-mismatch window:
1. Pre-deploy: `UPDATE memories SET embedding = NULL;` on the prod DB, and unset `embeddingModel`
   on the Gemini provider `pv_g2SgZDz` (old code degrades to lexical).
2. Ensure the deploy carrying the dim=1024 backend + `tdsk-embeddings` TEI pod is live; confirm the
   `memories.embedding` column is `vector(1024)` (manual `ALTER` fallback in the runbook if the push
   skipped the vector type change).
3. Wait for the `tdsk-embeddings` pod Ready (first boot downloads the model to the PVC).
4. Run `seed-tei-embeddings.sh` (creates the keyless `custom` TEI provider, ensures Gemini unset,
   calls the memories reembed endpoint).
5. Verify a new memory gets a non-null 1024-length embedding; then the 24h soak.

---

## Group A — P3b activation (deploy-gated; `skill_proposals` schema already pushed)

**A1. Seed the curator/auditor schedule (data, prod API).** Create a nightly schedule on the steward
(same shape as the reflection/planning schedules: `type: prompt`, `agentId: ag_lvUbjp_`,
`sandboxId: sb_i42zg3p`, `enabled: true`, `maxConsecutiveErrors: 6`, cron e.g. `0 7 * * *`, POSTed to
`/_/orgs/og_0000001/projects/pj_tIly2F1/schedules`). The prompt must instruct the agent to review each
item under the injected `## Skill proposals awaiting review` section and emit a trailing fenced
` ```tdsk-skill-reviews ``` ` block: `[{ "proposalId", "approve": <bool>, "reason" }]`. The executor
already injects scanned proposals (`buildProposalReviewContext`) and applies decisions server-side
(`persistSkillReviews` → `applySkillReview`, which re-runs the scanner as a hard gate before promoting).

**A2. Extend the work-cycle prompt (data, prod API).** Update the steward's work schedule
(`sd_CUOT7Vu`) prompt so that, after a verified non-trivial task worth repeating, it emits a trailing
` ```tdsk-skills ``` ` block: `[{ "name","description","instructions","tools?","triggerKeywords?","alwaysActive?" }]`.
Caps: ≤3 proposals/run, instructions ≤8000 chars. State that these become PROPOSALS (scanned +
auditor-gated), never active skills directly.

**A3. Verify P3b end-to-end (prod).** After the P3b backend is deployed:
- `GET /_/orgs/og_0000001/skill-proposals` responds (endpoints mounted, `featureGate(skills)` on).
- Trigger one work cycle → a `skill_proposals` row appears (`status=scanned`, or `rejected` with
  `scanResult.findings`).
- Trigger the curator schedule → an approved proposal flips to `status=promoted` with a
  `promotedSkillId`, and the new skill is attached to the steward (`agent_skills`).
- A deliberately malicious proposal (e.g. instructions with `rm -rf /` or "ignore previous
  instructions") is rejected by the scanner and never promoted.

---

## Group B — P3a delegation (new code; mirror the P3b / P2 layering)

**Execution model (decided during recon):** `delegate_task` spawns a **bounded in-pod child coding
process** (`claude -p` / `codex exec` via `SandboxRuntimeConfigs.promptCommand` +
`sbInstance.exec`/`execStreaming` with an exec timeout), NOT a nested `AgentRunner` (pi-mono has no
turn cap). This is the same mechanism as `runCliAgentSchedule` in
`repos/backend/src/services/scheduler/executor.ts`. Depth is naturally bounded (an in-pod CLI cannot
call our `delegate_task`), but thread it anyway for defense. Deliverable (spec §4.5): a first-class
`delegate_task` tool with enforced depth/concurrency caps, a structured result, and a critic.

**B1. Domain** (`repos/domain/src`):
- `types/ai.types.ts`: add `EAgentTool.delegateTask`.
- `types/delegation.types.ts` (new): `TDelegateInput` (`{ task, runtime?, tools?, timeoutMs? }`),
  `TDelegateResult` (`{ success, output, exitCode, critic?: { passed, reason } }`).
- `constants/delegation.ts` (new): `DelegationMaxDepth=1`, `DelegationConcurrencyCap=3`,
  `DelegationDefaultTimeoutMs`, `DelegationCriticMaxRounds=1`, `DelegationOutputMaxChars`.
- Barrel-export all three (`types/index.ts`, `constants/index.ts`).

**B2. Agent package** (`repos/agent/src`):
- `types/delegation.types.ts` (new): `IDelegateProvider { delegate(input: TDelegateInput): Promise<TDelegateResult> }`.
- `tools/tools.ts`: `createDelegateTools(provider, allowedTools?)` exposing `delegate_task` — mirror
  `createSkillTools`. It MUST refuse (return a failed result) when `delegationDepth >= maxDelegationDepth`.
- `types/runner.types.ts`: add `TAgentInitOpts.delegateProvider?`, `delegationDepth?`,
  `maxDelegationDepth?`.
- `runner/runner.ts` `#buildTools`: wire `createDelegateTools` (mirror the skill/memory provider lines).

**B3. Backend** (`repos/backend/src`):
- `utils/agent/delegation.ts` (new): `createDelegateProvider(app, db, orgId, agentId, sandboxConfig, depth)`.
  Resolve the child prompt command from the runtime `promptCommand` template (reuse the helpers in
  `executor.ts`), exec it in the agent's body sandbox with a timeout (`sbInstance.exec`/`execStreaming`),
  capture stdout (tail-capped to `DelegationOutputMaxChars`) + exit code, then run ONE critic pass
  (`DelegationCriticMaxRounds`) grounding success on real signals (exit code, optionally a test run) plus
  a bounded LLM assessment. Enforce `DelegationConcurrencyCap` with a counter in the closure. Pass
  `depth+1` into the child's env so a nested delegate refuses. Return the structured `TDelegateResult`.
- `types/agent.types.ts`: add `delegateProvider?` to `TAgentRuntimeConfig`.
- `utils/agent/resolveAgentConfig.ts`: build `createDelegateProvider(...)` and return it (gated on a
  `delegation` faculty — reuse the `agents` flag or add a `delegation` feature flag; mirror how
  `skillProvider`/`memoryProvider` are gated by `isFeatureEnabled`).

**B4. Tests.** depth-cap refusal; concurrency-cap rejection; critic bounded to
`DelegationCriticMaxRounds`; structured result on success/failure; timeout path. Then `pnpm types` +
`pnpm test` green across domain, agent, backend.

**B5. Activation (data).** Enable `delegate_task` in the `tools` list of any api-brain agent that
should delegate. The runtime-brain steward already delegates via `claude`'s own sub-agents, so this
primarily benefits api-brain agents — note that in the activation.

---

## Group C — optional hardening (noted, not required)

- **Author≠reviewer separation (P3b, multi-agent orgs).** The current design intentionally lets a
  single agent author AND curate its own skills, gated by the auditor-independent re-scan. If a second
  agent ever curates, add a check in `applySkillReview` to defer self-authored proposals to an
  independent approver.

## Verification bar (per CLAUDE.md — "done" means green)

- `pnpm types` + `pnpm test` green for every touched repo.
- New security-sensitive code (delegation exec, any scanner change) adversarially reviewed.
- Prod activation verified with live triggers (A3, and the delegation smoke test for B5).
