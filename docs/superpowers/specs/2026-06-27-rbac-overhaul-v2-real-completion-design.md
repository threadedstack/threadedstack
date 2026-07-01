# RBAC Overhaul v2 — Real Completion (Design Spec)

**Date:** 2026-06-27
**Status:** Approved
**Brainstormed via:** `superpowers:brainstorming`
**Implementation plan:** produced next via `superpowers:writing-plans`

---

## 1. Problem statement

The "RBAC Overhaul v2" was claimed done across four commits (recorded as completed in memory), but the system has multiple production gaps. The most visible: opening the sandbox edit modal in admin (`/orgs/:orgId/projects/:projectId/sandboxes`) triggers a flood of `401` and `403 "Not a member of this organization or project"` errors against `POST /_/providers/:brand/models`. Further audit found 17 distinct defects spanning missing guards, silent-skip bypasses, a critical cross-org permission precedence bug, validation gaps in write paths, and a frontend that calls a now-RBAC-protected endpoint with no scope.

## 2. Goals & non-goals

**Goals**
- Eliminate the live `403 "Not a member of this organization or project"` errors in the sandbox edit flow.
- Close every defect the audit found — no partial completion, no deferrals.
- Add regression tests so the recurrence is caught by CI, not by a frustrated user.
- Bring `authorize`, `projectAccessGuard`, `projectMemberGuard`, and the proposed `orgAccessGuard` into one consistent contract.
- Make permission-denial errors precise about which scope failed (org vs project), so future debugging takes minutes not hours.

**Non-goals**
- Re-architecting the role hierarchy or permission templates. Roles and permission sets stay as defined in `@tdsk/domain`.
- Changing the proxy → backend header contract (`X-User-Org-Id` etc.) — only how the backend consumes them.
- Performance work like API-key permission caching. Logged for a future round; not in scope here.
- Cleaning up legacy `agents` system (already noted in memory as future removal).

## 3. Decisions captured during brainstorming

- **Live-bug endpoint** → **org-scope it**. The models endpoint becomes `POST /_/orgs/:orgId/providers/:brand/models`. The frontend threads `orgId` from the existing route context through `ModelSelect`. The top-level `/_/providers` mount and the `providerModels` registration are deleted.
- **Rollout** → **single bundle**. One PR fixes every audited issue. Bundling forces a single validation pass and a single "done."

## 4. Root-cause trace of the live bug

`repos/admin/src/services/providersApi.ts:117-132` — `ProvidersApi.fetchModels()` posts to `/providers/${brand}/models` (no org/project).

`repos/backend/src/endpoints/providers/providers.ts:11-21` — `providerModels` mounts at `/_/providers` with a comment claiming it "does not need to be organization scoped"…

`repos/backend/src/endpoints/providers/fetchModels.ts:31` — …but the endpoint applies `authorize(EPermAction.read, EPermResource.provider)`, which **requires** scope.

`repos/backend/src/middleware/authorize.ts:18-23` — context built as `orgId = auth.orgId || req.params.orgId || req.query.orgId`. URL has no `:orgId`, query has no `orgId`. If the proxy didn't forward `X-User-Org-Id` for this org-less path, `orgId === undefined`.

`repos/backend/src/utils/auth/checkPermission.ts:30-46` — `getUserRole(req, { orgId: undefined })` skips both lookup branches → returns `null`.

`repos/backend/src/utils/auth/resolveEffectivePermissions.ts:37-38` — `userRole == null` → throws `Exception(403, 'Not a member of this organization or project')`.

The 401s that precede the 403s are racing requests fired from `ModelSelect`'s `useEffect` before the JWT cookie is fully attached on first load.

## 5. CRITICAL extra finding (uncovered during file-level verification)

`repos/backend/src/middleware/authorize.ts:22` resolves orgId as:

```ts
orgId: auth.orgId || req.params.orgId || (req.query?.orgId as string)
```

