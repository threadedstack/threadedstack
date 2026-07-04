## TASKS

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


## Cross-Repo

### [P1] Divergent ApiService implementations (admin vs threads)

* **Repos**: threads, admin, domain
* **Key files**: `repos/threads/src/services/api.ts` (line 27), `repos/admin/src/services/api.ts` (line 13), `repos/domain/src/services/api/apiService.ts`
* Admin extends `@tdsk/domain` ApiService (`ApiService extends DomainApiService`) with proper response envelope unwrapping. Threads has a completely independent standalone implementation (`export class ApiService {`) that does NOT extend the domain class — its own `#doFetch`, `#ext`, `bearer`, error handling all duplicate domain logic using local `EAPIMethod`/`TApiReq` types. Bug fixes in one don't propagate
* **Fix**:
  1. Have threads `ApiService` extend domain `ApiService` like admin does
  2. Remove duplicated fetch/retry/bearer logic from threads
* **Files**:
  * `repos/threads/src/services/api.ts` — extend domain ApiService
  * `repos/domain/src/services/api/apiService.ts` — may need minor adjustments for threads use case

### [P2] Duplicated types and utilities between admin and threads

* **Repos**: threads, admin, domain
* **Key files**: `repos/threads/src/types/api.types.ts` (lines 4-16), `repos/admin/src/types/api.types.ts` (lines 13-66), `repos/threads/src/utils/api/objToQuery.tsx`
* Both define their own `TApiRes`/`EAPIMethod`-style types with different shapes (threads: `{data?, error?: ApiError}`; admin: `{data?, ok?, status?, error?: ApiError|Exception|Error}`) — admin has partially migrated to `@tdsk/domain` types (imports `TApiRequest`/`Exception`/`objToQuery` from domain) but still keeps its own duplicated `TApiRes`/`TApiReq`. Threads has not migrated at all and still has a local `objToQuery.tsx` (`.tsx` extension, no JSX) instead of importing from `@tdsk/domain`
* **Fix**:
  1. Remove duplicate types from both SPAs, import shared types from `@tdsk/domain`
  2. Delete threads `objToQuery.tsx`, import from `@tdsk/domain` instead
  3. Standardize enum naming (`EApiMethod` everywhere)
* **Files**:
  * `repos/threads/src/types/api.types.ts` — remove duplicates
  * `repos/admin/src/types/api.types.ts` — remove duplicates
  * `repos/threads/src/utils/api/objToQuery.tsx` — delete, update imports
  * `repos/domain/src/types/` — ensure shared types cover both SPAs

### [P2] @keg-hub/parse-config version split (2.1.0 vs 2.2.0)

* **Repos**: all
* Domain, database, logger, proxy, cli, integration are on 2.2.0; admin, agent, backend, threads, website are on 2.1.0. Config loading behavior could diverge at the domain-backend boundary
* **Fix**:
  1. Sync all repos to 2.2.0 via `pnpm sync` or manual package.json updates
* **Files**:
  * Multiple `repos/*/package.json` files

### [P2] TSBConnectResp type missing backend fields

* **Repos**: domain, backend, threads
* **Key files**: `repos/domain/src/types/sandbox.types.ts` (lines 336-345), `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` (lines 153-192)
* The domain type `TSBConnectResp` is missing `port: number` and `initError?: string` fields that the backend actually returns (`connectSandbox.ts` computes `initError` at lines 153-167 and returns both `port: 2222` and a conditional `initError` at lines 183/190). TypeScript won't catch usages, and `initError` from failed init scripts is silently dropped — `repos/threads/src/services/sessionService.ts` (lines 76-80) destructures `subdomain, shellToken, instanceId, portUrlTemplate, workdir` from the connect response but never reads `initError` or `port`
* **Fix**:
  1. Add `port: number` and `initError?: string` to `TSBConnectResp` in domain types
  2. Update threads session service to surface `initError` to users
* **Files**:
  * `repos/domain/src/types/sandbox.types.ts` — add missing fields
  * `repos/threads/src/services/sessionService.ts` — handle initError

---

## Threads

### [P2] GUI state Maps cloned at frame rate during streaming

* **Repos**: threads
* **Key files**: `repos/threads/src/actions/gui/setEngineAst.ts` (lines 10-12), `repos/threads/src/actions/gui/appendFeedEvents.ts` (lines 16-18)
* These actions are called at `requestAnimationFrame` frequency during terminal streaming. Each call clones the entire Map (`new Map(asts)` / `new Map(feeds)`) to update one entry. With multiple sessions open, every frame copies all session data. Creates GC pressure and frame drops on lower-powered devices
* **Fix**:
  1. Use per-session atoms (a Map of atoms rather than an atom of Maps) so updating one session doesn't clone the entire Map
  2. Alternatively, use `immer` patches or atom families
* **Files**:
  * `repos/threads/src/actions/gui/setEngineAst.ts` — refactor to per-session atoms
  * `repos/threads/src/actions/gui/appendFeedEvents.ts` — same refactor

