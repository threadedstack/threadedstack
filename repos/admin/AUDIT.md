# Admin Repo Audit Report

**Date**: 2026-02-08
**Repo**: `repos/admin` (`@tdsk/admin`)
**Type**: SPA Dashboard (Vite 5, React 18, MUI 6, Jotai 2.16, React Router 7)
**Files Audited**: ~487 TypeScript/TSX source files
**Test Files**: 6 (47 tests total, 8 failing)

---

## Executive Summary

The admin repo is the primary user-facing SPA dashboard for the Threaded Stack platform. It manages organizations, projects, API keys, secrets, endpoints, providers, billing, and quotas. The repo is **structurally complete** — all major pages, components, services, and state management exist — but riddled with bugs at every layer. The previous AI agent produced code that compiles but frequently fails at runtime due to API contract mismatches, stale React closures, incomplete state management, and cross-repo type divergence.

**Total Issues Found: 270**

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 33 | App crashes, security holes, completely broken features |
| HIGH | 69 | Wrong behavior, data loss, broken CRUD operations |
| MEDIUM | 105 | UX problems, dead code, inconsistencies, perf issues |
| LOW | 63 | Style issues, typos, minor cleanup |

**Test Coverage: ~1.25%** (6 test files / 480 source files, 38 meaningful passing tests)

**Estimated Fix Effort**: 2-3 weeks for CRITICAL + HIGH issues

---

## Issues by Layer

### 1. Core Infrastructure (31 issues)

Entry point, routing, auth provider, state management, navigation.

#### CRITICAL (1)

| ID | File | Line | Description |
|----|------|------|-------------|
| C-I-1 | `Layout.tsx` | 18 | `<RedirectToSignIn />` rendered unconditionally alongside `<SignedIn>` — potential infinite redirect loop |

#### HIGH (4)

| ID | File | Line | Description |
|----|------|------|-------------|
| H-I-1 | `AuthProvider.tsx` | 30 | Context value typed as `TAuthCtx` but session can be undefined |
| H-I-2 | `selectors.ts` | 55-56 | `useDerivedState` returns a setter for a read-only atom |
| H-I-3 | `subscriptions.ts` | 4 | `paymentPlansState` initialized as `undefined` but reset to `[]` |
| H-I-4 | `user.ts` | 4 | `defUser` typed as `User` but assigned `undefined` |

#### MEDIUM (11)

Route anonymous components on every render (`Routes.tsx`), `nav.ts` regex no-op, query string leaks across navigations, empty orgs `{}` is truthy in `OrgsProvider`, dead route enum entries (`ApiTokens`, `Auth`), contexts created but never consumed via `useContext`, `useProjectsState` missing deps.

#### LOW (8)

`console.log` for errors, empty constructors, Provider naming conflicts, minor style issues.

---

### 2. API Services Layer (41 issues)

The `services/` directory: `api.ts` (base), 14 entity API classes, `nav.ts`, `auth.ts`, `storage.ts`, `query.ts`.

#### CRITICAL (7)

| ID | File | Line | Description |
|----|------|------|-------------|
| C-S-1 | `subscriptionsApi.ts` | cancel() | Wrong HTTP method (POST) AND wrong path (`/cancel` vs `/current`) — cancel subscription completely broken |
| C-S-2 | `quotasApi.ts` | check() | `orgId` not in URL path — backend reads from `req.params`, not body |
| C-S-3 | `domainsApi.ts` | update() | Uses PUT — backend expects PATCH, and no PATCH method exists in client |
| C-S-4 | `usersApi.ts` | removeFromOrg() | Sends `userId` where backend expects `roleId` — wrong user removed |
| C-S-5 | `usersApi.ts` | updateRole() | Sends `userId` where backend expects `roleId` — wrong role updated |
| C-S-6 | `usersApi.ts` | me() | Path goes through `/_/` prefix but backend has `/auth/me` at proxy level, not admin prefix |
| C-S-7 | `api.ts` | FormData | Form data sends with `Content-Type: application/json` header — breaks multipart uploads |

#### HIGH (10)

