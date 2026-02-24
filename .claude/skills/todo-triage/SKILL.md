---
name: todo-triage
description: "Triage TODO.md items into detailed TASKS.md entries. Use when asked to review TODOs, triage TODOs, process the TODO list, or convert TODOs to tasks. Do NOT use for TASKS.md task execution — that is the task-runner skill."
---

Process items from `TODO.md` into detailed `TASKS.md` entries. Optional arguments: $ARGUMENTS

## Workflow

### Step 1: Read TODO.md

Read `TODO.md` in the project root. Each item is a confirmed issue or required update, grouped by sub-repo. All items have been manually confirmed to exist.

If TODO.md is empty (no items), inform the user and stop.

### Step 2: Investigate Each Item

For every item in TODO.md, trace the problem in the actual code:

1. **Read the referenced files** — find the exact lines, functions, and components involved
2. **Identify the root cause** — what specifically is wrong or missing
3. **Trace cross-repo impact** — this is a mono-repo; check if the issue or fix touches types in `domain/`, schemas in `database/`, or shared utilities used by multiple repos
4. **Determine the fix** — what changes are needed and where
5. **Assign a priority**:
   - **P0**: Broken functionality (feature doesn't work at all)
   - **P1**: UX blockers (feature works but is severely degraded)
   - **P2**: UI polish (visual/layout issues, minor UX improvements)
   - **P3**: New features (missing functionality, new components)
   - **P4**: Major refactor (architectural changes, large-scale cleanup)

Load the relevant sub-repo skill (`.claude/skills/<repo>/SKILL.md`) when investigating items in an unfamiliar repo.

### Step 3: Write TASKS.md Entries

Add each investigated item to `TASKS.md` following the existing format exactly:

```markdown
* **[P<n>] Short descriptive title**
  * Description of the problem with exact file paths and line references
  * Additional context about what exists vs what's expected
  * **Fix**: Concrete steps to resolve the issue
    1. Step one
    2. Step two
  * **Files**:
    * `repos/<repo>/src/path/to/file.ts` — what changes here
    * New: `repos/<repo>/src/path/to/new-file.ts` — if creating files
    * Refactor: `repos/<repo>/src/path/to/moved-file.ts` — if moving files
```

**Placement rules**:
- Group entries under the correct repo heading (`### Admin`, `### Backend`, etc.)
- Within a repo, group under sub-headings if applicable (`#### General`, `#### Endpoints`, etc.)
- If a heading doesn't exist yet, create it following the existing pattern
- Place entries near related existing tasks when possible

### Step 4: Remove Processed Items from TODO.md

After an item has been written to TASKS.md, remove it from TODO.md.

- Remove the entire item entry (bullet + all sub-bullets/description)
- Keep the TODO.md header and group headings intact if other items remain under them
- Remove empty group headings (no remaining items under a `###` header → remove the header too)
- If all items are processed, leave just the file header:
  ```markdown
  # TODO

  The following are a list of confirmed issues found or required updates across the mono-repo.
  Items are split into seperate groups, with the sub repo name as the header.

  **IMPORTANT** - This is a mono-repo, so changes to one sub repo can have large impacts acorss the code base. Ensure changes are properly accounted for in all sub repos and edge cases.

  ```

### Step 5: Summary

Present a summary to the user:
- How many items were triaged
- Breakdown by repo and priority
- Any items that were ambiguous or need clarification
- Any cross-repo dependencies discovered between new tasks

## Key Rules

- **Read the actual code** before writing a TASKS.md entry — never describe a problem based solely on the TODO.md text
- **Match the existing TASKS.md format exactly** — priority tags, file paths, fix descriptions, files lists
- **Include exact file paths and line numbers** where the issue lives
- **Note cross-repo impact** — if a fix in `backend/` requires a type change in `domain/`, document both files
- **Do NOT implement fixes** — this skill only triages and documents. Use `task-runner` to implement.
- **Do NOT modify any source code** — only `TODO.md` and `TASKS.md` are edited
- **NEVER** commit code — user handles all git operations
