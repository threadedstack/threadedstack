## TASKS

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


## Cross-Repo

### [P1] Divergent ApiService implementations (admin vs threads)

* **Repos**: threads, admin, domain
* **Key files**: `repos/threads/src/services/api.ts` (line 28), `repos/admin/src/services/api.ts` (line 14), `repos/domain/src/services/api/apiService.ts`
* Admin extends `@tdsk/domain` ApiService with proper response envelope unwrapping. Threads has a completely independent standalone implementation that does NOT extend the domain class. Error handling, metadata extraction, and edge cases diverge. Bug fixes in one don't propagate
* **Fix**:
  1. Have threads `ApiService` extend domain `ApiService` like admin does
  2. Remove duplicated fetch/retry/bearer logic from threads
* **Files**:
  * `repos/threads/src/services/api.ts` — extend domain ApiService
  * `repos/domain/src/services/api/apiService.ts` — may need minor adjustments for threads use case

### [P1] Inconsistent 409 error response format (stopSandbox)

* **Repos**: backend, threads
* **Key files**: `repos/backend/src/endpoints/sandboxes/stopSandbox.ts` (lines 35-41), `repos/threads/src/services/api.ts` (line 62)
* `stopSandbox` returns `{ error: { message, code }, data: { activeSessions } }` — error is an object. The standard error handler returns `{ error: "string" }`. The threads `ApiError` constructor handles this accidentally via `msg.message` but would break as `[object Object]` if either side is refactored
* **Fix**:
  1. Use `throw new Exception(409, ...)` pattern in stopSandbox, OR
  2. Standardize the error shape to match the global error handler format
* **Files**:
  * `repos/backend/src/endpoints/sandboxes/stopSandbox.ts` — use Exception pattern
  * `repos/threads/src/services/api.ts` — harden error parsing if keeping non-standard format

### [P2] Duplicated types and utilities between admin and threads

* **Repos**: threads, admin, domain
* **Key files**: `repos/threads/src/types/api.types.ts`, `repos/admin/src/types/api.types.ts`, `repos/threads/src/utils/api/objToQuery.tsx`
* Both define own `TApiRes`, `TApiReq`, `EApiMethod`/`EAPIMethod` types with subtly different shapes. Threads has a local copy of `objToQuery` (`.tsx` extension, no JSX) instead of importing from `@tdsk/domain`
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
* Domain/database/proxy use 2.2.0; backend/admin/threads use 2.1.0. Config loading behavior could diverge at the domain-backend boundary
* **Fix**:
  1. Sync all repos to 2.2.0 via `pnpm sync` or manual package.json updates
* **Files**:
  * Multiple `repos/*/package.json` files

### [P2] TSBConnectResp type missing backend fields

* **Repos**: domain, backend, threads
* **Key files**: `repos/domain/src/types/sandbox.types.ts` (lines 311-320), `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` (lines 179-192)
* The domain type `TSBConnectResp` is missing `port: number` and `initError?: string` fields that the backend actually returns. TypeScript won't catch usages, and `initError` from failed init scripts is silently dropped by the threads frontend
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
* **Key files**: `repos/threads/src/actions/gui/setEngineAst.ts` (lines 6-19), `repos/threads/src/actions/gui/appendFeedEvents.ts` (lines 6-18)
* These actions are called at `requestAnimationFrame` frequency during terminal streaming. Each call clones the entire Map (`new Map(asts)`) to update one entry. With multiple sessions open, every frame copies all session data. Creates GC pressure and frame drops on lower-powered devices
* **Fix**:
  1. Use per-session atoms (a Map of atoms rather than an atom of Maps) so updating one session doesn't clone the entire Map
  2. Alternatively, use `immer` patches or atom families
* **Files**:
  * `repos/threads/src/actions/gui/setEngineAst.ts` — refactor to per-session atoms
  * `repos/threads/src/actions/gui/appendFeedEvents.ts` — same refactor

