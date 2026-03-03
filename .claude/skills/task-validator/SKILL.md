---
name: task-validator
description: "Validate completed TASKS.md implementations for completeness, code quality, test coverage, and cross-repo impact. Use when validating task work, reviewing task completion, or automatically after runner Step 7. Dispatches 3 parallel review sub-agents."
---

Validate task implementation for: $ARGUMENTS

## Workflow

### Step 1: Identify the Task to Validate

If `$ARGUMENTS` specifies a task title or excerpt, locate that task in `TASKS.md`.

If no argument is provided:
1. Read `TASKS.md` in the project root
2. Find all tasks marked `[IN PROGRESS]`
3. If exactly one `[IN PROGRESS]` task exists, validate that one
4. If multiple `[IN PROGRESS]` tasks exist, list them and ask the user which to validate
5. If no `[IN PROGRESS]` tasks exist, inform the user and stop

Parse the full task definition including:
- **Task title** and priority
- **Description** — what the problem is and what the fix should accomplish
- **Fix steps** — the numbered implementation steps
- **Files list** — every file the task says should be created, modified, or refactored
- **Repos touched** — which sub-repos the task involves

Store this parsed task definition as the **acceptance criteria** for all sub-agents.

### Step 2: Identify Changed Files

Run read-only git operations to determine what was actually changed:

```bash
git diff --name-only
git diff --name-only --cached
git status
```

Combine all outputs into a deduplicated list of **changed files**, including new untracked files created as part of the implementation. Group changed files by sub-repo (e.g., `repos/backend/`, `repos/domain/`, `repos/admin/`).

### Step 3: Load Relevant Repo Skills

Before dispatching sub-agents, load the skill file for every sub-repo the task touches:
- Changes in `repos/admin/`? → Load `.claude/skills/tdsk-admin/SKILL.md`
- Changes in `repos/backend/`? → Load `.claude/skills/tdsk-backend/SKILL.md`
- Changes in `repos/domain/`? → Load `.claude/skills/tdsk-domain/SKILL.md`
- Changes in `repos/database/`? → Load `.claude/skills/tdsk-database/SKILL.md`
- Changes in `repos/agent/`? → Load `.claude/skills/tdsk-agent/SKILL.md`
- Changes in `repos/proxy/`? → Load `.claude/skills/tdsk-proxy/SKILL.md`
- Changes in `repos/repl/`? → Load `.claude/skills/tdsk-repl/SKILL.md`
- Changes in `repos/sandbox/`? → Load `.claude/skills/tdsk-sandbox/SKILL.md`
- Changes in `repos/components/`? → Load `.claude/skills/tdsk-components/SKILL.md`

Extract the coding standards, patterns, and conventions from each loaded skill. Pass these as context to the quality sub-agent.

### Step 4: Dispatch 3 Parallel Sub-Agents

Spawn all three validation sub-agents in a **single message** using the Task tool. Each sub-agent receives:
- The full task definition text (copy-pasted from TASKS.md, never summarized)
- The list of changed files grouped by sub-repo (from Step 2)
- The specific scope assignment
- Instructions to follow `.claude/agents/task-reviewer.md` methodology

**All three agents must be dispatched in ONE message:**

**Agent 1 — Task Completeness Reviewer** (scope: `COMPLETENESS`):
Reviews whether every fix step in the task definition has corresponding code changes, every listed file was created or modified, and the implementation matches the described intent.

**Agent 2 — Code Quality & Standards Reviewer** (scope: `QUALITY`):
Reviews whether changes follow existing coding patterns (by reading neighboring files), types are correct, error handling is consistent, cross-repo dependencies are wired, and no regressions exist. Include the repo skill conventions extracted in Step 3.

**Agent 3 — Test Coverage & Validation Reviewer** (scope: `TESTING`):
Reviews whether co-located unit tests exist for changed files, integration tests exist in `repos/integration/src/`, runs `pnpm --filter @tdsk/<repo> test` for each affected repo, and runs `pnpm types` to check for type errors.

Each sub-agent prompt **MUST** include:
1. The full task definition text (verbatim from TASKS.md)
2. The complete list of changed files with repo groupings
3. The scope assignment (COMPLETENESS, QUALITY, or TESTING)
4. Instructions to read `.claude/agents/task-reviewer.md` for methodology and output format
5. The instruction to use ONLY read-only operations (Read, Grep, Glob, git diff, git status)
6. The git rules: **NEVER** commit, amend, revert, or change git history in ANY way
7. For the TESTING agent only: permission to run `pnpm test` and `pnpm types` commands

### Step 5: Collect and Present Report

After all three sub-agents return, combine their findings into a single validation report:

```markdown
## Task Validation Report

**Task**: [P<n>] <task title>
**Status**: PASS | FAIL | WARNING
**Date**: <current date>

---

### 1. Task Completeness — <PASS|FAIL|WARNING>

<Agent 1 findings>

### 2. Code Quality & Standards — <PASS|FAIL|WARNING>

<Agent 2 findings>

### 3. Test Coverage & Validation — <PASS|FAIL|WARNING>

<Agent 3 findings>

---

### Summary

| Category | Status | Findings |
|----------|--------|----------|
| Completeness | <status> | <count> issues |
| Code Quality | <status> | <count> issues |
| Test Coverage | <status> | <count> issues |

### Overall Verdict: PASS | FAIL

<One paragraph summary of whether the task is ready for user approval>
```

**Severity definitions**:
- **PASS**: All acceptance criteria met, no issues found in this category
- **WARNING**: Minor issues that do not block completion (e.g., missing edge case test, optional improvement)
- **FAIL**: Critical issues that must be addressed before the task can be marked complete (e.g., missing implementation step, broken tests, no integration tests)

**Overall verdict**: FAIL if any category is FAIL; otherwise PASS.

### Step 6: Present to User

Display the validation report. Do NOT auto-fix any issues — report only.

If invoked by the runner skill (Step 8), return the verdict so the runner can decide whether to proceed with user approval or address failures first.

## Key Rules

- **Read-only** — this skill NEVER modifies source code, tests, or configuration files. It only reads and reports.
- **NEVER commit** — user handles all git operations (see MEMORY.md git rules). This applies to all sub-agents.
- **Full task context** — always pass the COMPLETE task definition to sub-agents, never summarize or truncate
- **Mono-repo awareness** — changes to `domain/` types affect `backend/`, `proxy/`, `admin/`, `agent/`, `repl/`. Changes to `database/` schemas affect `backend/`. Sub-agents must check downstream consumers.
- **Evidence-based** — every finding must reference a specific file and line. No speculative findings.
- **No auto-fixes** — report issues with file:line references so the implementer can address them
- **Integration tests are mandatory** — a task without integration tests is a FAIL in the Test Coverage category, unless the task explicitly states otherwise
- **Parallel dispatch** — all three sub-agents launch in a single message for maximum parallelism