### [P2] Editor atom defaults vs atomWithReset initial values differ

* **Repos**: threads
* **Key files**: `repos/threads/src/state/editor.ts` (lines 16-37)
* Each atom is initialized with a fresh `new Map()`/`new Set()` (e.g. `fileTreeDataState`, `expandedFoldersState`, `loadingFoldersState`, `fileContentCacheState`, `savingFilesState`), while the named defaults (`defFileTreeData`, `defExpandedFolders`, etc.) are separate instances. `useResetAtom` and manual accessor resets produce different object identities, causing unnecessary re-renders
* **Fix**:
  1. Share the same instance: `atomWithReset(defFileTreeData)` instead of `atomWithReset(new Map())`
* **Files**:
  * `repos/threads/src/state/editor.ts` — use def* instances as atomWithReset initial values

### [P2] OrgSelector/ProjectSelector items not memoized

* **Repos**: threads
* **Key files**: `repos/threads/src/components/Breadcrumbs/OrgSelector.tsx` (lines 33-37), `repos/threads/src/components/Breadcrumbs/ProjectSelector.tsx` (lines 42-46)
* The `items` array is recreated via `.map()` on every render, producing a new reference each time. `SelectorMenu` re-renders unnecessarily on every parent render
* **Fix**:
  1. Wrap in `useMemo(() => orgs.map(...), [orgs])` and `useMemo(() => projects.map(...), [projects])`
* **Files**:
  * `repos/threads/src/components/Breadcrumbs/OrgSelector.tsx` — add useMemo
  * `repos/threads/src/components/Breadcrumbs/ProjectSelector.tsx` — add useMemo

---

## Admin

### [P1] sendMessage silently drops failed file uploads

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/chat/useAgentChat.ts` (lines 225-239)
* When a file upload fails (`resp.data` is falsy), the failure is silently ignored — only successful uploads push into `fileAttachments`, with no `else` branch checking `resp.error` and no toast import/call anywhere in the file. The message sends with only successfully uploaded files and users get no indication which files were or weren't attached
* **Fix**:
  1. Check `resp.error` after each upload
  2. Surface failure via toast notification with the failed file name
  3. Either abort the entire send or inform the user which files weren't attached
* **Files**:
  * `repos/admin/src/hooks/chat/useAgentChat.ts` — add error check and toast

### [P2] useLocalSearch stale closure in onSearch

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/components/useLocalSearch.ts` (lines 15-33)
* `onSearch` is not memoized and recreated every render. The `useEffect` (lines 30-33) only depends on `[props.items]`, missing `onSearch` and `onQuery`. When `props.items` changes, `onSearch` captures stale `items` state and `query` value
* **Fix**:
  1. Memoize `onSearch` with `useCallback`
  2. Add `onSearch` to the effect dependency array, or call `onQuery` directly inside the effect with `props.items`
* **Files**:
  * `repos/admin/src/hooks/components/useLocalSearch.ts` — memoize and fix deps

### [P2] useSandboxForm useEffect missing dependencies

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/sandboxes/useSandboxForm.ts` (lines 327, 424-431)
* `populateFromSandbox` (defined line 327) is a local function (not memoized) calling 20+ state setters, omitted from the effect dependency array (`useEffect(..., [sandbox, projectId])`). If the `sandbox` object identity changes each render, the effect fires every time causing a cascade of re-renders
* **Fix**:
  1. Memoize `populateFromSandbox` with `useCallback` and include in deps
  2. Compare `sandbox.id` rather than the full object reference to prevent unnecessary re-runs
* **Files**:
  * `repos/admin/src/hooks/sandboxes/useSandboxForm.ts` — memoize and fix dep comparison

### [P2] await safeFetch() misleading pattern in loaders

* **Repos**: admin
* **Key files**: `repos/admin/src/routes/loaders.ts` (lines 87-94 definition, 120, 141, 148-149 call sites)
* `safeFetch` is defined as `fn()?.catch(...)` with no `return`, so it returns void (undefined). Some callers `await` it (e.g. line 141), giving the false impression the loader waits for data. Others correctly fire-and-forget (e.g. lines 120, 148-149). The inconsistency is pervasive across the file and creates confusion and risk of breakage if `safeFetch` is later changed to return a promise
* **Fix**:
  1. Remove all `await` keywords before `safeFetch()` calls to make fire-and-forget intent unambiguous
* **Files**:
  * `repos/admin/src/routes/loaders.ts` — remove await from safeFetch calls

### [P3] useAsyncAction never sets error state

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/components/useAsyncAction.ts` (lines 9-16)
* The hook exposes `error` state and `setError`, but `run()` is `try { return await fn() } finally { setLoading(false) }` — there is no `catch` block at all. Callers relying on `useAsyncAction().error` will always see `null`
* **Fix**:
  1. Add a `catch` block in `run()` that calls `setError(err.message)` and either re-throws or returns undefined