### [P2] Editor atom defaults vs atomWithReset initial values differ

* **Repos**: threads
* **Key files**: `repos/threads/src/state/editor.ts` (lines 16-37)
* Each atom is initialized with `new Map()`/`new Set()`, while the named defaults (`defFileTreeData`, `defExpandedFolders`) are separate instances. `useResetAtom` and manual accessor resets produce different object identities, causing unnecessary re-renders
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

### [P1] useEndpointForm uses mutable ref in useEffect deps

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/endpoints/useEndpointForm.ts` (lines 25-38)
* `validateTriggerRef.current` is used as a `useEffect` dependency. React does not track ref mutations — the effect will not fire when the ref changes. Validation may never fire or fires unpredictably when other deps happen to change
* **Fix**:
  1. Replace the ref-based trigger with a state counter: `const [validateTrigger, setValidateTrigger] = useState(0)`
  2. Use `setValidateTrigger(c => c + 1)` to trigger and include `validateTrigger` in deps
* **Files**:
  * `repos/admin/src/hooks/endpoints/useEndpointForm.ts` — replace ref with state

### [P1] sendMessage silently drops failed file uploads

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/chat/useAgentChat.ts` (lines 225-239)
* When a file upload fails (`resp.data` is falsy), the failure is silently ignored. The message sends with only successfully uploaded files. Users get no indication which files were or weren't attached
* **Fix**:
  1. Check `resp.error` after each upload
  2. Surface failure via toast notification with the failed file name
  3. Either abort the entire send or inform the user which files weren't attached
* **Files**:
  * `repos/admin/src/hooks/chat/useAgentChat.ts` — add error check and toast

### [P2] useLocalSearch stale closure in onSearch

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/components/useLocalSearch.ts` (lines 15-33)
* `onSearch` is not memoized and recreated every render. The `useEffect` only depends on `[props.items]`, missing `onSearch` and `onQuery`. When `props.items` changes, `onSearch` captures stale `items` state and `query` value
* **Fix**:
  1. Memoize `onSearch` with `useCallback`
  2. Add `onSearch` to the effect dependency array, or call `onQuery` directly inside the effect with `props.items`
* **Files**:
  * `repos/admin/src/hooks/components/useLocalSearch.ts` — memoize and fix deps

### [P2] useSandboxForm useEffect missing dependencies

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/sandboxes/useSandboxForm.ts` (lines 424-431)
* `populateFromSandbox` is a local function (not memoized) calling 20+ state setters, omitted from the effect dependency array. If the `sandbox` object identity changes each render, the effect fires every time causing a cascade of re-renders
* **Fix**:
  1. Memoize `populateFromSandbox` with `useCallback` and include in deps
  2. Compare `sandbox.id` rather than the full object reference to prevent unnecessary re-runs
* **Files**:
  * `repos/admin/src/hooks/sandboxes/useSandboxForm.ts` — memoize and fix dep comparison

### [P2] await safeFetch() misleading pattern in loaders

* **Repos**: admin
* **Key files**: `repos/admin/src/routes/loaders.ts` (lines 62-69, 93, 113-114)
* `safeFetch` returns void (undefined). Some callers `await` it (e.g., line 93), giving the false impression the loader waits for data. Others correctly fire-and-forget (e.g., lines 123-124). The inconsistency creates confusion and risk of breakage if `safeFetch` is later changed to return a promise
* **Fix**:
  1. Remove all `await` keywords before `safeFetch()` calls to make fire-and-forget intent unambiguous
* **Files**:
  * `repos/admin/src/routes/loaders.ts` — remove await from safeFetch calls

### [P3] useAsyncAction never sets error state

* **Repos**: admin
* **Key files**: `repos/admin/src/hooks/components/useAsyncAction.ts` (lines 9-17)
* The hook exposes `error` state and `setError`, but `run()` never catches errors or calls `setError`. Callers relying on `useAsyncAction().error` will always see `null`
* **Fix**:
  1. Add a `catch` block in `run()` that calls `setError(err.message)` and either re-throws or returns undefined