This trusts the header (`auth.orgId`) **over** the URL. A user/API-key bound to `orgA` can call `GET /_/orgs/orgB/secrets` and `authorize` resolves permissions against **orgA** (where the user is admin); the route handler then reads `req.params.orgId === orgB` and returns orgB's data. Silent cross-org exposure.

Correct precedence is `req.params.orgId > req.query.orgId > auth.orgId`. The membership check via `getUserRole(req, {orgId: req.params.orgId})` is what enforces the URL's org membership — non-members get 403 before the route handler runs.

### 5.1 Deviation from earlier draft: no header/URL mismatch rejection

An earlier draft of this spec (§6.1 row for the proposed `orgAccessGuard` and §7 defects C4/M4) called for **hard rejection** when `auth.orgId` differs from `req.params.orgId`. That was implemented (`orgAccessGuard` middleware + `projectAccessGuard` org-mismatch check + `authorize` `SCOPE_MISMATCH` exception) and then **reverted** after integration testing. The reason: a user with membership in multiple orgs may legitimately use an org-scoped API key against a sibling org where they also belong. The original behavior — accept the request, then enforce membership in the URL's org via `getUserRole` — is the correct semantics. The proxy's `X-User-Org-Id` header reflects the key's binding for routing/quota purposes, not a hard scope limit.

What's actually shipped:
- `authorize`: URL > query > header precedence; **no** mismatch rejection.
- `projectAccessGuard`: still rejects project-scoped keys hitting org-level URLs and project-scoped keys targeting a different project. **Does not** reject org-scoped key org mismatches.
- No `orgAccessGuard` middleware exists — M4 was de-scoped.

The cross-org exposure described in §5 is closed by the URL-first precedence alone: `getUserRole(userId, urlOrgId)` returns null when the user is not a member of `urlOrgId`, and `resolveEffectivePermissions` throws 403. Verified by the integration test in `repos/integration/src/tier1/rbac/cross-org-probe.test.ts` and by manual probe.

## 6. Architecture

### 6.1 Guard contract (target state)

| Guard | Responsibility | Failure mode |
|---|---|---|
| `authenticate` | Verify proxy headers, attach `req.user`, enforce existing org-member-for-api-key invariant | 401 |
| `projectAccessGuard()` | (kept) Project-scoped API key → must target its project. Org-scoped keys pass through; org membership is enforced by `authorize` via `getUserRole`. | 403 |
| `projectMemberGuard()` | (kept) Verify JWT/org-key user is a member of the URL's project. **Fail-closed when URL params missing.** | 400 / 403 |
| `authorize(action, resource)` | (kept) Compute effective permissions in scope, check `${resource}:${action}`. **Scope `orgId`/`projectId` taken from URL first, query second, header last. No mismatch rejection** (see §5.1). | 403 |
| `enforceQuota` | (kept) | 403 / 503 |
| `featureGate(flag)` | (kept) | 404 (intentional) |

### 6.2 Components touched

```
                  ┌──────────────────────────────┐
                  │   admin SPA (React)          │
                  │   ┌──────────────┐           │
                  │   │ ModelSelect  │ now needs │
                  │   │ + callers    │ orgId     │
                  │   └──────────────┘           │
                  │       │                       │
                  │   providersApi.fetchModels    │
                  │   (orgId, brand, opts)        │
                  └────────────────│──────────────┘
                                   │  POST /_/orgs/:orgId/providers/:brand/models
                                   ▼
       ┌────────────────────────────────────────────────────┐
       │  proxy: JWT/JWKS validation, header injection      │
       └────────────────────────────│───────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────┐
       │  backend                                            │
       │  accounts → authenticate → setupSubscription →     │
       │  enforceQuota → /orgs/:orgId (orgAccessGuard NEW)   │
       │     → providers/:brand/models                       │
       │       authorize(read, provider)                     │
       │         scope: orgId from req.params (FIXED order)  │
       │           → ModelRegistry / Ollama probe            │
       └────────────────────────────────────────────────────┘
```

