---
name: Integration test overhaul (2026-05-02)
description: Major integration test gap-fill — 287 new tests, destructive test bugs found and fixed, cleanup patterns established
type: project
---

Added ~287 integration tests across 28 new files + 8 modified files in repos/integration/.

**Critical lessons learned:**
- NEVER send DELETE/PUT against real seeded resources (org, members, roles) — even expecting 403. If the backend doesn't reject it, the resource is destroyed and the test assertion fails AFTER the damage is done.
- Always use dedicated test users from env vars (TDSK_IT_SUPER_USER, TDSK_IT_ADMIN_USER, TDSK_IT_MEMBER_USER, TDSK_IT_VIEWER_USER) — never dynamically discover org members.
- NEVER accept 403 gracefully in assertions — it means something is broken, fix the cause.
- All tests MUST clean up in afterAll. Track accidentally-created resources defensively.
- The global stale cleanup now covers: agents, projects, secrets, providers, API keys, assets, test-created orgs, sandboxes.

**Why:** Plan at `~/.claude/plans/the-integration-repo-has-transient-eclipse.md`

**How to apply:** When writing integration tests, only DELETE resources the test itself created or use nonexistent UUIDs for error-path testing. Use `env.viewerUserId` as the target for role hierarchy tests. Use `env.adminUserId` / `env.memberUserId` for API key provisioning.