* **Files**:
  * `repos/admin/src/hooks/components/useAsyncAction.ts` — add catch block

---

## Backend

---

## Proxy

### [P1] Echo endpoint leaks all headers with no production guard

* **Repos**: proxy
* **Key files**: `repos/proxy/src/endpoints/echo.ts` (lines 11-19), `repos/proxy/src/constants/values.ts` (line 7)
* The `/echo` endpoint echoes all request headers including `Authorization` and cookies. It is registered as a `PublicRoute` (no auth required). The code comment warns "Do not enable in production" but there is no runtime guard — it is always registered regardless of environment
* **Fix**:
  1. Add a guard: only register the route when `NODE_ENV !== 'production'` or behind a dedicated feature flag
  2. Alternatively, strip sensitive headers (`authorization`, `cookie`) before echoing
* **Files**:
  * `repos/proxy/src/endpoints/echo.ts` — add environment guard
  * `repos/proxy/src/constants/values.ts` — conditionally include in PublicRoutes

### [P2] CORS configuration allows wildcard origin

* **Repos**: proxy, backend
* **Key files**: `repos/proxy/src/middleware/setupServer.ts` (lines 19-26), `repos/backend/src/middleware/setupServer.ts` (lines 18-24)
* If the `origins` config includes `*` and the service is not behind the LB proxy (`behindLBProxy()` returns false), CORS allows any origin. No explicit `credentials: false` is set
* **Fix**:
  1. Avoid configuring `origins: ["*"]` in any environment
  2. Add `credentials: false` explicitly to the CORS config
* **Files**:
  * `repos/proxy/src/middleware/setupServer.ts` — add credentials: false
  * `repos/backend/src/middleware/setupServer.ts` — same fix

### [P2] Proxy-to-backend header validation silently skips if unconfigured

* **Repos**: backend
* **Key files**: `repos/backend/src/utils/auth/pxToBeHeader.ts` (lines 6-19)
* If `config.proxy.headerValue` is not configured, the validation returns silently — no error. This means if the shared secret is misconfigured or missing, the backend accepts requests from any source. An attacker reaching the backend directly could forge user identity headers
* **Fix**:
  1. Make the shared secret mandatory — throw an error at startup if `config.proxy.headerValue` is not set
* **Files**:
  * `repos/backend/src/utils/auth/pxToBeHeader.ts` — throw on missing config

---

## Sandbox

### [P1] Shell injection via KubeSandbox exec argument concatenation

* **Repos**: sandbox, backend
* **Key files**: `repos/sandbox/src/kube/kubeSandbox.ts` (lines 52-54), `repos/backend/src/endpoints/sandboxes/execInSandbox.ts` (lines 44-46)
* Command and args are concatenated into a single string passed to `sh -c` without shell escaping. An AI agent calling `shellExec({ command: "ls", args: ["; cat /etc/shadow"] })` gets full shell interpretation inside the pod. While blast radius is limited to the isolated pod, this can exfiltrate injected secrets (SSH password, provider API keys via env vars). Same pattern affects `evaluate()` (line 138-139)
* **Fix**:
  1. Pass command and args as separate elements in the K8s exec command array (avoiding shell interpretation): `this.client.runInPod(this.podName, [command, ...args])`
  2. Only use `sh -c` when shell features are explicitly needed (pipes, redirects)
  3. For cases requiring `sh -c`, shell-quote each argument individually
* **Files**:
  * `repos/sandbox/src/kube/kubeSandbox.ts` — refactor exec/evaluate to avoid sh -c
  * `repos/backend/src/endpoints/sandboxes/execInSandbox.ts` — validate or sanitize inputs

### [P1] Sandbox proxy may lack authentication