* **Files**:
  * `repos/admin/src/hooks/components/useAsyncAction.ts` — add catch block

---

## Backend

### [P2] Escalation layer missing — no `escalations` table or `escalate` agent tool

* **Repos**: backend, database, agent
* **Key files**: `repos/database/src/schemas/` (no `escalations.ts`), `repos/agent/src/tools/tools.ts` (no escalate tool), `repos/backend/src/services/scheduler/executor.ts`
* Per `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md` §4.8, the autonomous agent needs an escalation layer: on an unrecoverable blocker it should self-remediate (retry/provider failover — already implemented for AI providers), then write a durable escalation record, notify a human (email/GitHub issue), and pause only the affected schedule cadence. None of this exists today — there is no `escalations` schema/table, no `escalate` tool for the agent to call, and a scheduler circuit-breaker trip (`consecutiveErrors` reaching `maxConsecutiveErrors`) currently auto-disables a schedule silently with no notification to anyone
* **Fix**:
  1. Add `repos/database/src/schemas/escalations.ts` (`orgId`, `agentId`, `scheduleId?`, `threadId?`, `severity`, `message`, `status`) and a corresponding database service
  2. Add a backend endpoint that writes an escalation record and sends an email via the existing `EmailService` (`app.locals.email.send`)
  3. Add an `escalate` agent tool in `repos/agent/src/tools/tools.ts` that POSTs to the new endpoint
  4. Wire the scheduler's circuit-breaker trip to call the same escalation path instead of silently auto-disabling
* **Files**:
  * New: `repos/database/src/schemas/escalations.ts`
  * New: `repos/database/src/services/escalation.ts`
  * New: `repos/backend/src/endpoints/agents/escalate.ts` (or equivalent endpoint)
  * `repos/agent/src/tools/tools.ts` — add `escalate` tool
  * `repos/backend/src/services/scheduler/executor.ts` — wire breaker-trip notification

---

## Proxy

### [P1] Echo endpoint leaks all headers with no production guard

* **Repos**: proxy
* **Key files**: `repos/proxy/src/endpoints/echo.ts` (lines 11-18), `repos/proxy/src/constants/values.ts` (line 7), `repos/proxy/src/middleware/setupEndpoints.ts` (line 12)
* The `/echo` endpoint echoes all request headers including `Authorization` and cookies. It is registered unconditionally in `setupEndpoints.ts` and listed as a `PublicRoute` (no auth required). The code comment warns "Do not enable in production" but there is no `NODE_ENV` (or any) runtime guard anywhere in `repos/proxy/src` — it is always registered regardless of environment. Note: PR #13 (`steward/proxy-echo-prod-guard`) is open with green CI and auto-merge armed but currently blocked on a rebase (`BEHIND` main) — this item stays open until that PR actually lands
* **Fix**:
  1. Add a guard: only register the route when `NODE_ENV !== 'production'` or behind a dedicated feature flag
  2. Alternatively, strip sensitive headers (`authorization`, `cookie`) before echoing
* **Files**:
  * `repos/proxy/src/endpoints/echo.ts` — add environment guard
  * `repos/proxy/src/constants/values.ts` — conditionally include in PublicRoutes

### [P2] CORS configuration allows wildcard origin

* **Repos**: proxy, backend
* **Key files**: `repos/proxy/src/middleware/setupServer.ts` (lines 18-24), `repos/backend/src/middleware/setupServer.ts` (lines 17-23)
* Both do `origin: origins.includes('*') ? '*' : origins` — if the `origins` config includes `*`, CORS allows any origin. Neither file sets `credentials: false` explicitly (the `cors` package defaults it to `false` when omitted, so this is a defense-in-depth gap rather than an active vulnerability today, but any future code path adding `credentials: true` alongside a wildcard origin would silently become exploitable)
* **Fix**:
  1. Avoid configuring `origins: ["*"]` in any environment
  2. Add `credentials: false` explicitly to the CORS config
* **Files**:
  * `repos/proxy/src/middleware/setupServer.ts` — add credentials: false
  * `repos/backend/src/middleware/setupServer.ts` — same fix

### [P2] Proxy-to-backend header validation silently skips if unconfigured

* **Repos**: backend
* **Key files**: `repos/backend/src/utils/auth/pxToBeHeader.ts` (lines 6-19)
* If `config.proxy.headerValue` is not configured, validation does an early `return` (line 8) with no error. This means if the shared secret is misconfigured or missing, the backend accepts requests from any source. An attacker reaching the backend directly could forge user identity headers
* **Fix**:
  1. Make the shared secret mandatory — throw an error at startup if `config.proxy.headerValue` is not set
* **Files**:
  * `repos/backend/src/utils/auth/pxToBeHeader.ts` — throw on missing config

---

## Sandbox

### [P1] Shell injection via KubeSandbox exec argument concatenation

