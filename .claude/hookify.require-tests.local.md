---
name: require-tests-before-stop
enabled: true
event: stop
action: block
pattern: .*
---

**BLOCKED: You have not run tests.**

Before stopping, you MUST run `pnpm test` for every repo you modified in this session.

**Required verification:**
1. Identify which repos had files changed (check your edits)
2. Run `pnpm test` in each affected repo
3. Paste the test output showing pass/fail counts
4. If any tests fail, fix them before stopping

If you modified `repos/components/` → run `cd repos/components && pnpm test`
If you modified `repos/threads/` → run `cd repos/threads && pnpm test`
If you modified `repos/backend/` → run `cd repos/backend && pnpm test`
If you modified `repos/database/` → run `cd repos/database && pnpm test`

**"Tests pass" without output is NOT acceptable. Show the output.**

Do NOT stop until tests are run and passing. Go run them now.
