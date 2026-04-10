---
name: runner
description: "Pick and implement tasks from TASKS.md with implementation planning, unit tests, and integration tests. Use when asked to work on tasks, pick a task, or work from the task list. Do NOT use for TODOs — only for TASKS.md items."
---

Execute tasks from `TASKS.md`. Optional arguments: $ARGUMENTS

## Workflow

### Step 1: Read and Analyze TASKS.md

Read `TASKS.md` in the project root. Parse all tasks, noting:
- **Priority**: P0 (broken) > P1 (UX blocker) > P2 (polish) > P3 (new feature) > P4 (refactor)
- **Status**: Skip tasks marked `[IN PROGRESS]`
- **Repo scope**: Which sub-repos each task touches
- **Dependencies**: Tasks that depend on or relate to other tasks

### Step 2: Select Tasks

If `$ARGUMENTS` specifies task(s), use those. Otherwise:
1. Present the available tasks grouped by repo and priority
2. Recommend a selection — prefer:
   - Higher priority (P0 > P1 > P2 > ...)
   - Related tasks that can be batched (same repo, same component, shared code changes)
   - Tasks with clear, well-defined fixes over ambiguous ones
3. Ask the user which task(s) to implement

**Batching rules**:
- Group tasks that touch the same files or components
- Group tasks where one is a prerequisite for another
- Do NOT batch unrelated tasks across different repos unless they share a dependency change

### Step 3: Mark Tasks In Progress

**MANDATORY — do this IMMEDIATELY after task selection, BEFORE any other work.**

Edit `TASKS.md` NOW to change the selected task header from its current state to include `[IN PROGRESS]`:
```
### [IN PROGRESS][P3] Task title here
```

This prevents other agents from picking up the same tasks. **Do NOT proceed to Step 4 until the `[IN PROGRESS]` marker is written to TASKS.md.** Verify the edit was applied by re-reading the modified line.

### Step 4: Load Relevant Skills

Before planning, load the skill file for every sub-repo the selected tasks touch:
- Working on admin? → Load `.claude/skills/admin/SKILL.md`
- Working on backend? → Load `.claude/skills/backend/SKILL.md`
- Working on domain? → Load `.claude/skills/domain/SKILL.md`
- (etc. — see CLAUDE.md for full skill list)

### Step 5: Plan the Implementation

Use `EnterPlanMode` to create an implementation plan covering:

1. **Affected files** — Every file to create, modify, or delete, across all sub-repos
2. **Cross-repo impact analysis** — This is a mono-repo. Changes to `domain/` types affect every consumer. Changes to `database/` schemas affect backend + proxy. Trace all dependency chains.
3. **Implementation steps** — Ordered sequence respecting build dependencies:
   - `domain` → `database` → `logger` → `backend`/`proxy`/`admin`/`agent`/`tsa`
4. **Unit tests** — Co-located test files (`foo.test.ts`) for every changed module. Follow `gen-test` skill conventions.
5. **Integration tests** — Tests in `repos/integration/` that validate the changes against live K8s services. These prevent regressions and MUST be included.
6. **Type safety** — Plan to run `pnpm types` to catch cross-repo type errors

### Step 6: Implement

After plan approval, execute the implementation:
- Follow the plan step by step
- Use sub-agents for parallel work across independent repos
- Run unit tests per repo as you go: `pnpm --filter @tdsk/<repo> test`
- Do NOT skip tests or leave them for later

### Step 7: Verify

Before reporting completion:
1. **Unit tests pass**: `pnpm --filter @tdsk/<repo> test` for each affected repo
2. **Type checks pass**: `pnpm types` (or per-repo `cd repos/<repo> && pnpm types`)
3. **Integration tests pass**: Run relevant integration tests against live K8s
4. **No regressions**: Existing tests in affected repos still pass

### Step 8: Validate and Get User Approval

Before presenting results to the user, invoke the `task-validator` skill:

1. Run `/task-validate "<task title>"` to produce a validation report
2. Review the validation report:
   - If **PASS**: proceed to step 3
   - If **FAIL**: address the failing items first, then re-run validation
3. Present BOTH the Step 7 verification results AND the validation report to the user
4. List the task(s) you propose to remove
5. Ask the user: "These tasks are validated and verified. Should I remove them from TASKS.md?"
6. Only after the user confirms → **immediately** remove the entire task section (header + all sub-bullets/description) from TASKS.md using the Edit tool. **Do NOT end the conversation without completing this removal.**
7. After removal, re-read TASKS.md to verify the task entry is gone
8. If the user says no or wants changes → keep the `[IN PROGRESS]` marker and address feedback

**CRITICAL**: NEVER remove a task from TASKS.md without explicit user approval.
**CRITICAL**: Once the user approves removal, you MUST remove the task from TASKS.md before doing anything else. This is not optional.

## Key Rules

- **ALWAYS** mark tasks `[IN PROGRESS]` in TASKS.md BEFORE starting any implementation work (Step 3). This is a hard gate — do not proceed without it.
- **ALWAYS** remove completed tasks from TASKS.md immediately after user approval (Step 8). Verify removal by re-reading the file. Do not end the session with approved tasks still in TASKS.md.
- **NEVER** skip integration tests — unit tests alone are NOT sufficient
- **NEVER** commit code — user handles all git operations (see MEMORY.md git rules)
- **NEVER** implement fixes based on assumptions — read the actual code first
- **Account for mono-repo impact** — a type change in `domain/` can break `backend/`, `proxy/`, `admin/`, `agent/`, and `tsa/`
- **Follow existing patterns** — read neighboring code before writing new code
- **Use sub-agents** for cross-repo work to maintain focus and prevent context drift