| ID | File | Description |
|----|------|-------------|
| H-S-1 | `projectsApi.ts` | `get()`/`create()`/`update()` crash when `resp.data` is undefined on error |
| H-S-2 | `subscriptionsApi.ts` | `current()` crash when `resp.data` is undefined |
| H-S-3 | `subscriptionsApi.ts` | `plans()` crash when `resp.data` is undefined |
| H-S-4 | `projectsApi.ts` | `list()` returns undefined on error (no fallback) |
| H-S-5 | `projectsApi.ts` | `delete()` wrong error message says "update" instead of "delete" |
| H-S-6 | `api.ts` | `deepMerge` of `this.#config` with undefined on first call |
| H-S-7 | `api.ts` | `bearer()` mutates shared singleton state (race condition) |
| H-S-8 | `api.ts` | `get()` method double-wraps in limbo |
| H-S-9 | `api.ts` | `validateUrl` imported but never called |
| H-S-10 | `api.types.ts` | No PATCH method in `EAPIMethod` enum |

#### MEDIUM (16), LOW (8)

Dead utilities, missing cache invalidation, inconsistent error handling, unused query service, no retry logic.

---

### 3. Actions Layer (46 issues)

The `actions/` directory: api/ (network calls) and local/ (state mutations) for 17 entity domains.

#### CRITICAL (5)

| ID | File | Description |
|----|------|-------------|
| C-A-1 | `updateOrgRole` | Passes `userId` where service expects `roleId` |
| C-A-2 | `removeFromOrg` | Passes `userId` where service expects `roleId` |
| C-A-3 | `signout` | Does not reset orgs, projects, secrets, apiKeys, endpoints, functions, providers state |
| C-A-4 | `deleteProject` | Does not check or unset `activeProjectId` — stale active project after deletion |
| C-A-5 | `deleteDomain` | Unconditionally removes domain from state regardless of API success/failure |

#### HIGH (12)

`signout` ignores return value, `initAuth` missing error handling, `init()` is a no-op stub, barrel `actions/index.ts` missing 8 entity module exports, `fetchSecrets`/`fetchProviders`/`fetchApiKeys`/`fetchFunctions`/`fetchConfigs` replace entire state (loses other scopes), `unsetActiveProject` resets ALL projects state, no error handling in `fetchDomain`.

#### MEDIUM (18), LOW (11)

Pattern inconsistencies, missing CRUD ops, no race condition protection, no optimistic updates.

---

### 4. Components Layer (56 issues)

~120 component files across Login, Sidebar, Header, Orgs, Projects, Endpoints, Functions, Agents, AI, Billing, Users, Roles, Domains, Settings, Secrets, Providers.

#### CRITICAL (8)

| ID | File | Line | Description |
|----|------|------|-------------|
| C-C-1 | `CreateOrgDrawer.tsx` | 30 | Organization name validated but trimmed AFTER validation — whitespace-only names pass |
| C-C-2 | `EndpointDrawer.tsx` | 146-153 | `onValidate` overwrites user edits — the handler replaces `proxyMethod` from raw state, discarding user's selection |
| C-C-3 | `FunctionDrawer.tsx` | 140 | `MonacoEditor onChange` never fires — `onChange` prop passed but Monaco wrapper uses `onMount` callback, code changes never saved |
| C-C-4 | `EndpointsTable.tsx` | 141-146 | Delete button calls `onDeleteEndpoint(endpoint.id!)` with non-null assertion — crashes if `id` is undefined |
| C-C-5 | `Agents/AgentDrawer.tsx` | 92-93 | `provider` state initialized from `agent.provider` but `selectedSecrets` reads `agent.secrets?.map(s => s.id)` — if secrets have no `id`, produces `[undefined]` array |
| C-C-6 | `Users/Users.tsx` | 80 | `user.first.toLowerCase()` — `first` is a phantom field not in DB, crashes on undefined |
| C-C-7 | `Endpoints/EndpointDrawer.tsx` | 66-68 | Nested endpoint form state can become stale when switching between endpoints without unmounting |
| C-C-8 | `Endpoints/Envs.tsx` | 68-69 | Help text renders `{ } and { }` instead of `{{secret-name}}` syntax |

#### HIGH (14)

GitLab login button not mapped in `LoginBtns`, copy-paste type errors (`TGithubButton` in GitlabBtn and GoogleBtn), `useCallback` missing `onClick` in deps, `useAvatar` missing `user?.image` in deps, `ToolItem` null guard missing, duplicate styled components across Sidebar/Header, `CreateProjectDrawer` missing org selector (always errors), `setRemovingUser(undefined)` with `User | null` state, `console.log` left in production, deprecated `InputProps` in MUI 6, `EditRoleDrawer` collapses all non-admin roles to `viewer`, `EndpointDrawer` async validation uses fragile `setTimeout(0)` race condition.

