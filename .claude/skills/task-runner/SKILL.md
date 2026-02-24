---
name: task-runner
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

Edit `TASKS.md` to change the selected task markers from their current state to `[IN PROGRESS]`:
```
* **[IN PROGRESS][P1] Task title here**
```

This prevents other agents from picking up the same tasks.

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
   - `domain` → `database` → `logger` → `backend`/`proxy`/`admin`/`agent`/`repl`
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

### Step 8: Get User Approval and Remove Completed Tasks

Once verified, **ask the user** to confirm the task is complete and should be removed from TASKS.md.

**CRITICAL**: NEVER remove a task from TASKS.md without explicit user approval. The flow is:
1. Present the verification results (tests passing, type checks clean, integration tests green)
2. List the task(s) you propose to remove
3. Ask the user: "These tasks are verified. Should I remove them from TASKS.md?"
4. Only after the user confirms → remove the entire task entry (bullet point + all sub-bullets/description) from TASKS.md
5. If the user says no or wants changes → keep the `[IN PROGRESS]` marker and address feedback

## Key Rules

- **NEVER** skip integration tests — unit tests alone are NOT sufficient
- **NEVER** commit code — user handles all git operations (see MEMORY.md git rules)
- **NEVER** implement fixes based on assumptions — read the actual code first
- **Account for mono-repo impact** — a type change in `domain/` can break `backend/`, `proxy/`, `admin/`, `agent/`, and `repl/`
- **Follow existing patterns** — read neighboring code before writing new code
- **Use sub-agents** for cross-repo work to maintain focus and prevent context drift
