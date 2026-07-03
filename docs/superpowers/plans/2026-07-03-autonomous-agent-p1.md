# Autonomous Agent P1 Implementation Plan (Autonomous PR Author + Hardening)

> Spec: `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md` section 11 (P1).
> Predecessor: `docs/superpowers/plans/2026-07-01-autonomous-agent-p0.md` (complete; steward live).
> Written 2026-07-03. The CLI brain (`agents.brain = 'runtime'`, `claude -p` in the body pod via
> subscription OAuth, report → continuity thread) shipped between P0 and this plan and CHANGES the
> spec's P1 wording in one way: the spec assumed the pi-runner brain drives the pod via `shellExec`;
> now the brain IS the in-pod coding CLI, so "the brain picks a task and does the work in its pod"
> collapses to a single `claude -p` coding run. The spec's "per-sandbox promptCommand override with
> autonomy flags" item is already DONE (shipped with the CLI brain).

## Deliverable

An autonomous PR author with no human in the loop: on a work cadence, the steward picks one small
task, implements it on a branch in its pod, pushes, opens a PR, and lands it itself via
`gh pr merge --auto` once a NEW executable CI gate (`pnpm types` + `pnpm test` on `pull_request`)
is green. Git history plus the continuity thread are the memory (pgvector is P2). Merges land on
`main`; production deploys remain the one manual step until P4.

Plus: every remaining known bug from the P0 bring-up list is fixed (Wave A). Hardening is not a
separate effort; it is the first tasks of this plan.

## One-time human seed actions (sanctioned by spec section 7.1; everything else is zero-human)

1. Create a dedicated NON-ADMIN machine account (e.g. `threadedstack-steward`), grant it Write
   (not Admin) on `threadedstack/threadedstack`, and mint the fine-grained PAT FROM THAT ACCOUNT
   with Contents: Read+Write and Pull requests: Read+Write and NOTHING else. Two load-bearing
   security invariants (security review 2026-07-03, verified against GitHub docs):
   - NON-ADMIN is what makes branch protection apply to the agent at all: with
     `enforce_admins: false` (needed so the human owner can keep direct-pushing), an
     admin-owned PAT is EXEMPT from required status checks and could merge red PRs.
     Post-seed check: `gh api repos/threadedstack/threadedstack/collaborators/<bot>/permission`
     must show `write`.
   - The Workflows permission MUST stay OFF: GitHub rejects any push from such a PAT that
     touches `.github/workflows/**`, which is the mitigation for the ci.yml self-edit bypass
     (CODEOWNERS cannot help without required reviews). Wave C verifies this with a test push.
   The token replaces the read-only PAT value on git provider `pv_R_IUg3q`'s secret
   (`sc_hEtV9gK`) via the secrets API (value update only; same provider, same placeholder flow).
2. Approve the two repo-settings mutations (executed via local `gh api` once approved):
   allow auto-merge on the repo, and branch protection on `main` requiring the new CI checks
   (required_status_checks only; `enforce_admins: false` and no required reviews, so direct
   pushes by the repo owner keep working).
3. Commit the code (standing rule: the user runs all commits), including `.github/workflows/ci.yml`.
4. Run `pnpm push` from `repos/database` for the one new column (`schedules.timeout_ms`).
5. Rebuild + push the sandbox image after the Dockerfile/entrypoint changes
   (`cd repos/cli && pnpm cli docker build --context sandbox --arm --cache false`, then push).

No other human action exists in this phase, and none of the above recur.

---

## Wave A: Hardening (all known bugs from the P0/CLI-brain bring-up)

### Task A1: Runner surfaces LLM failures instead of swallowing them into empty turns

Bug (observed live during P0): when the LLM call fails (credit exhaustion, 429, unknown model),
pi-agent completes the turn with an EMPTY assistant message (zero usage) and NO error event; the
schedule run records success and the continuity thread gains a poisoned tail.

- `repos/agent/src/runner/runner.ts`: after each turn, detect the empty-failure signature
  (assistant message with no content parts AND zero output tokens, or an error captured by the
  pi-agent event stream). On detection: emit a `TStreamEvent` error event, do NOT persist the
  empty assistant message, and reject `waitForIdle` (or throw from `runTurn`) so the executor
  records an error run instead of success.
- Executor already classifies thrown errors correctly; no executor change expected. Verify with a
  unit test that a rejected `waitForIdle` produces an error run (exists) and add runner tests for
  the empty-turn signature (mock LLM adapter returning empty completion; assert error event +
  nothing persisted + rejection).
- Verify: `pnpm --filter @tdsk/agent test && pnpm --filter @tdsk/agent types`, backend suite still
  green.

### Task A2: Thread-tail sanitization on runner init (poisoned-thread recovery)