#### MEDIUM (22), LOW (12)

Empty type definitions, no error boundaries, missing `React.memo`, localStorage without try/catch, forms using button click instead of form `onSubmit`, missing accessibility labels, style inconsistency, no pagination for large lists, unused state variables.

---

### 5. Pages Layer (43 issues)

42 files across 12 page directories + route definitions.

#### CRITICAL (6)

| ID | File | Line | Description |
|----|------|------|-------------|
| C-P-1 | `Billing.tsx` | 203-210 | `plans.map()` crashes when `paymentPlansState` is `undefined` — the null guard uses `?.length === 0` which is `false` for undefined, falling through to `.map()` |
| C-P-2 | `Billing.tsx` | 104-122 | `onUpgrade` never resets `upgradeLoading` on error — loading spinner permanent after checkout failure |
| C-P-3 | `Billing.tsx` | 118 | `data.url` accessed without null check after checkout — crashes if API returns `null` |
| C-P-4 | `OrgApiKeys.tsx` | 1-313 | **Dead page** — fully implemented 313-line component with no route, no nav link, completely unreachable |
| C-P-5 | `ProjectAI.tsx` | 1-76 | **Dead page** — duplicates `ProjectThreads.tsx` exactly, no route points to it |
| C-P-6 | `Billing.tsx` | 49-68 | Infinite re-render loop on checkout return — `useEffect` depends on `[searchParams, setSearchParams]`, mutates searchParams inside |

#### HIGH (11)

Untyped `catch` blocks in Profile/OrgSettings, stale closure on `localUser`, `RedirectToSignIn` without `SignedOut` wrapper, `Page.tsx` shows loading spinner for empty `init()`, dead `configTypeFilter` state, config table shows literal "TODO: config.data", both Provider pages are TODO stubs, Settings page is TODO stub with active route, `ProjectAgents` filters by `orgId` instead of `projectId`, `loadData` used before definition, `ProjectsLoader` renders both `Outlet` and `children`.

#### MEDIUM (16), LOW (10)

Missing barrel exports, duplicate Login.styles.tsx, dead route enum values, Home/Orgs page duplication, no state cleanup on navigation, pages returning null without error state.

---

### 6. Hooks, Utils, Types, Constants, Theme & Config (53 issues)

88 files across hooks, utils, types, constants, theme, and build config.

#### CRITICAL (5)

| ID | File | Line | Description |
|----|------|------|-------------|
| C-H-1 | `useEndpointForm.ts` | 25-38 | Ref-in-dependency-array causes broken validation — `validateTriggerRef.current` in useEffect deps doesn't trigger re-renders |
| C-H-2 | `useLocalSearch.ts` | 30-33 | Missing `useEffect` dependencies cause stale closures — `onSearch` and `query` not in deps |
| C-H-3 | `objToQuery.tsx` | 1-72 | `.tsx` extension for pure utility (no JSX), duplicates `@keg-hub/jsutils/objToQuery` |
| C-H-4 | `envs.ts` | 10-13, 26-27 | `ensureEnv` throws at import time — crashes entire app if env not set, including `TDSK_AUTH_JWKS` which is never used |
| C-H-5 | `useOrgUsersList.ts` | 12 | `useState<string>(undefined)` type mismatch |

#### HIGH (14)

