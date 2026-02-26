---
name: commit-message
description: Generate conventional commit messages from staged git changes. Use when asked to compose a commit message, write a commit, generate conventional commits, or describe staged changes.
---

# Git Commit Composer

## Process

1. Run `git diff` to read the changed files. If nothing is changed, inform the user to make changes first.
2. Analyze the diff to determine: what changed, why it changed, and the impact.
3. Classify the change type and generate a commit message following Conventional Commits.

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

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

### Scope

Derive the scope from the primary area of change:

- File/module name: `feat(auth): add JWT refresh token rotation`
- Feature area: `fix(checkout): prevent double charge on retry`
- Layer: `refactor(api): extract validation middleware`

Omit scope if the change spans many unrelated areas.

### Description Rules

- Use imperative mood: "add" not "added" or "adds"
- No capitalized first letter
- No period at the end
- Under 72 characters total (including type and scope)
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

### Body

Add a body when the description alone doesn't explain the "why":

```
fix(api): return 404 instead of 500 for missing resources

Previously, querying a non-existent user threw an unhandled
PrismaClientKnownRequestError, resulting in a 500 response.
Now the error is caught and mapped to a proper 404.
```

### Breaking Changes

Use `!` after the type/scope and add a `BREAKING CHANGE` footer:

```
feat(api)!: change user endpoint response format

BREAKING CHANGE: GET /api/users now returns { data: User[], meta: {...} }
instead of a plain User[] array. All clients must update their response parsing.
```


## Dependency Updates

For dependency changes, include the version bump:

```
chore(deps): bump next from 14.1.0 to 14.2.0
chore(deps-dev): add vitest 2.0.0 and @testing-library/react 16.0.0
fix(deps): pin prisma to 5.19.0 to resolve migration bug
```

## Output Format

```
## Commit Message

[The generated commit message in a code block]

### Analysis
- **Type**: [type] — [reason for classification]
- **Scope**: [scope] — [derived from]
- **Files changed**: [count]
- **Insertions/deletions**: +[n] / -[n]
```