* **Repos**: sandbox, backend
* **Key files**: `repos/sandbox/src/kube/kubeSandbox.ts` (lines 53-55, exec/execStreaming; line 152, evaluate), `repos/backend/src/endpoints/sandboxes/execInSandbox.ts` (lines 44-50)
* Command and args are concatenated into a single string passed to `sh -c` without shell escaping. An AI agent calling `shellExec({ command: "ls", args: ["; cat /etc/shadow"] })` gets full shell interpretation inside the pod. While blast radius is limited to the isolated pod, this can exfiltrate injected secrets (SSH password, provider API keys via env vars). `execInSandbox.ts` validates length/type/array-shape of command/args but never sanitizes shell metacharacters
* **Fix**:
  1. Pass command and args as separate elements in the K8s exec command array (avoiding shell interpretation): `this.client.runInPod(this.podName, [command, ...args])`
  2. Only use `sh -c` when shell features are explicitly needed (pipes, redirects)
  3. For cases requiring `sh -c`, shell-quote each argument individually
* **Files**:
  * `repos/sandbox/src/kube/kubeSandbox.ts` — refactor exec/evaluate to avoid sh -c
  * `repos/backend/src/endpoints/sandboxes/execInSandbox.ts` — validate or sanitize inputs

### [P1] Sandbox proxy may lack authentication

* **Repos**: backend
* **Key files**: `repos/backend/src/middleware/sandboxProxy.ts` (lines 18-51)
* The sandbox proxy middleware intercepts requests based on hostname pattern matching and forwards directly to pod IPs without any authentication check. If Caddy routes sandbox subdomain traffic directly to the backend (bypassing the auth proxy), these requests are unauthenticated. Anyone knowing the subdomain pattern could access services running in pods
* **Fix**:
  1. Add authentication/authorization checks in the sandbox proxy middleware before forwarding
  2. Or ensure Caddy configuration always routes sandbox subdomain traffic through the auth proxy
* **Files**:
  * `repos/backend/src/middleware/sandboxProxy.ts` — add auth check

### [P1] KubeSandbox file ops lack path traversal protection

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/kube/kubeSandbox.ts` (lines 67-111: readFile, writeFile, listDir, deleteFile, mkdir, fileExists)
* These methods accept arbitrary paths without validating for traversal (`../`), absolute paths outside the workspace, or symlink following. An AI agent could read/write/delete any file accessible to the `sandbox` user
* **Fix**:
  1. Validate paths in all ISandbox file methods to ensure they are within `DefaultWorkdir` or `DefaultTempdir`
  2. Reject paths containing `..` or starting outside allowed directories
* **Files**:
  * `repos/sandbox/src/kube/kubeSandbox.ts` — add path validation to all file methods

### [P2] runInPod unbounded output buffer (OOM)

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/kube/kubeClient.ts` (lines 214-262)
* The `runInPod` method accumulates ALL stdout and stderr chunks in memory without any size limit, and there is no timeout wrapping the underlying exec call. A command producing unbounded output (e.g., `yes`, `cat /dev/urandom`) would crash the backend process
* **Fix**:
  1. Add a maximum buffer size — truncate and resolve with partial result when exceeded
  2. Add an execution timeout that kills the K8s exec WebSocket
* **Files**:
  * `repos/sandbox/src/kube/kubeClient.ts` — add buffer limit and timeout

### [P2] SSH password in plaintext env var

* **Repos**: backend, sandbox
* **Key files**: `repos/backend/src/services/sandboxes/sandbox.ts` (lines 264-266 generation, 506-524 storage/recovery), `repos/sandbox/src/kube/podManifest.ts` (lines 171, 197 env injection; lines 247-260 buildPostStartScript)
* The SSH password (`TDSK_SSH_PASSWORD`) is injected as a plain-text environment variable into the pod via generic `extraEnv`. Any process running inside the pod can read it via `printenv` or `/proc/self/environ`. `buildPostStartScript` additionally re-exports every env var (including the password) into `/etc/profile.d`, a second plaintext exposure. Combined with the path traversal issue above, an AI agent could obtain SSH credentials
* **Fix**:
  1. Consider file-based secret mount (K8s Secret volume) instead of env var
  2. Or use token-based authentication that expires
* **Files**:
  * `repos/backend/src/services/sandboxes/sandbox.ts` — change credential injection method
  * `repos/sandbox/src/kube/podManifest.ts` — update pod spec

### [P3] Agent tool execution ignores AbortSignal

* **Repos**: agent
* **Key files**: `repos/agent/src/tools/tools.ts` (shellExec/readFile/writeFile etc., `_signal` param throughout)
* The sandbox tools accept an `_signal` (AbortSignal) parameter but never use it (`grep -n "signal\."` returns zero matches in the file). A `shellExec` call to a long-running command blocks the agent indefinitely with no way to cancel the underlying K8s exec operation. Confirmed still unaddressed after the recent task-delegation feature (commit `0bc78088`) touched this file for unrelated reasons
* **Fix**:
  1. Wire the `_signal` (AbortSignal) to cancel the underlying K8s exec operation
  2. Or add a configurable per-tool timeout