Duplicate `getInitials` functions (text vs user), incomplete barrel exports (hooks, utils, constants), `.tsx` extensions without JSX, `AllAuthRoles` missing `owner` and `member` roles (2 of 5 roles can't be assigned through UI), `getRoleColor` missing `owner` case, `useEndpoints` loading state never resets on re-fetch, `genFormData` doesn't handle null/undefined/File/Blob, unused `CustomTheme` type, dead `TUser` type, unused `GlobalStyles` props, unsafe type narrowing in `ApiError`, `loadUsers` missing from useEffect deps.

#### MEDIUM (22), LOW (12)

Stale closures in search, redundant deps, duplicate filtering, `err.message` without null checks, `new URL()` throwing, dead code (authHeader, TDSK_POSTHOG_*, SettingsStorageKey), file extension issues, database in vite config.

---

### 7. Test Coverage (~1.25%)

| Category | Total Files | Files With Tests | Coverage |
|----------|-------------|------------------|----------|
| actions/ | 96 | 4 | 4.2% |
| components/ | ~155 | 0 | 0% |
| hooks/ | ~27 | 0 | 0% |
| pages/ | ~45 | 0 | 0% |
| services/ | 22 | 0 | 0% |
| state/ | 20 | 0 | 0% |
| utils/ | 17 | 1 (placeholder) | ~0% |
| constants/ | 10 | 1 | 10% |
| **TOTAL** | **~480** | **6** | **~1.25%** |

**Test Results**: 47 total, 39 passing, 8 failing

**8 Failing Tests** (all in `nav.test.tsx`):
- Tests expect a `global` nav section that was never implemented
- Tests expect 7 org nav items but actual has 7 different ones (Domains instead of AI)
- Tests expect 6 project nav items but actual has 8 (added Agents, Threads, Domains)
- Root cause: tests written against a spec that diverged from implementation

**Placeholder Test**: `genFormData.test.ts` contains `expect(true).toBe(true)` — no actual function testing.

**Zero-Test Critical Areas**:
- `services/api.ts` (core HTTP client)
- `services/auth.ts` (authentication)
- `state/accessors.ts` (all Jotai state)
- `actions/auth/` (sign in/out/init)
- `actions/subscriptions/` (billing)
- `actions/secrets/` and `actions/apiKeys/` (security-sensitive)
- All 155+ components and 45 pages

---

### 8. Cross-Repo Integration Issues

Issues where admin interacts incorrectly with other repos (domain, backend, proxy, database).

#### CRITICAL (5)

| ID | Description |
|----|-------------|
| CR-C-1 | `subscriptionsApi.cancel()` sends POST to `/subscriptions/cancel` — backend expects DELETE to `/subscriptions/current` |
| CR-C-2 | `usersApi.removeFromOrg()` and `updateRole()` send `userId` — backend expects `roleId` (from roles table) |
| CR-C-3 | `usersApi.me()` uses `/_/auth/me` path — proxy handles `/auth/me` directly, not through admin prefix |
| CR-C-4 | `domainsApi.update()` sends PUT — backend only has PATCH handler |
| CR-C-5 | `quotasApi.check()` sends orgId in body — backend reads from URL params |

#### HIGH (8)

| ID | Description |
|----|-------------|
| CR-H-1 | Admin role UI only offers `viewer`, `admin`, `super` — missing `owner` and `member` from domain's 5-role hierarchy |
| CR-H-2 | `User.first`/`User.last` used in search/display — these are phantom fields not in database schema |
| CR-H-3 | API error responses lose original HTTP status code — `api.ts` catch handler hardcodes 400 |
| CR-H-4 | Auth state may never populate from backend — `usersApi.me()` is broken (CR-C-3) |
| CR-H-5 | `@tdsk/database` listed as dependency but never imported — pulls server-side deps into frontend |
| CR-H-6 | Backend list endpoints return all records ignoring query params — admin does client-side filtering |
| CR-H-7 | `TRequest` generics swapped in domain types — cascades to admin type definitions |
| CR-H-8 | `Agent.agentId` is a phantom field (domain model has it, DB doesn't) — admin sends it in API calls |

---

## Feature Completeness

### Fully Implemented

| Feature | Pages | Components | Services | Actions | Status |
|---------|-------|------------|----------|---------|--------|
| Auth (login/logout) | Login, Layout | Login buttons, AuthProvider | auth.ts | auth/local | Working (OAuth via Neon) |
| Organizations CRUD | Orgs, Org, OrgSettings | OrgCard, CreateOrgDrawer | orgsApi | orgs/ | Mostly working |
| Projects CRUD | Projects, Project, ProjectSettings | ProjectCard, CreateProjectDrawer | projectsApi | projects/ | **Broken** (no org selector in create drawer) |
| Endpoints | ProjectEndpoints | EndpointsTable, EndpointDrawer | endpointsApi | endpoints/ | Partially working |
| Functions | ProjectFunctions | FunctionCard, FunctionDrawer | functionsApi | functions/ | **Broken** (Monaco onChange never fires) |
| Secrets | OrgSecrets, ProjectSecrets | Secrets component | secretsApi | secrets/ | Working |
| Providers | OrgProviders, ProjectProviders | Providers component | providersApi | providers/ | Working |
| Users | OrgUsers | Users, UserCard, InviteUserDrawer | usersApi | users/ | **Broken** (roleId/userId mismatch) |
| Billing | Billing | PlanCard, CurrentPlan, QuotaUsage | subscriptionsApi, quotasApi | subscriptions/, quotas/ | **Broken** (plans crash, cancel broken) |
| AI/Agents | ProjectAgents, ProjectThreads | AgentDrawer, ThreadsTab, MessagesTab, AssetsTab | agentsApi, threadsApi, messagesApi, assetsApi | agents/, threads/, messages/, assets/ | Partially working |
| Domains | OrgDomains, ProjectDomains | DomainDrawer | domainsApi | domains/ | **Broken** (update uses PUT, backend expects PATCH) |

### Not Implemented (TODO Stubs)

| Feature | File | Status |
|---------|------|--------|
| Settings page | `pages/Settings/Settings.tsx` | Routed, shows "TODO" text |
| Provider pages | `pages/Providers/Provider[s].tsx` | Dead files, no routes |
| API Keys page | `pages/Orgs/OrgApiKeys.tsx` | Fully built but no route (dead code) |
| Asset download | `components/AI/AssetsTab.tsx:130` | TODO comment |
| Thread navigation | `components/AI/ThreadsTab.tsx:153` | TODO comment |
| Permission checks | `components/Users/InviteUserDrawer.tsx:20` | TODO comment |

---

## Security Issues

| ID | Severity | Description |
|----|----------|-------------|
| SEC-1 | HIGH | SSL private keys displayed in plaintext text inputs (DomainDrawer) — no masking |
| SEC-2 | HIGH | No permission checks before invite/role operations — any user can invite/change roles |
| SEC-3 | MEDIUM | `console.log` in production leaks asset data (AssetsTab:131) |
| SEC-4 | MEDIUM | DangerZoneCard has no confirmation before destructive actions |
| SEC-5 | LOW | External links missing `noreferrer` attribute |

---

## Test Plan

### Phase 1: Fix Broken Tests (1 day)

1. Fix 8 failing nav tests to match current implementation
2. Replace `genFormData` placeholder with real tests
3. Establish baseline: all tests green before adding new ones

### Phase 2: Critical Business Logic (3-5 days)

**P0 — Security**:
- Test `signout` resets ALL state atoms (not just user)
- Test auth flow: init, signin, signout, session expiry
- Test permission checks on invite/role operations

**P1 — Core Services**:
- Test `api.ts` (BaseApi): fetch wrapper, error handling, bearer token, form data
- Test all entity API services: correct HTTP methods, paths, body serialization
- Test `subscriptionsApi`: cancel uses DELETE, checkout flow, plan listing
- Test `quotasApi`: check sends orgId in URL, limit retrieval

**P2 — State Management**:
- Test `accessors.ts`: all getters/setters/resetters
- Test `selectors.ts`: derived state hooks return correct values
- Test state cleanup on logout

### Phase 3: Actions (2-3 days)

- Test all CRUD actions for: orgs, projects, users, secrets, apiKeys, endpoints, functions, agents, domains
- Test error propagation: API errors surface to callers
- Test state mutation: correct atoms updated after API calls
- Test `deleteProject` unsets active project
- Test `fetchSecrets`/`fetchProviders` don't clobber unrelated scopes

### Phase 4: Utility Functions (1-2 days)

Pure functions — easiest to test:
- `buildRoute.ts` — route template resolution with params
- `getInitials.ts` — name parsing edge cases
- `pluralize.ts` — English pluralization rules
- `validateUrl.ts` — URL validation
- `genFormData.ts` — object to FormData conversion
- `mappers.ts` — endpoint state to config transformation
- `validators.ts` — endpoint form validation
- `kvs.ts` — key-value transforms
- `ApiError.ts` — error class construction

### Phase 5: Component Smoke Tests (3-5 days)

Render tests with mocked providers:
- Login page renders OAuth buttons based on env config
- Layout redirects unauthenticated users
- Billing page handles undefined plans without crashing
- CreateProjectDrawer shows org selector
- EndpointDrawer validates form fields
- Sidebar navigation shows correct items per context

### Phase 6: Integration Tests (2-3 days)

End-to-end action flows:
- Create org → navigate → create project → navigate to project
- Edit endpoint → save → verify state updated
- Change user role → verify API receives roleId (not userId)
- Checkout flow → redirect → return → verify subscription loaded

**Total Estimated Test Effort**: 12-19 days

---

## Priority Fix Order

### Week 1: Show-Stoppers

1. **Fix logout state leak** (C-I-3, C-A-3, SEC-1) — reset all Jotai atoms on signout
2. **Fix subscription cancel** (C-S-1, CR-C-1) — change to DELETE `/subscriptions/current`
3. **Fix roleId/userId mismatch** (C-S-4, C-S-5, C-A-1, C-A-2, CR-C-2) — send roleId to backend
4. **Fix Billing crash** (C-P-1) — guard `plans?.map()` with fallback to empty array
5. **Fix Billing loading stuck** (C-P-2) — reset loading on error path
6. **Add PATCH method** (H-S-10, C-S-3, CR-C-4) — add to `EAPIMethod` and `ApiService`
7. **Fix `usersApi.me()` path** (C-S-6, CR-C-3) — use `/auth/me` not `/_/auth/me`
8. **Fix `quotasApi.check()` path** (C-S-2, CR-C-5) — put orgId in URL
9. **Fix nav.login()** (C-I-2) — use actual login path, not parameterized route template
10. **Fix Layout auth guard** (C-I-4) — wrap `RedirectToSignIn` in `<SignedOut>`

### Week 2: Core Functionality

11. Fix form data Content-Type header (C-S-7)
12. Fix `projectsApi` null guard on error responses (H-S-1 through H-S-4)
13. Fix `CreateProjectDrawer` — add org selector or accept orgId prop (H-C-8)
14. Fix `MonacoEditor` onChange (C-C-3) — functions can't be saved
15. Fix `AllAuthRoles` — add `owner` and `member` roles (H-H-6, CR-H-1)
16. Fix `User.first`/`User.last` phantom field usage (C-C-6, CR-H-2)
17. Fix `ensureEnv` import-time crash for unused JWKS (C-H-4)
18. Fix `deleteProject` unset active project (C-A-4)
19. Fix `fetchSecrets`/`fetchProviders` state clobbering (H-A-8, H-A-9)
20. Add `Toaster` to render tree (H-I-1)

### Week 3: Polish & Tests

21. Route `OrgApiKeys` page (C-P-4) — add route and nav entry
22. Remove dead pages (ProjectAI, Provider stubs)
23. Fix broken nav tests (8 failures)
24. Add test coverage for critical paths (Phase 2 of test plan)
25. Fix useEffect dependency arrays across hooks
26. Remove dead code and unused exports
27. Standardize event handler naming (`on` prefix per convention)
28. Add error boundaries around page sections
29. Remove `@tdsk/database` from admin dependencies
30. Fix remaining MUI v6 deprecations

---

## Architecture Observations

### What Works Well

- **Jotai state management** — atomic state is well-organized with accessors/selectors pattern
- **Lazy loading** — all pages use `React.lazy()` + `Suspense` for code splitting
- **Service singleton pattern** — API services are well-structured
- **Component co-location** — styles, types, and logic grouped per component
- **Domain model reuse** — consistent use of `@tdsk/domain` classes
- **Path aliases** — `@TAF/*` imports are clean and consistent

### What Needs Redesign

- **State cleanup on navigation** — no state reset between orgs/projects, stale data flashes
- **Error handling** — no consistent error boundary strategy, catch blocks vary wildly
- **API response handling** — no standardized null guard pattern for `resp.data`
- **Form validation** — broken ref-based trigger mechanism, needs callback pattern
- **Role management** — incomplete RBAC model (2 of 5 roles missing from UI)
- **Barrel exports** — most `index.ts` files are incomplete or dead code

### Dependencies

| Package | Version | Status |
|---------|---------|--------|
| react | 18.3.1 | OK |
| react-router | 7.1.1 | OK |
| @mui/material | 6.1.2 | Using deprecated Grid v1 API |
| jotai | 2.16.1 | OK |
| @neondatabase/neon-js | 0.1.0-beta.21 | Beta — may have breaking changes |
| vite | 5.0.12 | OK |
| @tdsk/database | workspace:* | **Unused** — remove |
| express-rate-limit | (proxy) | Not relevant to admin |

---

*Report generated from 8 parallel audit agents covering: core infrastructure, API services, actions, components, pages, hooks/utils/types/constants, test coverage, and cross-repo integration.*