* **Repos**: backend
* **Key files**: `repos/backend/src/middleware/sandboxProxy.ts` (lines 18-52)
* The sandbox proxy middleware intercepts requests based on hostname pattern matching and forwards directly to pod IPs without any authentication check. If Caddy routes sandbox subdomain traffic directly to the backend (bypassing the auth proxy), these requests are unauthenticated. Anyone knowing the subdomain pattern could access services running in pods
* **Fix**:
  1. Add authentication/authorization checks in the sandbox proxy middleware before forwarding
  2. Or ensure Caddy configuration always routes sandbox subdomain traffic through the auth proxy
* **Files**:
  * `repos/backend/src/middleware/sandboxProxy.ts` — add auth check

### [P1] KubeSandbox file ops lack path traversal protection

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/kube/kubeSandbox.ts` (lines 57-101)
* The `readFile`, `deleteFile`, `mkdir`, `listDir`, and `fileExists` methods accept arbitrary paths without validating for traversal (`../`), absolute paths outside the workspace, or symlink following. An AI agent could read/write/delete any file accessible to the `sandbox` user
* **Fix**:
  1. Validate paths in all ISandbox file methods to ensure they are within `DefaultWorkdir` or `DefaultTempdir`
  2. Reject paths containing `..` or starting outside allowed directories
* **Files**:
  * `repos/sandbox/src/kube/kubeSandbox.ts` — add path validation to all file methods

### [P2] runInPod unbounded output buffer (OOM)

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/kube/kubeClient.ts` (lines 215-216)
* The `runInPod` method accumulates ALL stdout and stderr chunks in memory without any size limit. There is no timeout on command execution either. A command producing unbounded output (e.g., `yes`, `cat /dev/urandom`) would crash the backend process
* **Fix**:
  1. Add a maximum buffer size — truncate and resolve with partial result when exceeded
  2. Add an execution timeout that kills the K8s exec WebSocket
* **Files**:
  * `repos/sandbox/src/kube/kubeClient.ts` — add buffer limit and timeout

### [P2] SSH password in plaintext env var

* **Repos**: backend, sandbox
* **Key files**: `repos/backend/src/services/sandboxes/sandbox.ts` (lines 496-525), `repos/sandbox/src/kube/podManifest.ts` (line 251)
* The SSH password is injected as a plain-text environment variable (`TDSK_SSH_PASSWORD`) into the pod. Any process running inside the pod can read it via `printenv` or `/proc/self/environ`. Combined with the path traversal issue, an AI agent could obtain SSH credentials
* **Fix**:
  1. Consider file-based secret mount (K8s Secret volume) instead of env var
  2. Or use token-based authentication that expires
* **Files**:
  * `repos/backend/src/services/sandboxes/sandbox.ts` — change credential injection method
  * `repos/sandbox/src/kube/podManifest.ts` — update pod spec

### [P3] Agent tool execution ignores AbortSignal

* **Repos**: agent
* **Key files**: `repos/agent/src/tools/tools.ts` (lines 38-59)
* The sandbox tools (`shellExec`, `readFile`, `writeFile`, etc.) accept an `_signal` (AbortSignal) parameter but never use it. A `shellExec` call to a long-running command blocks the agent indefinitely with no way to cancel the underlying K8s exec operation
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
* The `getProjectMembers` method queries the `user` relation with `first: true` and `last: true` in the columns projection. These columns do not exist on the `neon_auth.user` table — they are only computed properties on the `User` domain model. Drizzle will either produce a SQL error or silently return undefined
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
* **Key files**: `repos/database/src/utils/schema/timestamps.ts`, `repos/database/src/schemas/users.ts` (lines 26-27), `repos/database/src/schemas/subscriptions.ts` (lines 26-27), `repos/database/src/schemas/invitations.ts` (lines 45-47)
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
  2. Match the pattern already used in `#upsertProviders` (line 172-212) which correctly uses transactions