* **Files**:
  * `repos/agent/src/tools/tools.ts` — wire AbortSignal to sandbox operations

---

## Database

### [P1] User first/last columns queried but don't exist in database

* **Repos**: database, domain
* **Key files**: `repos/database/src/services/role.ts` (lines 118-124), `repos/database/src/schemas/users.ts`
* The `getProjectMembers` method queries the `user` relation with `first: true` and `last: true` in the columns projection. These columns do not exist on the `users` table (`id, name, email, image, role, banned, banReason, banExpires, emailVerified, createdAt, updatedAt`) — they are only computed properties on the `User` domain model. Drizzle will either produce a SQL error or silently return undefined
* **Fix**:
  1. Remove `first` and `last` from the column selection in `getProjectMembers`
  2. Let the domain `User` model synthesize `first`/`last` from `name` at construction time
* **Files**:
  * `repos/database/src/services/role.ts` — remove nonexistent column projections

### [P1] Provider brand nullable in DB, required in model

* **Repos**: database, domain
* **Key files**: `repos/database/src/schemas/providers.ts` (line 21), `repos/domain/src/models/provider.ts` (line 12)
* The providers schema defines `brand` without `.notNull()` — it's nullable. The Provider domain model types `brand` as non-optional (required). A provider created without a brand stores `null`, but TypeScript says it's always `TProviderBrand`
* **Fix**:
  1. Add `.notNull()` to the schema if brand should always be present, OR
  2. Make the model field optional: `brand?: TProviderBrand`
* **Files**:
  * `repos/database/src/schemas/providers.ts` — add .notNull() or
  * `repos/domain/src/models/provider.ts` — make brand optional

### [P2] Base update/delete have no orgId scoping

* **Repos**: database
* **Key files**: `repos/database/src/services/base.ts` (lines 154-171 update, 195-208 delete), `repos/database/src/services/thread.ts` (lines 26-56)
* The base service `update()` and `delete()` methods filter only by `id`, relying on controllers to validate org ownership. Entity IDs are 10-char nanoids — not a security boundary. Thread service `listByAgent()` and `listByUser()` also lack orgId filtering
* **Fix**:
  1. Add optional `orgId` parameter to base `update()` and `delete()` methods
  2. Add orgId filter to Thread `listByAgent()` and `listByUser()` methods
* **Files**:
  * `repos/database/src/services/base.ts` — add optional orgId to update/delete WHERE
  * `repos/database/src/services/thread.ts` — add orgId to listByAgent/listByUser

### [P2] Timestamp mode inconsistency across schemas

* **Repos**: database
* **Key files**: `repos/database/src/utils/schema/timestamps.ts`, `repos/database/src/schemas/users.ts` (lines 26-27), `repos/database/src/schemas/subscriptions.ts` (lines 26-27), `repos/database/src/schemas/invitations.ts` (lines 55-57)
* The base timestamps utility uses default mode (Date objects). But users, subscriptions, and invitations schemas use `mode: 'string'` (ISO strings). The domain model's `string | Date` union accommodates both, but downstream consumers handling dates may behave differently depending on which entity they receive
* **Fix**:
  1. Standardize all timestamps to the same mode (either all Date objects or all strings)
  2. Update domain model types to match the chosen mode
* **Files**:
  * `repos/database/src/schemas/users.ts` — standardize timestamp mode
  * `repos/database/src/schemas/subscriptions.ts` — standardize timestamp mode
  * `repos/database/src/schemas/invitations.ts` — standardize timestamp mode
  * `repos/database/src/utils/schema/timestamps.ts` — reference for standard mode

### [P3] Agent/Sandbox create() lacks transaction wrapping

* **Repos**: database
* **Key files**: `repos/database/src/services/agent.ts` (lines 346-375), `repos/database/src/services/sandbox.ts` (lines 302-338)
* Agent and sandbox creation perform insert + relation setup without a transaction. If the process crashes between step 1 and step 2, orphaned records remain. The manual cleanup in the catch block can itself fail silently (`.catch(() => {})`)
* **Fix**:
  1. Wrap the creation and relation setup in `this.db.transaction()`
  2. Match the pattern already used in `#upsertProviders` (agent.ts:182, sandbox.ts:565) which correctly uses transactions
* **Files**:
  * `repos/database/src/services/agent.ts` — wrap create in transaction
  * `repos/database/src/services/sandbox.ts` — wrap create in transaction

### [P1] No versioned SQL migrations — interactive `drizzle-kit push` is the only deploy path