Bug (observed live): a dangling/empty assistant tail in the continuity thread makes every later
run fail with `Cannot continue from message role: assistant`. Current workaround is clearing and
re-setting the schedule's agentId (thread epoch reset), which loses memory.

- `repos/agent/src/runner/runner.ts` (history load path): when building initial state from thread
  messages, drop from the tail: (a) assistant messages with no content parts, (b) a trailing
  assistant message when the pi conversation contract requires the next turn to start from user
  (i.e. sanitize until the tail is a valid continuation point). Log a warn with the dropped count.
  Never mutate the DB; sanitize the in-memory history only.
- Tests: history ending in empty assistant → dropped, run proceeds; history ending in valid
  assistant → trailing assistant handled per the contract (verify against pi-agent's actual
  continuation rule, do not guess it); interior empties dropped without reordering.
- Verify: agent + backend suites and types green.

### Task A3: API-brain orphan-pod leak (pod started inside resolveAgentConfig)

Bug (documented in P0): `resolveAgentConfig` starts the body pod; if anything after that throws
(runner init, LLM config), the caller never learns the podName and the pod leaks until the idle
reaper (~30 min). The CLI-brain path already avoids this via an onPodStart hook; give the api path
the same shape.

- `repos/backend/src/utils/agent/resolveAgentConfig.ts`: accept `opts.onPodStart?: (podName) => void`
  invoked immediately after `startPod` returns. `repos/backend/src/services/scheduler/executor.ts`
  (`runAgentSchedule`): pass the hook to capture instanceId into the outer teardown variable.
  Audit the other resolveAgentConfig callers (SSE endpoint, websocket, oai-compat): where a
  long-lived session owns the pod, leave behavior unchanged; where a failure path can leak, wire
  the same capture + teardown.
- Also have resolveAgentConfig call `sandbox.waitForPodReady(podName, { cloneCheck: true })` after
  startPod, closing the same Pending race on the api path (proven live on the CLI path).
- Tests: executor api-brain test where AgentRunner.run rejects after pod start → stopPod called;
  resolveAgentConfig unit test for hook invocation and readiness wait ordering.

### Task A4: Runtime provider failover in the runner (priority chain actually used)

