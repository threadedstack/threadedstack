---
name: commit-message
description: "Review changed files and compose a conventional commit message. Uses plan files as primary context when present. NEVER commits — only outputs the message. Use when asked to compose a commit message, write a commit, generate conventional commits, describe changes, or summarize work done."
---

# Git Commit Composer

Analyzes changed files in the working tree, detects plan files for context, and outputs a conventional commit message. **Never commits, stages, or modifies git history.**

## Safety Rules

- **NEVER** run `git add`, `git commit`, `git push`, `git reset`, `git revert`, `git rebase`, or `git cherry-pick`
- **NEVER** modify git state in any way — read-only git operations only
- Output the commit message as text — the user will commit manually

## Process

### Step 1: Gather Changes

Run these commands to understand the full scope of changes:

```bash
git status
git diff              # Unstaged changes
git diff --cached     # Staged changes
```

If there are no changes (clean working tree), inform the user and stop.

### Step 2: Detect Plan Files

Search the changed files for plan files. Plan files are any files matching:
- `*plan*` (e.g., `plan.md`, `implementation-plan.md`, `.claude/plan-*.md`)
- `*PLAN*`
- `TASKS.md` (task list that may describe planned work)

If plan files are found among the changed files:
1. **Read each plan file** to understand the intended scope and goals
2. Use the plan as the **primary basis** for the commit message — it describes *what was intended*
3. Cross-reference the plan against actual code changes to confirm what was implemented
4. Note any plan items that appear unfinished or divergent from the code changes

If no plan files are found, proceed with diff-only analysis.

### Step 3: Analyze Changes

For each changed file, determine:
- **What** changed (added, modified, deleted)
- **Why** it changed (feature, fix, refactor, etc.)
- **Which repo/area** it belongs to (admin, backend, proxy, domain, etc.)

Group related changes to identify the overall theme.

### Step 4: Compose the Commit Message

Follow Conventional Commits format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `docs` | Documentation changes only |
| `style` | Formatting, semicolons, whitespace (no logic change) |
| `perf` | Performance improvement |
| `chore` | Build, tooling, dependency updates, config changes |
| `ci` | CI/CD configuration changes |
| `build` | Build system or external dependency changes |
| `revert` | Reverts a previous commit |

#### Scope

Derive scope from the primary area of change. For this monorepo:
- Single repo: `feat(backend): add quota tracking endpoint`
- Multiple repos: `feat(backend,domain): add quota model and API`
- Cross-cutting: omit scope or use feature area: `feat: add project-scoped API keys`

Omit scope if the change spans many unrelated areas.

#### Description Rules

- Imperative mood: "add" not "added" or "adds"
- No capitalized first letter
- No period at end
- Under 72 characters total (type + scope + description)
- Describe what the change does, not what was wrong

**BAD:**
```
fix: Fixed the bug where users couldn't log in.
feat: Added new validation to the form
chore: updated dependencies
```

**GOOD:**
```
fix(auth): prevent login failure when session cookie is expired
feat(form): add email format validation to signup form
chore(deps): bump next from 14.1.0 to 14.2.0
```

#### Body

When plan files were used, the body should summarize the key deliverables from the plan. When changes are non-trivial, explain the "why" not just the "what".

```
fix(api): return 404 instead of 500 for missing resources

Previously, querying a non-existent user threw an unhandled
PrismaClientKnownRequestError, resulting in a 500 response.
Now the error is caught and mapped to a proper 404.
```

#### Breaking Changes

Use `!` after the type/scope and add a `BREAKING CHANGE` footer:

```
feat(api)!: change user endpoint response format

BREAKING CHANGE: GET /api/users now returns { data: User[], meta: {...} }
instead of a plain User[] array. All clients must update their response parsing.
```

#### Multi-Topic Changes

If changes span multiple unrelated concerns, suggest splitting into multiple commits with separate messages for each logical group.

## Dependency Updates

For dependency changes, include the version bump:

```
chore(deps): bump next from 14.1.0 to 14.2.0
chore(deps-dev): add vitest 2.0.0 and @testing-library/react 16.0.0
fix(deps): pin prisma to 5.19.0 to resolve migration bug
```

## Output Format

Present the commit message in a code block, followed by a brief analysis:

```
## Commit Message

[The generated commit message in a code block]

### Analysis
- **Type**: [type] — [reason for classification]
- **Scope**: [scope] — [derived from]
- **Plan file used**: [yes/no] — [filename if yes]
- **Files changed**: [count]
- **Repos touched**: [list]
- **Insertions/deletions**: +[n] / -[n]
```

If suggesting multiple commits, present each one separately with its file grouping.