* **Repos**: database, cli
* **Key files**: `repos/database/drizzle/` (only `meta/0000_snapshot.json` + `meta/_journal.json`, no committed `.sql` files), `repos/database/package.json` (`generate`/`migrate` scripts defined but unused), `repos/cli/src/tasks/db/` (only `dk`, `dup`, `pushSafe.ts` — no `generate`/`migrate` task)
* Per `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md` §13 (Risks), this is called out as the highest-severity blocker: "Destructive migration plus failed deploy equals irreversible state" since `drizzle-kit push` is interactive (requires manual confirmation) and there is no versioned SQL migration history. This blocks any future hands-free deploy and risks hanging or bricking a deploy on a destructive schema diff
* **Fix**:
  1. Generate and commit the first real versioned migration set via `drizzle-kit generate` (already scripted in `repos/database/package.json`)
  2. Add `repos/cli/src/tasks/db/generate.ts` and `repos/cli/src/tasks/db/migrate.ts` CLI tasks wrapping the existing `generate`/`migrate` package scripts, non-interactive
  3. Add an expand-migrate-contract discipline check (reject destructive `DROP` in the same migration as new additive columns) alongside the existing `pushSafe.ts` destructive-change guard
* **Files**:
  * `repos/database/drizzle/` — commit generated `.sql` migrations
  * New: `repos/cli/src/tasks/db/generate.ts`
  * New: `repos/cli/src/tasks/db/migrate.ts`

---

## Website

### [P3] Add Contact and About pages with footer links

* **Repos**: website
* **Key files**: `repos/website/src/components/Footer/MarketingFooter.tsx` (lines 31-32)
* The footer has "About" and "Contact" links under the "Company" section, but both point to `#` (placeholder). No corresponding pages exist under `repos/website/src/pages`
* **Fix**:
  1. Create `repos/website/src/pages/About.tsx` — company info, mission, team
  2. Create `repos/website/src/pages/Contact.tsx` — contact form or contact info
  3. Add routes for `/about` and `/contact` in the website router
  4. Update `MarketingFooter.tsx` lines 31-32 to point to `/about` and `/contact` respectively
* **Files**:
  * New: `repos/website/src/pages/About.tsx` — About page
  * New: `repos/website/src/pages/Contact.tsx` — Contact page
  * `repos/website/src/components/Footer/MarketingFooter.tsx` — update link targets
  * Website router file — add routes

---

## TSA

### [P2] Brittle ProxyWrapper binary resolution in `sshConfig.ts`

* **Repos**: tsa
* **Key files**: `repos/tsa/src/services/sync/sshConfig.ts` (lines 37-108 resolveTsaBin/ensureProxyWrapper), `repos/tsa/src/utils/tasks/spawnSsh.ts` (lines 6-12)
* `resolveTsaBin()` uses cascading strategies to locate the `tsa` binary via `process.argv` parsing, relative path probing, and cwd-based guessing, then string-slices the resolved path to derive `pkgRoot`. When any assumption breaks (different directory structure, symlinked binary, running from unexpected location), the wrapper script writes an incorrect `cd` target and SSH connections silently fail. Separately, `spawnSsh.ts` `buildProxyCommand()` has its own `process.argv`-based binary resolution that can diverge from `sshConfig.ts`. No shared resolution utility exists
* **Fix**:
  1. Consolidate binary resolution into a single shared utility (e.g., `repos/tsa/src/utils/resolveTsaBin.ts`) used by both `sshConfig.ts` and `spawnSsh.ts`
  2. Add a deterministic resolution strategy: check for `TDSK_TSA_BIN` env var first, then config file path, then compiled binary on PATH, then the current cascading fallbacks
  3. Remove `pkgRoot` string-slicing in `ensureProxyWrapper`: the wrapper should invoke `tsa proxy` by its resolved absolute path directly without needing to `cd` to a package root
  4. Have `spawnSsh.ts` `buildProxyCommand()` reuse the shared utility instead of its own `process.argv[0]`/`process.argv[1]` logic
  5. Update `repos/tsa/src/services/sync/sshConfig.test.ts` to cover new resolution paths
* **Files**:
  * `repos/tsa/src/services/sync/sshConfig.ts` — refactor `resolveTsaBin()` and `ensureProxyWrapper()` to use shared utility, remove `pkgRoot` string-slicing
  * `repos/tsa/src/utils/tasks/spawnSsh.ts` — replace `buildProxyCommand()` argv logic with shared utility
  * New: `repos/tsa/src/utils/resolveTsaBin.ts` — shared binary resolution utility
  * `repos/tsa/src/services/sync/sshConfig.test.ts` — update tests for new resolution logic

### [P3] SSH key injection via shell commands in pod

