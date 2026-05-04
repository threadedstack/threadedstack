# Fix Remaining Integration Test Failures

## Context

We just completed a large integration test gap-fill project. The plan is at `~/.claude/plans/the-integration-repo-has-transient-eclipse.md`. We added ~287 new tests across 28 new files and 8 modified files in `repos/integration/`.

After the first test run, we fixed several critical issues:
1. **Destructive DELETE tests** — Tests were sending real DELETE requests against seeded org members, the seed org itself, and real roles expecting 403. When the backend didn't return 403, the resources were actually deleted. Fixed: all DELETEs now only target resources the test created or nonexistent IDs.
2. **Global setup** — Now uses dedicated test users from env vars (`TDSK_IT_SUPER_USER`, `TDSK_IT_ADMIN_USER`, `TDSK_IT_MEMBER_USER`, `TDSK_IT_VIEWER_USER`) instead of dynamically discovering org members.
3. **Stale cleanup** — Expanded `cleanupStaleTestResources` in global-setup to also clean secrets, assets, and test-created orgs.
4. **Silent skip logging** — Added `console.warn` to bare `return` guards so skipped tests are visible.

## Current State

31 tests still failing. The test output is saved at `.temp/tests-output.txt`. Run `/fix-tests` to read it and investigate.

## Key Rules (from CLAUDE.md and prior feedback)

- **NEVER run git commit/push** — user handles all git operations
- **NEVER send DELETE/PUT against real seeded resources** — only test-created or nonexistent IDs
- **NEVER accept 403 gracefully** in test assertions — 403 means a real problem, fix the root cause
- **NEVER use fake API keys** — real keys come from env vars via `loadEnvs()`
- **All tests MUST clean up** after themselves in afterAll
- **Dedicated test users**: `TDSK_IT_SUPER_USER` (super), `TDSK_IT_ADMIN_USER` (admin), `TDSK_IT_MEMBER_USER` (member), `TDSK_IT_VIEWER_USER` (viewer) — use these, don't discover users dynamically
- K8s services are always running — never ask about starting them
- Integration tests run via: `cd repos/integration && pnpm test`

## Files Changed (all in repos/integration/)

### New files (28):
- `src/utils/invitation-helpers.ts`
- `src/tier1/invitations.test.ts`, `users.test.ts`, `assets.test.ts`, `domains.test.ts`, `endpoints.test.ts`
- `src/tier1/org-members.test.ts`, `org-roles.test.ts`, `thread-write-ops.test.ts`, `direct-paths.test.ts`
- `src/tier1/sandbox-copy.test.ts`, `subscription-contracts.test.ts`, `member-permissions.test.ts`, `webhook-contract.test.ts`
- `src/tier1/tsa-shell-sessions.test.ts`, `tsa-sandbox-alias.test.ts`, `tsa-token-refresh.test.ts`
- `src/tier3/invitation-lifecycle.test.ts`, `thread-branching.test.ts`
- `playwright/tier2/billing.spec.ts` (rewritten), `onboarding-wizard.spec.ts`, `org-settings.spec.ts`, `project-settings.spec.ts`, `profile.spec.ts`
- `playwright/tier2/sandbox-lifecycle.spec.ts`, `role-gated-access.spec.ts`, `org-usage.spec.ts`, `org-invitations.spec.ts`, `error-handling.spec.ts`

### Modified files (8):
- `src/setup/global-setup.ts` — member key provisioning, expanded stale cleanup, uses env user IDs
- `src/utils/test-context.ts` — added memberApiKey/memberUserId/memberApiKeyId fields
- `src/utils/env.ts` — added superUserId/adminUserId/memberUserId/viewerUserId accessors
- `src/utils/cleanup.ts` — tryDelete now logs on failure
- `src/tier1/orgs.test.ts` — added write operation tests (safe DELETE pattern)
- `src/tier1/tsa-api-client.test.ts` — added new API method tests with null guards
- `playwright/tier2/crud-functions.spec.ts` — added UPDATE test
- `playwright/tier2/crud-threads.spec.ts` — added UPDATE test

## What to Do

1. Use the `/fix-tests` skill to read `.temp/tests-output.txt` and investigate the 31 remaining failures
2. Fix the root causes — do NOT make tests accept wrong status codes
3. If a test is wrong (expects wrong status code), fix the assertion to match actual backend behavior
4. If the backend behavior is wrong, fix the backend code
5. Run `pnpm types` in repos/integration before reporting done
