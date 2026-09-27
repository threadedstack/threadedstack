# Autonomous Agent — Self-Ownership & Ops Autonomy (Phase 4)

> Follows `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md` (P0–P3).
> Written 2026-07-04. Steward `ag_lvUbjp_`, org `og_0000001`, Civo prod.

## The gap this closes

The steward today is a well-behaved **junior contributor working a ticket queue someone
else fills**. It clones `main`, picks a task from `TASKS.md`, opens a `steward/*` PR, and
lets CI-gated auto-merge land it. Real ownership — noticing its pipeline is broken, fixing
it, and confirming the fix worked in prod — it cannot do. Every high-value intervention in
the 2026-07-04 sessions had to be human-driven because it fell in a layer the agent is
**forbidden from** or **blind to**:

| What needed doing | Why the steward couldn't |
|---|---|
| amd64-only builds, deploy-marker fix, CI backend-deps | its prompt bans `.github/workflows/` + `deploy/` |
| sandbox-config / setupScript / node scaling | no ops hands (no prod API, no kubectl) |
| noticing deploys were failing | no signal→backlog loop; drains a static `TASKS.md` |
| confirming setupScript installed deps in a live pod | no prod-observability / verify loop |
| the backgrounding / empty-run / corepack bugs | blind to the executor+sandbox layer that *runs* it |

The unifying principle: **the agent can improve the app, but not the machine it runs on,
and it cannot observe its own operation.** Phase 4 gives it graduated authority over its own
infrastructure and operations, each faculty gated in proportion to its blast radius.

## Safety model (cross-cutting, non-negotiable)

Every faculty below obeys the same rules, mirroring the proven P3b (skill proposals) and
P3a (delegation) patterns:

1. **Read-only first.** Sensing/observation faculties ship before any new write authority.
2. **Blast-radius-proportional gates.** App code → existing CI auto-merge. Ops actions →
   allowlist + dry-run + audit + admin veto. Infra (`workflows/`/`deploy/`) → human approval
   or staging-canary-then-prod. Nothing destructive is ever a single unreviewed step.
3. **Reversibility is mandatory.** No write faculty ships without its rollback path.
4. **Typed, allowlisted interfaces, never raw shells.** Ops = a fixed set of parameterized
   actions (like the egress/injection model), not `kubectl exec` or arbitrary prod SQL.
5. **Everything is audited + human-vetoable in admin**, exactly like skill proposals.
6. **The agent proposes; a gate promotes.** Authority to *act* on high-blast changes stays
   server-side/human-side; the agent recommends with evidence + a patch.

## Sequenced phases

Ordered by dependency and safety: build the eyes and the safety net **before** the hands,
and the hands **before** lifting the infra ban.

### P4a — Sense: system signals → self-authored backlog *(read-only, ships first)*

**Goal:** the steward discovers its own work from live evidence instead of draining a
human-written list.

**Mechanism:** extend the observer into a **sensor cycle** (data schedule + a read-only
backend faculty) that pulls: `gh` CI/deploy run history, the `production` marker vs `main`,
`/health` + `/_/health`, recent `schedule_runs` outcomes (its *own* run failures/timeouts),
and error-log summaries. It converts anomalies into **proposed** backlog items (the same
proposal→scan→review shape as P3b skills) that a normal work cycle then picks up. Feeding its
own `schedule_runs` outcomes in is what finally surfaces runtime bugs (empty runs, timeouts)
as work.

**Rails:** purely read-only; output is *proposed tasks*, already downstream-gated by CI.

**Done:** a deliberately-broken deploy or a slow-CI signal appears as a prioritized proposed
task within one sensor cycle, with the evidence cited.

### P4b — Escalate: an actionable channel with teeth *(cheap, bridges the gated period)*

**Goal:** while ops/infra authority is still gated, make "I can't do X, here's the fix"
*actionable* instead of dying in a memory note.

**Mechanism:** an `escalate` faculty that opens a structured, tracked request (GitHub issue
tagged for human + optional admin approval UI) carrying the problem, the evidence, and a
**proposed patch/diff**. Resolution status flows back into memory so it doesn't re-escalate.