* **Files**:
  * `repos/database/src/services/agent.ts` — wrap create in transaction
  * `repos/database/src/services/sandbox.ts` — wrap create in transaction

---

## Website

### [P3] Documentation: 19 missing content pages referenced in sidebar

* **Repos**: website
* **Key files**: `repos/website/src/components/Docs/DocsSidebar.tsx`, `repos/website/src/content/docs/`
* The docs sidebar references 25+ pages but only 6 MDX files exist. Missing pages: `getting-started/installation`, `concepts/projects`, `concepts/providers`, `concepts/endpoints`, `concepts/secrets`, `api-reference/organizations`, `api-reference/agents`, `api-reference/threads`, `websocket/connection`, `websocket/client-events`, `websocket/server-events`, `guides/admin-dashboard`, `guides/tsa-cli`, `guides/self-hosting`, `changelog`
* Existing pages: `getting-started/introduction.mdx`, `getting-started/quick-start.mdx`, `concepts/agents.mdx`, `concepts/organizations.mdx`, `concepts/threads.mdx`, `api-reference/authentication.mdx`
* **Fix**:
  1. Create each missing MDX file under `repos/website/src/content/docs/` with proper frontmatter and content
  2. API reference pages should document endpoints, request/response schemas, and auth requirements
  3. WebSocket pages should document the connection protocol, client event types (`TWSClientMsg`), and server event types (`TWSServerMsg`) from `repos/domain/src/types/ws.types.ts`
  4. Guide pages should cover admin dashboard usage, TSA CLI commands, and self-hosting setup
* **Files**:
  * New: `repos/website/src/content/docs/getting-started/installation.mdx`
  * New: `repos/website/src/content/docs/concepts/projects.mdx`
  * New: `repos/website/src/content/docs/concepts/providers.mdx`
  * New: `repos/website/src/content/docs/concepts/endpoints.mdx`
  * New: `repos/website/src/content/docs/concepts/secrets.mdx`
  * New: `repos/website/src/content/docs/api-reference/organizations.mdx`
  * New: `repos/website/src/content/docs/api-reference/agents.mdx`
  * New: `repos/website/src/content/docs/api-reference/threads.mdx`
  * New: `repos/website/src/content/docs/websocket/connection.mdx`
  * New: `repos/website/src/content/docs/websocket/client-events.mdx`
  * New: `repos/website/src/content/docs/websocket/server-events.mdx`
  * New: `repos/website/src/content/docs/guides/admin-dashboard.mdx`
  * New: `repos/website/src/content/docs/guides/tsa-cli.mdx`
  * New: `repos/website/src/content/docs/guides/self-hosting.mdx`
  * New: `repos/website/src/content/docs/changelog.mdx`


### [P3] Add Contact and About pages with footer links