Bug (P0 list): `agent_providers` carries a priority-ordered chain (ZAI → Anthropic → OpenRouter for
the steward's api brain) but the runner only ever uses the primary.

- `repos/backend/src/utils/agent/resolveAgentConfig.ts`: resolve the FULL provider chain (ordered
  by priority) into `llmConfigs: TLLMAdapterConfig[]` alongside the existing primary `llmConfig`
  (backward compatible).
- `repos/agent/src/runner/runner.ts`: on an LLM-call failure that A1 now surfaces, if more configs
  remain in the chain, log a warn, switch the adapter to the next config, and retry the SAME turn
  once per remaining provider before rejecting. Bound: one attempt per provider per turn, no loops.
- Tests: first provider fails → second succeeds → turn persists exactly once; all fail → A1's
  error path (error event, rejection, nothing persisted).
- Verify: agent + backend suites and types green.

### Task A5: Small-bug sweep (each observed during P0/CLI-brain bring-up)

- `createSecret` with `providerId` does not backfill `provider.secretId` (hit live 2026-07-03;
  required a manual PUT). Fix in `repos/backend/src/endpoints/secrets/createSecret.ts` (or the
  secret service): when the exclusive-arc owner is a provider, update the provider row's
  `secretId` in the same flow. Test both create and the existing dual-ownership path.
- `repos/admin/src/actions/orgs/api/fetchOrgs.ts` per-entry merge never evicts orgs deleted
  server-side (latent stale-state). Evict entries absent from a full (non-paginated) refresh while
  keeping the merge for paginated pages. Test eviction + the original clobber-race regression.
- `repos/integration/src/tier1/sandbox-org-seeding.test.ts` silently skips on 401 (hides real
  auth regressions). Make the 401 path a hard failure with a clear message.
- Quota usage counters read 0 in admin (P0 observation): INVESTIGATE first (is it enforceQuota not
  incrementing, the read endpoint, or the UI selector?), then fix at the root; if the
  investigation proves it is a separate large defect (e.g. schema-level), record the evidence in
  the plan addendum and fix it in this task anyway; nothing is deferred.
- Verify: affected repo suites + types; tier1 rerun at Wave C.

---

## Wave B: The PR author

### Task B1: Sandbox image grows `gh` + pnpm; entrypoint persists push auth + git identity

- `deploy/Dockerfile.sandbox`: install the GitHub CLI (official apt repo) and enable pnpm via
  `corepack enable` (node 22 already present). Keep layers cacheable.
- `deploy/sandbox-entrypoint.sh`: after each successful clone, when a token is present:
  `su -s /bin/bash sandbox -c 'git -C <dir> config http.extraHeader "Authorization: Basic $0"' "$AUTH"`
  so later `git push` from any process in the pod flows through the same egress Basic-swap used by
  the clone (spec section 11). Also set repo-local identity:
  `user.name "ThreadedStack Steward"`, `user.email "steward@threadedstack.app"` (env-overridable
  via `TDSK_GIT_USER_NAME`/`TDSK_GIT_USER_EMAIL` for future instances).
- Note: the extraHeader value contains the PLACEHOLDER, never the real token; `git config --local`
  writes it into `.git/config` inside the pod, which is placeholder-only and pod-lifetime.
- Verify: image builds for arm; a manual pod clone → `git -C /workspace config --get
  http.extraHeader` shows the Basic placeholder; `gh --version` and `pnpm --version` work in-pod.

### Task B2: `GH_TOKEN` env + git placeholder domain scope covers the GitHub API

Today `resolveGitProviderEnv` scopes each git-token placeholder to the repo URL host only
(`github.com`), so `gh` calls to `api.github.com` would be refused by the egress fail-closed rule
(shipped 2026-07-03), and nothing exports a token env var `gh` reads.

- `repos/backend/src/utils/sandbox/resolveGitProviderEnv.ts`:
  (a) honor an explicit `provider.options.allowedDomains` override first (same precedence rule as
  `resolveProviderEnv`), else default to the repo host PLUS its well-known API host for github
  (`api.github.com` when host is `github.com`); other hosts keep repo-host-only.
  (b) for the highest-priority github-brand provider, additionally export `GH_TOKEN` set to the
  SAME placeholder (gh sends it as an Authorization header; the egress swap already handles that).
- Egress: no change; `replaceAuthHeader` already swaps placeholders in Authorization values and
  the domain gate now passes for api.github.com.
- Tests: scoping default (github.com + api.github.com), options override wins, non-github host
  unchanged, GH_TOKEN exported once for the top-priority github provider only.

### Task B3: Per-schedule execution timeout

Coding runs need more than the flat 30-minute `ExecTimeoutMS`.

- `repos/database/src/schemas/schedules.ts`: `timeoutMs` integer, nullable. (`pnpm push` is seed
  action 4.) Domain Schedule model + types updated.
- `repos/backend/src/endpoints/schedules/createSchedule.ts` + `updateSchedule.ts`: accept
  `timeoutMs`, validate integer within [60_000, `MaxScheduleTimeoutMS` = 2h] (new PascalCase
  constant beside `ExecTimeoutMS`).
- `repos/backend/src/services/scheduler/executor.ts`: every timeout race uses
  `schedule.timeoutMs ?? ExecTimeoutMS` (CLI-brain, api-brain, pod-schedule paths).
- Admin `ScheduleDrawer`: optional "Timeout (minutes)" number input mapped to timeoutMs.
- Tests: endpoint validation bounds, executor honors the override on all three paths, drawer
  payload.

### Task B4: The CI gate (`.github/workflows/ci.yml`)

- New workflow: on `pull_request` (all branches into main): checkout, pnpm/action-setup, node 22
  with pnpm cache, `pnpm install --frozen-lockfile`, job `types` (`pnpm types`) and job `test`
  (`pnpm test`) as two named checks (`ci/types`, `ci/test`) so branch protection can require both.
  Concurrency group per-PR with cancel-in-progress. No integration tests in CI (they need live
  K8s; the unit + type gate is the executable invariant for P1, integration stays in the local
  loop and P4 widens the gate).
- Lands via user commit (seed action 3). Verify on the steward's first PR, and before that by
  `gh workflow list` after merge.

### Task B5: Repo settings (auto-merge + branch protection) via one-time approved `gh api`

- `gh api -X PATCH repos/threadedstack/threadedstack -f allow_auto_merge=true`
- `gh api -X PUT repos/threadedstack/threadedstack/branches/main/protection` requiring status
  checks `ci/types` + `ci/test` (strict), `enforce_admins: false`, no required reviews, no
  restrictions. Owner direct-push keeps working; PRs (the agent's path) require green CI.
- Run locally with the user's gh auth AFTER explicit approval (seed action 2). Record the exact
  commands + responses in the run log.

### Task B6: Steward work cadence (pure data, created via existing CRUD)

- Update git provider secret `sc_hEtV9gK` value to the write-scoped PAT (seed action 1; value-only
  update via the secrets API, never echoed).
- New schedule on the steward agent (same body sandbox `sb_h41yzok`, same continuity thread rules;
  it gets its OWN thread since threads are per-schedule): cron `30 */4 * * *`, `timeoutMs`
  3_600_000, prompt (work cycle):
  1. `gh pr list --author "@me" --state open`: if an open steward PR exists, inspect its CI
     (`gh pr checks`); fix failures on that branch (commit + push) OR enable auto-merge if green;
     do NOT start new work while one is open.
  2. Otherwise pick exactly ONE small, high-confidence task: first from `TASKS.md`, else from
     anomalies in your own recent hourly reports. Scope: something completable in one run.
  3. Branch `steward/<short-slug>`, implement, run the narrowest relevant checks available in-pod
     (`pnpm --filter <repo> types` at minimum), commit with a conventional message, push.
  4. `gh pr create` (title, body with rationale + verification notes), then
     `gh pr merge --auto --squash`.
  5. Report: what you picked and why, the PR URL, CI expectation, and anything you noticed.
  Constraints: never push to main; never touch `.github/workflows/`, `deploy/`, or secrets; one PR
  per cycle; if nothing qualifies, say so and stop (a null cycle is a valid cycle).
- The hourly observer schedule keeps running unchanged (read-only PAT semantics no longer apply;
  the observer prompt already forbids writes and the soul reinforces it; the WRITE authority is
  the same token, the constraint is behavioral + CI-gated + branch-protected, per spec section 8's
  authority-boundary model; main cannot be pushed to directly by the agent thanks to B5's
  protection applying to everyone but the owner).

### Task B7: Escalation guard for the work cycle (bounded, no human wait)

- `maxConsecutiveErrors` already disables a failing schedule (existing behavior, verified in P0).
  Set the work schedule's `maxConsecutiveErrors: 3`. The hourly observer reports a disabled work
  schedule as an anomaly (its prompt already flags anomalies; verify report #N+1 mentions it in
  the bring-up test by temporarily pointing the work schedule at a broken sandbox... NO: never
  break live config for testing; instead unit-test the disable path, already covered, and rely on
  the observer's existing anomaly section).

---

## Wave C: Bring-up + verification (all gates must pass before "done")

1. All Wave A/B unit + type verification green per-task (each task's own gate).
2. User seed actions 1-5 executed.
3. Manual pod check (B1 verify), then trigger the work schedule once manually. Observe the full
   loop: branch pushed → PR opened → ci.yml runs → checks green → auto-merge lands it. The first
   task should be trivially safe (seed `TASKS.md` with one, e.g. a typo/doc fix) so the loop is
   validated on a low-stakes change.
4. Full integration: `cd repos/integration && pnpm test` green (127 files baseline + any new).
5. Both cadences autonomous for 24h: hourly reports keep cross-referencing; at least one
   unattended work cycle produces (or correctly declines to produce) a PR.
6. Memory checkpoint + spec/plan status updates.

## Explicitly in-scope but sequenced behind this phase (spec, unchanged)

P2 pgvector memory, P3 delegation/self-improvement, P4 delivery spine (production deploys,
migrations, the manual-deploy removal), P5 full ownership. Nothing in P1 blocks on them; nothing
here is deferred INTO them beyond what the spec already sequences.

## Self-review notes (plan author, 2026-07-03)

- The CLI brain replaced the spec's runner+shellExec model for the steward; A1-A4 still fix the
  runner because the api brain remains a first-class platform path (other orgs' agents use it),
  not because the steward needs it. No bespoke steward code anywhere in this plan; the steward's
  P1 delta is 100% data (a secret value, a schedule row, repo settings) plus generic platform
  capabilities (gh in image, GH_TOKEN env, timeout column).
- Gate framing (security review 2026-07-03): the PR CI gate is a LIVENESS gate, not an integrity
  boundary — `pnpm types`/`pnpm test` execute PR-branch-controlled files (package.json scripts,
  configs, tests), so a malicious writer could neuter its own checks. P1's protection against
  that class is the non-admin bot + Workflows-permission-off invariants (seed action 1) plus the
  steward's non-adversarial soul; P4's trusted-ref required workflows upgrade the gate to an
  integrity boundary. ci.yml runs with `permissions: contents: read` so a malicious PR cannot use
  the job token to write.
- Biggest risks: (1) gh's exact Authorization scheme vs the egress swap: verified in design
  (header-value placeholder swap is scheme-agnostic) but MUST be live-tested at Wave C step 3
  before trusting auto-merge; (2) claude -p run length vs timeout: mitigated by B3 + the
  one-small-task prompt constraint; (3) a wrong first PR: mitigated by CI gate + seeded trivial
  first task + branch protection.
- ToS note (recorded 2026-07-03, user-acknowledged): subscription OAuth powering autonomous runs
  is a documented gray zone; if Anthropic guidance changes, the brain swaps back to an API-key
  provider by flipping the sandbox provider link, one data change, zero code.