* **Repos**: tsa, backend
* **Key files**: `repos/tsa/src/utils/tasks/sandboxConnect.ts` (lines 31-52), `repos/tsa/src/services/sync/sshConfig.ts` (lines 141-163), `repos/tsa/src/services/api.ts` (lines 294-318, `injectSshKey`)
* TSA generates a persistent Ed25519 keypair at `~/.config/tdsk/sandbox_key[.pub]`, never rotated. Before each SSH connection, `sandboxConnect.ts` sends the public key to the backend via `injectSshKey()`, which builds a raw shell string (`mkdir -p ~/.ssh && echo '<pubkey>' > ~/.ssh/authorized_keys && chmod ...`) executed via `execInSandbox()`. Drawbacks: (1) the persistent keypair is shared across all sandboxes with no rotation, (2) key injection relies on shell command execution in the pod (tied to the shell injection risk tracked in the Sandbox section), (3) if `execInSandbox` fails silently, SSH auth fails with no clear error
* **Fix**:
  1. Investigate using K8s Secret volume mounts to inject the public key at pod creation time instead of runtime `execInSandbox` calls
  2. Consider ephemeral per-session keypairs instead of a single persistent key, with automatic cleanup on session end
  3. If keeping runtime injection, add a verification step (e.g., `test -f ~/.ssh/authorized_keys`) and surface clear errors on failure
  4. Add key rotation support (regenerate keypair on `tsa login` or after a configurable TTL)
* **Files**:
  * `repos/tsa/src/services/sync/sshConfig.ts` — key generation and rotation logic
  * `repos/tsa/src/utils/tasks/sandboxConnect.ts` — key injection flow
  * `repos/tsa/src/services/api.ts` — `injectSshKey` method
  * `repos/backend/src/services/sandboxes/sandbox.ts` — pod manifest key injection (if using volume mount approach)
  * `repos/sandbox/src/kube/podManifest.ts` — pod spec for Secret volume mount

### [P2] Auto-resolve instance ID from session ID across project

* **Repos**: tsa, backend, database
* **Key files**: `repos/tsa/src/tasks/sessions/sessions.ts`, `repos/tsa/src/utils/sandbox/resolveSessionSandbox.ts` (lines 6-33), `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` (line 461), `repos/backend/src/services/sandboxes/sandbox.ts` (lines 565-571), `repos/database/src/schemas/sandboxSessions.ts`
* When a user runs `tsa sessions connect <session-id>` without `--sandbox`, `resolveSessionSandbox()` loops through ALL sandboxes in the project making N+1 API calls (1 to list sandboxes, then 1 per sandbox to check its sessions). For projects with many sandboxes this is slow. Other TSA commands (`sandbox`, `ssh`, `sync`) do not support session-based resolution at all. Session IDs are generated with `nanoid(16)` at `onShellConnect.ts:461` with no collision detection or uniqueness validation — the backend's `findInstanceForSession()` mitigates this by requiring both `sessionId` AND `sandboxId`, but the TSA auto-resolution path searches by `sessionId` alone
* **Fix**:
  1. Add a backend endpoint `GET /_/orgs/:orgId/projects/:projectId/sessions/:sessionId/resolve` that resolves a session ID to its sandbox, instance, and session metadata in a single call by scanning in-memory sessions across all sandbox service instances
  2. Update `resolveSessionSandbox()` in TSA to call the new endpoint instead of N+1 scanning
  3. Add session ID uniqueness validation in `onShellConnect.ts`: before assigning `nanoid(16)`, check active sessions for collisions (or use a scoped ID format like `<sandboxId>-<nanoid>`)
  4. Add `--session <id>` option to `tsa sandbox`, `tsa ssh`, and `tsa sync` commands that auto-resolves sandbox and instance from the session ID
  5. Add TSA `api.ts` method `resolveSession(orgId, projectId, sessionId)` to call the new endpoint
* **Files**:
  * New: `repos/backend/src/endpoints/sandboxes/resolveSession.ts` — new endpoint for single-call session resolution
  * `repos/backend/src/services/sandboxes/sandbox.ts` — add `findSessionAcrossProject()` method that searches all instances
  * `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` — add session ID collision check at generation
  * `repos/tsa/src/utils/sandbox/resolveSessionSandbox.ts` — update to use new endpoint
  * `repos/tsa/src/services/api.ts` — add `resolveSession()` API method
  * `repos/tsa/src/tasks/sandbox.ts` — add `--session` option
  * `repos/tsa/src/tasks/ssh.ts` — add `--session` option
  * `repos/tsa/src/tasks/sync.ts` — add `--session` option
  * `repos/tsa/src/constants/options.ts` — add `SessionOptions` definition

---

## General