* **Repos**: website
* **Key files**: `repos/website/src/components/Footer/MarketingFooter.tsx` (lines 31-32)
* The footer has "About" and "Contact" links under the "Company" section, but both point to `#` (placeholder). No corresponding pages exist
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
* **Key files**: `repos/tsa/src/services/sync/sshConfig.ts` (lines 37-136), `repos/tsa/src/utils/tasks/spawnSsh.ts` (lines 6-12)
* `resolveTsaBin()` (lines 37-102) uses 5 cascading strategies to locate the `tsa` binary via `process.argv` parsing, relative path probing, and cwd-based guessing. `ensureProxyWrapper()` (lines 104-136) then extracts `pkgRoot` from the resolved path by string-slicing on `/dist/` or `/src/` substrings (lines 111-115, confirmed fragile by TODO comment on line 110). When any assumption breaks (different directory structure, symlinked binary, running from unexpected location), the wrapper script writes an incorrect `cd` target and SSH connections silently fail. Separately, `spawnSsh.ts` `buildProxyCommand()` (line 7) has its own `process.argv`-based binary resolution that can diverge from `sshConfig.ts`
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
* **Key files**: `repos/tsa/src/utils/tasks/sandboxConnect.ts` (lines 31-52), `repos/tsa/src/services/sync/sshConfig.ts` (lines 138-168), `repos/tsa/src/services/api.ts` (`injectSshKey` method)
* TSA generates a persistent Ed25519 keypair at `~/.config/tdsk/sandbox_key[.pub]` (sshConfig.ts lines 138-168). Before each SSH connection, `sandboxConnect.ts` sends the public key to the backend via `injectSshKey()`, which calls `execInSandbox()` to run shell commands inside the pod (`mkdir -p ~/.ssh && echo '<pubkey>' > ~/.ssh/authorized_keys && chmod 700 ~/.ssh && ...`). This approach works but has drawbacks: (1) the persistent keypair is shared across all sandboxes with no rotation, (2) key injection relies on shell command execution in the pod (tied to the shell injection risk already tracked in the Sandbox section), (3) if `execInSandbox` fails silently, SSH auth fails with no clear error
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
* **Key files**: `repos/tsa/src/tasks/sessions.ts` (lines 17-48, 277-356), `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` (line 461), `repos/backend/src/services/sandboxes/sandbox.ts` (lines 565-571), `repos/database/src/schemas/sandboxSessions.ts`
* When a user runs `tsa sessions connect <session-id>` without `--sandbox`, `resolveSessionSandbox()` (lines 17-48) loops through ALL sandboxes in the project making N+1 API calls (1 to list sandboxes, then 1 per sandbox to check its sessions). For projects with many sandboxes this is slow. Other TSA commands (`sandbox`, `ssh`, `sync`) do not support session-based resolution at all. Additionally, session IDs are generated with `nanoid(16)` at `onShellConnect.ts:461` with no collision detection or uniqueness validation. While statistically unlikely, collisions across concurrent org instances would cause auto-resolution to return the wrong instance. The backend's `findInstanceForSession()` (sandbox.ts line 565) mitigates this by requiring both `sessionId` AND `sandboxId`, but the TSA auto-resolution path searches by `sessionId` alone
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
  * `repos/tsa/src/tasks/sessions.ts` — update `resolveSessionSandbox()` to use new endpoint
  * `repos/tsa/src/services/api.ts` — add `resolveSession()` API method
  * `repos/tsa/src/tasks/sandbox.ts` — add `--session` option
  * `repos/tsa/src/tasks/ssh.ts` — add `--session` option
  * `repos/tsa/src/tasks/sync.ts` — add `--session` option
  * `repos/tsa/src/constants/options.ts` — add `SessionOptions` definition

---

## General

### [P4] Sandbox: Pool process exit cleanup

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/local.ts`
* The sandbox pool (`LocalSandboxProvider`) has no SIGTERM handler to drain idle sandboxes on process exit. V8 cleans up on exit so this is low risk, but a graceful shutdown handler would be cleaner
* **Fix**: Add a process exit handler that calls `close()` on all idle pool sandboxes
* **Files**: `repos/sandbox/src/local.ts`


### [P3] TSA: `FileRequest` and `FileChanged` events — unimplemented stubs (Phase 8 placeholder)

* `repos/tsa/src/services/executor.ts` lines 143-147: both are empty `break` stubs
* The backend also has them as stubs — `wsHandler.ts` "Phase 8 — workspace file sync (placeholder)"
* These events are defined in `repos/domain/src/types/ws.types.ts` (lines 17-18) as `TWSFileRequestMsg` and `TWSFileChangedMsg` under the `// Server to Client` section
* No fix needed until the backend implements the workspace file sync feature. The empty stubs are correct placeholders
* **Fix**: No action required — track as future feature when backend Phase 8 is implemented
* **Files**: `repos/tsa/src/services/executor.ts` (stubs), `repos/backend/src/endpoints/ai/wsHandler.ts` (stubs)


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