**Rails:** an escalation is a *request*, not an action; the teeth are a human/privileged
approver, tracked to closure.

**Done:** an out-of-grant need becomes a tracked issue with an attached patch a human can
approve in one step; the steward stops re-raising it once resolved.

### P4c — Verify: close the prod feedback loop *(safety net; precedes any write authority)*

**Goal:** confirm a merged change actually did what it intended in prod, and self-remediate
if not.

**Mechanism:** a post-merge **verify step** (in `scheduler/executor.ts`, after deploy) that
runs the change's declared success probe (health checks, a targeted assertion, CI-green-on-
main). On regression it opens a **revert PR** (revert-as-new-commit via `gh`, never
`git revert`/history rewrite) and escalates (P4b).

**Rails:** verification is read-only; remediation is still a CI-gated PR. This *must* precede
P4d/P4e so the agent can catch its own mistakes before it has bigger hands.

**Done:** a knowingly-bad change is detected post-deploy and a revert PR opens automatically.

### P4d — Operate: scoped, allowlisted ops hands *(gated writes)*

**Goal:** give it operator abilities for the things humans did manually this session —
without raw prod access.

**Mechanism:** a fixed **allowlist of parameterized ops actions** exposed as agent tools,
backed by the existing sandbox service / k8s client / prod services. Read tier (pod status,
logs, deploy state, quota/usage). Write tier (trigger a redeploy, restart a deployment, apply
a **reviewed** sandbox-config diff) — each with dry-run + audit + admin veto. Never raw
`kubectl exec` or arbitrary SQL.

**Rails:** allowlist + dry-run + audit log + admin veto (P3b pattern); destructive actions
require approval.

**Done:** the steward can, end-to-end and audited, diagnose a failing pod and apply an
allowlisted remediation that a human could have done — with a human able to veto.

### P4e — Own its infra: lift the ban, replace it with a gate *(highest blast radius, last)*

**Goal:** let it fix its own CI/CD and deploy config — the class of work it's currently
fenced out of.

**Mechanism:** relax the HARD CONSTRAINT ("never modify `.github/workflows/`, `deploy/`")
to a **gated path**: infra changes ride `steward/infra-*` branches that require a stronger
gate than app PRs — mandatory human approval and/or a staging deploy + P4c verify before
prod. Secrets/credentials stay absolutely off-limits.

**Rails:** the strongest gate in the system, because a bad infra change breaks the deploy
that would ship its own fix. Depends on P4a (to know infra needs fixing), P4c (to verify
infra changes), P4d (to observe them).

**Done:** the amd64/deploy-marker class of fix is one the steward can author, gate, verify,
and land itself.

### P4f — Scale: prove delegation for cross-repo units *(last)*

**Goal:** take on multi-file, cross-repo initiatives (like the P4 work itself), not just
single-PR tickets.

**Mechanism:** validate P3a `delegate_task` at scale — a coordinator cycle that decomposes an
initiative into bounded child tasks, each its own gated PR, reassembled. Depends on delegation
being proven and on P4a–P4e.

**Done:** the steward completes a named multi-PR initiative from a single roadmap goal with
no human orchestration.

## Ordering rationale

```
P4a Sense ──┬─► P4c Verify ──► P4d Operate ──► P4e Own-infra ──► P4f Scale
            └─► P4b Escalate (bridges the gated period, cheap, early)
```

Eyes (P4a) and a safety net (P4c) come before hands (P4d); hands come before lifting the
infra ban (P4e). Escalation (P4b) ships early so the human-in-loop period is productive.
Runtime-bug fixes need no new phase — they're app code the agent already may touch, surfaced
by P4a and made safe by P4c.

## Verification bar (per CLAUDE.md — "done" means green + proven in prod)

- `pnpm types` + `pnpm test` green for every touched repo.
- Every new write faculty demonstrated with its rollback exercised.
- Each phase proven with a live trigger (a real signal → proposal, a real escalation, a real
  detected regression → revert), not just unit tests.