### [P4] Sandbox: Pool process exit cleanup

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/local/local.ts`
* The sandbox pool (`LocalSandboxProvider`) has no SIGTERM handler to drain idle sandboxes on process exit. V8 cleans up on exit so this is low risk, but a graceful shutdown handler would be cleaner
* **Fix**: Add a process exit handler that calls `close()` on all idle pool sandboxes
* **Files**: `repos/sandbox/src/local/local.ts`


### [P3] TSA: `FileRequest` and `FileChanged` events — unimplemented stubs (workspace file sync placeholder)

* `repos/tsa/src/services/executor.ts` lines 181-185: both are empty `break` stubs
* The backend has no `FileRequest`/`FileChanged` handling at all in `repos/backend/src/endpoints/ai/onWSConnect.ts`, confirming the workspace file sync feature is unimplemented end-to-end
* These events are defined in `repos/domain/src/types/ws.types.ts` (lines 17-18) as `TWSFileRequestMsg` and `TWSFileChangedMsg` under the `// Server to Client` section
* No fix needed until the backend implements the workspace file sync feature. The empty stubs are correct placeholders
* **Fix**: No action required — track as future feature when backend workspace file sync is implemented
* **Files**: `repos/tsa/src/services/executor.ts` (stubs), `repos/backend/src/endpoints/ai/onWSConnect.ts` (stubs)


## Sandbox File Sync: Deferred Items

### [P3] Sandbox File Sync: `tsa cp` command for one-off file copy

* **Repos**: tsa
* **Key files**: New `repos/tsa/src/tasks/cp.ts`
* **Depends on**: Sandbox file sync v1 (tsa sync)
* One-off file copy in/out of sandbox via SCP over existing SSH tunnel. Complements `tsa sync` for cases where continuous sync is not needed — e.g., downloading build artifacts or uploading a single config file.
* **Implementation**:
  1. Add `tsa cp <local-path> <sandbox-id>:<remote-path>` for upload
  2. Add `tsa cp <sandbox-id>:<remote-path> <local-path>` for download
  3. Use SCP over existing `tsa proxy` ProxyCommand tunnel
  4. Support glob patterns for multi-file operations
* **Files**:
  * New: `repos/tsa/src/tasks/cp.ts` — copy task implementation

### [P3] Sandbox File Sync: Admin UI sync configuration panel

* **Repos**: admin, components
* **Key files**: New `repos/admin/src/components/Sandboxes/SyncDrawer.tsx`
* **Depends on**: Sandbox file sync v1 (tsa sync), syncDefaults API
* Sync configuration drawer in admin sandbox management — set sync direction, default ignores, target paths per sandbox. Uses existing `syncDefaults` JSONB field on sandbox records.
* **Implementation**:
  1. Create `SyncDrawer` component with accordion sections for general settings, ignore patterns (Monaco editor), and path configuration
  2. Add "Configure Sync" action button to sandbox table
  3. Add sync status column to sandbox table (reads from syncDefaults, not live status)
  4. Wire to existing `updateSandbox` API endpoint for saving syncDefaults
* **Files**:
  * New: `repos/admin/src/components/Sandboxes/SyncDrawer.tsx`
  * Modify: `repos/admin/src/components/Sandboxes/Sandboxes.tsx` — add sync column + action

### [P3] Sandbox File Sync: Threads app sync integration

* **Repos**: threads
* **Depends on**: Threads app baseline, sandbox file sync v1
* Sync controls in the Threads app for non-developer users. Scope TBD based on Threads app architecture once baseline is complete.

### [P3] Sandbox File Sync: Real-time sync status streaming

* **Repos**: backend, admin, threads
* **Depends on**: Admin UI sync config, Threads app sync
* Real-time sync status via WebSocket or SSE for UI consumers. Backend tracks sync session state and pushes updates to connected clients.

### [P3] Sandbox File Sync: MutagenClient GrpcDriver

* **Repos**: tsa
* **Key files**: New `repos/tsa/src/services/sync/grpcDriver.ts`
* **Depends on**: Sandbox file sync v1 stable
* Replace CliDriver with gRPC integration to Mutagen daemon for structured protobuf data and long-polling status updates. Compile Mutagen proto files to TypeScript, connect to daemon socket via `@grpc/grpc-js`.
* **Implementation**:
  1. Compile Mutagen proto files (`pkg/service/synchronization/synchronization.proto` and dependencies) to TypeScript
  2. Implement `GrpcDriver` class implementing `IMutagenClient` interface
  3. Connect to `~/.mutagen/daemon/daemon.sock` via `@grpc/grpc-js`
  4. Use `List` RPC with `previousStateIndex` for long-polling status updates
  5. Swap CliDriver for GrpcDriver in SyncManager (configuration-based selection)
* **Files**:
  * New: `repos/tsa/src/services/sync/grpcDriver.ts`
  * New: `repos/tsa/src/services/sync/proto/` — compiled proto definitions

### [P3] Sandbox File Sync: File browser UI

* **Repos**: admin, threads, backend
* **Depends on**: Admin UI sync config, Threads app sync
* Browse and download sandbox files from admin and Threads UIs. Uses existing `ISandbox.readFile/listDir` via a new backend endpoint or the existing exec endpoint.

### [P3] Sandbox File Sync: Sync session persistence

* **Repos**: backend, database, domain
* **Depends on**: GrpcDriver or sync status streaming
* Track active sync sessions in backend DB for cross-client visibility. Enables admin/Threads UIs to show which sandboxes have active sync sessions without querying the user's local Mutagen daemon.
