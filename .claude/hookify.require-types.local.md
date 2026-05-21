---
name: require-types-before-stop
enabled: true
event: stop
action: block
pattern: .*
---

**BLOCKED: You have not run type checks.**

Before stopping, you MUST run `pnpm types` for every repo you modified in this session.

**Required verification:**
1. Identify which repos had files changed
2. Run `pnpm types` in each affected repo
3. Paste the output showing clean (no errors) or list the errors
4. If any type errors exist, fix them before stopping

If you modified `repos/components/` → run `cd repos/components && pnpm types`
If you modified `repos/threads/` → run `cd repos/threads && pnpm types`
If you modified `repos/backend/` → run `cd repos/backend && pnpm types`
If you modified `repos/domain/` → run `cd repos/domain && pnpm types`

**"Types pass" without output is NOT acceptable. Show the output.**

Do NOT stop until type checks are run and clean. Go run them now.