### 6.3 Data flow change — ModelSelect

Before:
```
sandbox modal mounts → 6× ModelSelect useEffect →
  6× POST /providers/:brand/models (no scope) → 401/403 storm
```

After:
```
sandbox modal mounts → 6× ModelSelect (no fetch) →
  user opens a brand's model dropdown → fetch on open →
    POST /_/orgs/:orgId/providers/:brand/models → 200 (or visible warning)
```

## 7. Defect list

### Critical
- **C1.** `authorize` orgId precedence trusts header over URL → silent cross-org exposure (verification finding). **Fixed** by URL-first precedence. The earlier-drafted "reject on mismatch" was reverted (see §5.1).
- **C2.** Live bug — `/_/providers/:brand/models` mounted org-less but applies `authorize(read, provider)`.
- **C3.** `projectMemberGuard` silently calls `next()` when params missing.
- **C4.** `projectAccessGuard` doesn't reject an org-scoped key whose `auth.orgId` differs from `req.params.orgId`. **De-scoped** (see §5.1) — the bug's underlying risk is closed by C1's URL-first precedence + `getUserRole` membership check, not by a separate mismatch guard.

### High
- **H1.** Org-level wrappers `orgAgents`, `orgSecrets`, `orgDomains`, `orgOverrides` lack `projectAccessGuard()` — project-scoped keys can reach org data.
- **H2.** `createAgent` does not validate `secretIds`/`providerIds` belong to the org of the agent being created.

### Medium
- **M1.** Nested config groups `projectAgentConfig` and `projectSandboxConfig` rely entirely on parent middleware. Make guards explicit at nested level.
- **M2.** `listAgents` reads `req.query.projectId` and lets it override the URL scope.
- **M3.** `copySandbox` returns 404 instead of 403 on cross-org mismatch.
- **M4.** No `orgAccessGuard` middleware exists at all; the org-mismatch check has to be sprinkled. Formalize as a middleware mounted on the `:orgId` wrapper. **De-scoped** (see §5.1). No new middleware was needed — the URL-first precedence in `authorize` plus the existing `getUserRole` membership check closes the underlying risk.

### Low / hygiene
- **L1.** `startSandbox` / `connectSandbox` have dead `if (!projectId) throw 400` checks (redundant once C3 is fixed).
- **L2.** Permission-denial error message is the same for org-vs-project membership failures.
- **L3.** `checkPermission` stashes `(req as any).permissions` for "downstream use" but no one reads it; ambient mutable state with no consumer.
- **L4.** `featureGate` returning 404 is intentional; add a comment so future readers don't "fix" it.

### Frontend
- **F1.** `ModelSelect` fires fetch from `useEffect` on every brand mount (5–6 parallel requests per modal open).
- **F2.** `ModelSelect` swallows errors silently (`console.warn` + empty select).
- **F3.** `providersApi.fetchModels` accepts a `providerKey` body param. We send a user-supplied API key to a read endpoint that doesn't need it. Remove if no caller passes `apiKey` (verify with grep).

## 8. Components / files modified

