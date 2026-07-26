# Skills

> **Last Updated**: July 2026

## Table of Contents

1. [What are Skills?](#1-what-are-skills)
2. [Architecture Overview](#2-architecture-overview)
3. [Key Concepts](#3-key-concepts)
4. [Managing Skills via the Admin API](#4-managing-skills-via-the-admin-api)
5. [Attaching/Detaching Skills to Agents](#5-attachingdetaching-skills-to-agents)
6. [Sandbox-Attached Skills](#6-sandbox-attached-skills)
7. [Skill Activation](#7-skill-activation)
8. [Self-Authored Skills: Proposals and Review](#8-self-authored-skills-proposals-and-review)
9. [The Security Scan](#9-the-security-scan)
10. [Limits and Constraints](#10-limits-and-constraints)
11. [Authentication and Permissions](#11-authentication-and-permissions)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What are Skills?

A Skill is a reusable, org-scoped bundle of instructions (and an optional set of tools) that
an agent can pick up at runtime — a packaged capability rather than something re-typed into
every prompt. A Skill can be attached directly to an agent (injected into its prompt
context) or to a sandbox (materialized as a skill file for third-party AI tools like Claude
Code, Codex, or OpenCode to discover natively).

```mermaid
flowchart LR
  subgraph Org["Organization"]
    SK["Skill: name, instructions, tools[], triggerKeywords[], alwaysActive"]
  end
  SK -->|"attachSkill"| AG["Agent (in-prompt injection)"]
  SK -->|"sandbox update: skills[]"| SB["Sandbox (mounted skill files)"]
```

**When to use Skills:**
- Package a recurring set of instructions ("how to triage this project's bug reports") once
  and reuse it across every agent run that needs it, instead of hard-coding it into every
  prompt
- Give an agent conditional capability that only activates when relevant
  (`triggerKeywords`), keeping the default prompt context small
- Extend what a sandbox's native AI tool (Claude Code, etc.) knows about a project by
  mounting skill files it discovers on its own

**When not to use Skills:** a Skill's `instructions` field is static text — for something
that needs live, queryable data (a leads table, a task backlog), use a
[Collection](./collections.md) with `contextSources` instead of hard-coding a snapshot into
a Skill.

---

## 2. Architecture Overview

```mermaid
flowchart LR
  ADMIN["Admin API caller"] -->|"CRUD"| SVC["skillService"]
  SVC --> DB[("skills table (org-scoped)")]

  ADMIN -->|"attachSkill / detachSkill"| JOIN["agent_skills junction"]
  ADMIN -->|"sandbox update: skills[]"| SBJOIN["sandbox_skills junction (priority-ordered)"]

  RUN["Agent run"] -->|"skill.listForAgent(agentId)"| JOIN
  RUN -->|"resolveActiveSkills(skills, prompt)"| CTX["Prompt context injection"]

  BOOT["Sandbox pod boot"] -->|"resolveSkillFiles(runtime, sandboxSkillLinks)"| MOUNT["Mounted skill files (runtime-specific path)"]
  SBJOIN --> MOUNT

  AGENT["Agent (authorSkill tool)"] -->|"authorSkillProposal"| SCAN["Deterministic security scan"]
  SCAN --> PROP[("skill_proposals table")]
  REVIEWER["Human or auditor agent"] -->|"reviewSkillProposal"| PROP
  PROP -->|"approve: re-scan + promote"| DB
```

Two independent activation paths share the same `skills` table but attach through different
junctions and reach the model differently:

- **Agent-attached** (`agent_skills`): loaded via `skill.listForAgent(agentId)` on every run,
  then filtered down to the skills actually relevant to the current prompt and injected as
  extra prompt text — see [§7](#7-skill-activation).
- **Sandbox-attached** (`sandbox_skills`): resolved once at pod boot into real files mounted
  into the pod at a runtime-specific path, so a third-party AI tool running in the sandbox
  discovers them the same way it would discover any other project file — no prompt injection
  involved.

---

## 3. Key Concepts

### Skill

An org-scoped, reusable capability: `name`, `description`, `instructions` (all required
text), plus `triggerKeywords: string[]` and `tools: string[]` (both default `[]`) and
`alwaysActive: boolean` (default `false`). Skills carry no project scope of their own — they
live at the org level and are attached to individual agents or sandboxes as needed.

### Agent-Attached Skill

A skill linked to a specific agent via the `agent_skills` junction (`attachSkill`/
`detachSkill`). Every agent run loads the agent's full attached-skill list, then activates
the subset relevant to that turn's prompt — see [§7](#7-skill-activation).

### Sandbox-Attached Skill

A skill linked to a sandbox (optionally scoped to one project within it) via the
`sandbox_skills` junction, ordered by `priority`. This is configured through the Sandbox
config API's `skills` array (`POST`/`PUT .../sandboxes`, not part of this feature's own
CRUD surface) — see [§6](#6-sandbox-attached-skills).

### Skill Proposal

A self-authored skill pending review before it becomes an active `skills` row. Authored
in-process by an agent's own `authorSkill` tool (or captured from a runtime-brain review
block) — there is no HTTP create route for proposals. Lifecycle: `pending` → (scan) →
`scanned` → (review) → `promoted` | `rejected`. See [§8](#8-self-authored-skills-proposals-and-review).

---

## 4. Managing Skills via the Admin API

Base path: `/_/orgs/<org-id>/skills` — **org-scoped**, no `projectId` in the path.

### Create a Skill

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/skills" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bug Triage",
    "description": "How to triage and label incoming bug reports for this org",
    "instructions": "When a new bug report thread starts: 1) reproduce if possible, 2) label severity, 3) assign an owner from CODEOWNERS.",
    "triggerKeywords": ["bug", "crash", "regression"],
    "tools": ["readFile", "webSearch"],
    "alwaysActive": false
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "sk_a1b2c3d4e5",
    "orgId": "org-123",
    "name": "Bug Triage",
    "description": "How to triage and label incoming bug reports for this org",
    "instructions": "When a new bug report thread starts: ...",
    "triggerKeywords": ["bug", "crash", "regression"],
    "tools": ["readFile", "webSearch"],
    "alwaysActive": false,
    "createdAt": "2026-07-26T06:50:00.000Z",
    "updatedAt": "2026-07-26T06:50:00.000Z"
  }
}
```

### Skill Fields

| Field | Required | Default | Description |
|-------|----------|---------|--------------|
| `name` | Yes | — | Display name |
| `instructions` | Yes | — | Text injected into the prompt (agent-attached) or written into the mounted skill file (sandbox-attached) |
| `description` | No | `""` | Human-readable purpose |
| `triggerKeywords` | No | `[]` | Case-insensitive substring match against the prompt activates the skill |
| `tools` | No | `[]` | Agent tool names this skill's activation adds to the run's tool set |
| `alwaysActive` | No | `false` | Skips the `triggerKeywords` check — always active on every agent-attached run |

### List / Get / Update / Delete

```bash
# List an org's skills
GET /_/orgs/<org-id>/skills

# Get one skill
GET /_/orgs/<org-id>/skills/sk_a1b2c3d4e5

# Update (only provided fields change; PUT, not PATCH)
PUT /_/orgs/<org-id>/skills/sk_a1b2c3d4e5
{ "alwaysActive": true }

# Delete (cascades to agent_skills and sandbox_skills links)
DELETE /_/orgs/<org-id>/skills/sk_a1b2c3d4e5
```

Deleting a skill removes it from every agent and sandbox it was attached to via a
foreign-key cascade — there is no separate "detach everywhere first" step.

---

## 5. Attaching/Detaching Skills to Agents

```bash
# Attach
POST   /_/orgs/<org-id>/skills/<skill-id>/agents/<agent-id>

# Detach
DELETE /_/orgs/<org-id>/skills/<skill-id>/agents/<agent-id>
```

**Response (201 Created / 200 OK):**
```json
{ "data": { "skillId": "sk_a1b2c3d4e5", "agentId": "agt_f6g7h8i9j0" } }
```

Both endpoints validate that the skill and the agent belong to the same org before writing
the `agent_skills` link — attaching a skill to an agent in a different org returns **404**,
not 403. Attaching an already-attached skill is a no-op (the junction has a unique
`(agentId, skillId)` constraint); detaching a skill that was never attached is also a no-op.

---

## 6. Sandbox-Attached Skills

Sandbox-attached skills are set through the **Sandbox config API**, not a dedicated Skills
endpoint — pass a `skills` array on sandbox create/update:

```bash
curl -X PUT \
  "https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/sandboxes/<sandbox-id>" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{ "skills": [{ "id": "sk_a1b2c3d4e5" }, { "id": "sk_k1l2m3n4o5" }] }'
```

Array order sets `priority` (first entry = highest priority) — priority determines file
ordering when multiple skills are mounted into the same runtime path. Passing `skills`
**replaces** the full set for that sandbox/project scope in one transaction (delete-then-
insert), it does not merge with the existing set. Omitting `id.projectId` on an individual
entry scopes that link to the sandbox at the org level (visible from every project the
sandbox is linked to); setting it scopes the link to that one project only.

At pod boot, every linked skill's `instructions` is written to a file at a runtime-specific
path (e.g. Claude Code's skills directory) so the sandbox's native AI tool discovers it like
any other project file — this path never touches an agent's prompt context.

---

## 7. Skill Activation

For an **agent-attached** run, every attached skill is loaded, then filtered per-turn:

```typescript
// resolveActiveSkills(skills, prompt)
active = skills.filter(skill =>
  skill.alwaysActive || skill.triggerKeywords.some(kw => prompt.toLowerCase().includes(kw.toLowerCase()))
)
```

Active skills' `instructions` are concatenated under a `# Active Skills` heading
(`## <name>\n<instructions>` per skill) and appended to the prompt context; their `tools`
arrays are merged (deduped) into the tools available for that turn. A skill with no
`triggerKeywords` and `alwaysActive: false` never activates — it is attached but effectively
dormant until either is set.

---

## 8. Self-Authored Skills: Proposals and Review

Base path: `/_/orgs/<org-id>/skill-proposals` — org-scoped, gated by the `skills` feature
flag. **There is no `POST` create route**: proposals are authored in-process by an agent's
own tool call (or captured from a runtime-brain review block), never via HTTP.

### List / Get Proposals

```bash
GET /_/orgs/<org-id>/skill-proposals
GET /_/orgs/<org-id>/skill-proposals?status=scanned&agentId=agt_f6g7h8i9j0
GET /_/orgs/<org-id>/skill-proposals/pr_p6q7r8s9t0
```

**Response shape:**
```json
{
  "data": {
    "id": "pr_p6q7r8s9t0",
    "orgId": "org-123",
    "agentId": "agt_f6g7h8i9j0",
    "name": "Auto-Label PRs",
    "description": "...",
    "instructions": "...",
    "tools": [],
    "triggerKeywords": ["pull request", "pr review"],
    "alwaysActive": false,
    "status": "scanned",
    "scanResult": { "passed": true, "findings": [] },
    "auditVerdict": null,
    "promotedSkillId": null,
    "reason": null,
    "meta": { "threadId": "th_...", "model": "claude-sonnet-5" }
  }
}
```

`status` is one of `pending` (just authored, scan not yet run), `scanned` (passed the scan,
awaiting review), `rejected` (failed the scan or the reviewer vetoed it), or `promoted`
(approved and now an active skill). `pending` should not normally be observed via this API —
the scan runs synchronously at authoring time.

### Review a Proposal (Approve/Reject)

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/skill-proposals/pr_p6q7r8s9t0/review" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{ "approve": true, "reason": "Instructions look safe and scoped, tools list is empty" }'
```

A proposal already `promoted` or `rejected` is terminal — reviewing it again returns
**404** (`Skill proposal not found or not actionable`). On **reject**, the proposal is
marked `rejected` with the given `reason`. On **approve**, the deterministic security scan
is **re-run as a hard gate** before promotion: if the proposal no longer passes (e.g. its
content changed between authoring and review), it is rejected regardless of the approve
verdict, with a reason naming the re-scan failure. Only a scan that passes on both the
original run and the re-run results in promotion — which creates an active `skills` row,
attaches it to the proposing agent, and marks the proposal `promoted` with
`promotedSkillId` set.

---

## 9. The Security Scan

Skills feed straight into the agent prompt and can activate gated tools, so a poisoned or
self-authored skill is a direct prompt-injection / privilege-escalation vector. The scan
(`scanSkillProposal`) is deterministic, pattern-based, and **fail-closed** — any finding
blocks the proposal regardless of a human or auditor's semantic verdict, and it runs twice:
once at authoring time, once again at promotion time (see [§8](#8-self-authored-skills-proposals-and-review)).

A proposal's `tools` list is checked against a fixed allowlist of tools a self-authored
skill may request without escalation (file/read/search/exec/memory/artifact/skill-viewing
tools). `delegateTask` (spawning child processes) and `authorSkill` itself (recursive skill
authoring) are **deliberately excluded** — a self-authored skill can never grant itself
delegation or the ability to author further skills; widening that list requires a human
code change, not a review approval.

---

## 10. Limits and Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| Skill scope | Org | Skills have no project scope of their own |
| Agent attach uniqueness | `(agentId, skillId)` unique | Re-attaching is a no-op, not an error |
| Sandbox attach uniqueness | `(sandboxId, skillId, projectId)` or `(sandboxId, skillId)` when org-scoped | Two unique indexes, gated on whether `projectId` is null |
| Skill-proposal creation | No HTTP route | In-process only (agent tool / runtime-brain capture) |
| Skill-proposal review | Reversible only while `pending`/`scanned` | `promoted`/`rejected` are terminal states |
| Security scan | Fail-closed, runs twice | Authoring time + promotion time; a passing verdict at authoring does not guarantee promotion |
| Excluded proposal tools | `delegateTask`, `authorSkill` | Hard-excluded from the safe-tools allowlist, not configurable per org |
| Feature gate | `skills` flag must be enabled | 404 on the whole route group when disabled (both `/skills` and `/skill-proposals`) |

---

## 11. Authentication and Permissions

### Permission Matrix

| Operation | Minimum Role | Permission |
|-----------|--------------|------------|
| List/get skills | member | `skill:read` |
| Create a skill | member | `skill:create` |
| Update a skill | member | `skill:update` |
| Delete a skill | admin | `skill:delete` |
| Attach/detach a skill to an agent | member | `agent:update` |
| List/get skill proposals | member | `skillProposal:read` |
| Review (approve/reject) a proposal | admin | `skillProposal:update` |

Note that attach/detach checks `agent:update`, not a skill permission — modifying an agent's
skill set is treated as modifying the agent. All Skills and Skill Proposals routes
additionally require the `skills` feature flag to be enabled for the org.

### Authentication Methods

```bash
# JWT (browser/Neon Auth login)
curl -H "Authorization: Bearer eyJhbGciOi..." \
  https://local.threadedstack.app/_/orgs/<org-id>/skills

# API Key
curl -H "Authorization: Bearer tdsk_your_api_key_here" \
  https://local.threadedstack.app/_/orgs/<org-id>/skills
```

---

## 12. Troubleshooting

### "Skill not found" (404)

**Checks:**
1. Verify the `skillId` is exact — skill IDs are the `sk_` prefix plus a 10-character
   nanoid.
2. Verify you are targeting the correct `orgId` — a skill created under one org is invisible
   from another, even with a correct skill ID.

### 404 on the entire `/skills` or `/skill-proposals` route group

**Symptom:** every Skills endpoint returns 404, including `GET .../skills`.

**Checks:**
1. Confirm the `skills` feature flag is enabled for this deployment
   (`repos/domain/src/constants/featureFlags.ts`) — the feature gate returns a blanket 404
   for the whole route group when it is off, which looks identical to "route doesn't exist."

### A skill is attached but never activates

**Checks:**
1. `GET .../skills/<id>` and check `alwaysActive` — if `false`, the skill only activates
   when `triggerKeywords` case-insensitively substring-matches the prompt.
2. Confirm the skill is actually attached to the agent making the run (`agent_skills`), not
   just present in the org's skill list.
3. For a sandbox-attached skill expected to show up as a file: confirm it is linked via
   `sandbox_skills` (set through the Sandbox config API's `skills` array, not the Skills
   API), and that the sandbox's runtime has a configured skill file path
   (`RuntimeSkillPathMap`) — not every runtime supports mounted skill files.

### 404 on skill-proposal review: "Skill proposal not found or not actionable"

**Checks:**
1. Confirm the proposal's current `status` via `GET .../skill-proposals/<id>` — `promoted`
   and `rejected` are terminal; a proposal in either state cannot be reviewed again.
2. Confirm the `orgId` in the URL matches the proposal's `orgId`.

### A proposal I approved still ended up `rejected`

**Checks:**
1. This is expected behavior, not a bug — approval re-runs the security scan as a hard gate.
   Check the proposal's `reason` field for `Re-scan failed at promotion: ...` and the
   `scanResult.findings` array for the specific pattern(s) that tripped it.
2. The proposal's content (instructions/tools) must be identical to what passed the original
   authoring-time scan; if it was edited between authoring and review through any path other
   than the standard flow, the re-scan can catch something the first pass didn't.