### Backend (`repos/backend/src/`)
- `middleware/authorize.ts` — fix precedence (C1); reject scope mismatch.
- `middleware/projectAccessGuard.ts` — add org-mismatch reject (C4).
- `middleware/projectMemberGuard.ts` — fail closed on missing params (C3).
- `middleware/orgAccessGuard.ts` — **NEW** (M4).
- `endpoints/accounts.ts` — remove `providerModels` registration.
- `endpoints/providers/providers.ts` — delete `providerModels` export. Ensure `fetchModels` is registered in org-scoped `providers` group only.
- `endpoints/providers/fetchModels.ts` — no logic change; relies on org-scoped mount giving it scope.
- `endpoints/orgs/orgs.ts` — mount `orgAccessGuard()` on the `:orgId` wrapper.
- `endpoints/orgs/orgAgents.ts`, `orgSecrets.ts`, `orgDomains.ts`, `orgOverrides.ts` — add `projectAccessGuard()` (H1).
- `endpoints/orgs/orgProjects.ts` — explicit guards on `projectAgentConfig` and `projectSandboxConfig` (M1).
- `endpoints/agents/createAgent.ts` — validate `secretIds`/`providerIds` belong to org (H2).
- `endpoints/agents/listAgents.ts` — drop query-based projectId override (M2).
- `endpoints/sandboxes/startSandbox.ts`, `connectSandbox.ts` — drop dead checks (L1).
- `endpoints/sandboxes/copySandbox.ts` — 403 instead of 404 (M3).
- `utils/auth/resolveEffectivePermissions.ts` — distinct org-vs-project error messages (L2).
- `utils/auth/checkPermission.ts` — remove unused `(req as any).permissions` stash (L3).
- `middleware/featureGate.ts` — comment explaining the intentional 404 (L4).

### Frontend (`repos/admin/src/`)
- `services/providersApi.ts` — `fetchModels(orgId, brand, opts)`.
- `components/Agents/ModelSelect.tsx` — accept `orgId` prop; defer fetch to dropdown-open; surface errors (F1, F2).
- `actions/providers.ts` (action that wraps providersApi) — accept and forward `orgId`.
- All `<ModelSelect>` callers — pass `orgId` from existing route context. Identify via grep.

### Tests (`repos/integration/tests/`)
- Update existing provider-models fixtures (path moves under org).
- Add: cross-org probe (API key for orgA hitting `/_/orgs/orgB/secrets`) → 403.
- Add: project-scoped key hitting org-level `/_/orgs/:orgId/agents` → 403.
- Add: `createAgent` with cross-org `secretIds` → 403.
- Add: `copySandbox` cross-org → 403 (was 404).
- Add: removed-route check — `POST /_/providers/openai/models` (no org) → 404.

## 9. Error handling

After this change, the user-facing/log-facing errors become:

- **Cross-org auth header**: `403 'API key does not belong to this organization'`
- **Cross-project API key**: `403 'API key does not have access to this project'` (unchanged)
- **Non-member of org**: `403 'Not a member of this organization'` (was the union message)
- **Non-member of project**: `403 'Not a member of this project'`
- **Permission deny**: `403 'Permission denied: requires <resource>:<action>'` (unchanged)
- **Missing scope on guarded route**: `400 'projectMemberGuard requires :orgId and :projectId in URL'`

Frontend `ModelSelect` surfaces failures as an inline `<Alert severity="warning">` + manual text-input fallback (no more silent collapse).

## 10. Testing strategy

1. `pnpm types` — repo-wide; must be clean.
2. `pnpm test` on `@tdsk/backend` and `@tdsk/admin` — unit suites.
3. `cd repos/integration && pnpm test` on live K8s (`tdsk dev start --clean`). New cases listed in §8.
4. Manual UI via Playwright MCP: login → org → project → sandboxes → edit sandbox → expect zero `/providers/.../models` errors and either successful 200 responses or a clear inline warning when intentionally denied.
5. Run the `accountability-reviewer` agent on the diff before any "done" claim.
6. Update memory: replace `project_rbac_overhaul_v2.md` reference in `MEMORY.md` with a new `project_rbac_overhaul_v2_real_completion.md` recording the actual closure.

## 11. Open questions

None. All design questions answered during brainstorming. Decisions: org-scope the models endpoint; single bundled PR.

## 12. Risk

- **Regression in API-key flows**: tightening `authorize` precedence and adding `orgAccessGuard` will break any caller that today relies on `auth.orgId` superseding the URL. The integration test pass + the cross-org probe should catch this; manual smoke of the threads SPA's sandbox monitor + the CLI session key flows is a good extra check.
- **Frontend prop threading churn**: adding `orgId` to `ModelSelect` ripples through several callers. Mitigated by reading from the existing org-route context (atom or route param) at each call site, not by drilling through props.
