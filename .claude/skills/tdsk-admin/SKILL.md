---
name: "tdsk-admin"
description: "Knowledge base for the admin SPA dashboard repo"
tags: ["react", "vite", "mui", "jotai", "tanstack-query", "frontend", "admin-dashboard", "billing", "quotas", "agents", "ai-chat"]
---
# Admin Repo Skill

## Overview

The **Admin** repo (`repos/admin`) is the Single Page Application (SPA) dashboard for Threaded Stack. It provides the primary user interface for managing **organizations**, **projects**, API keys, providers, secrets, endpoints, functions, agents, threads, and other platform resources. Built with modern React tooling, it uses Vite for fast HMR, MUI for UI components, Jotai for lightweight state management, and TanStack React Query for API caching.

**Key Characteristics:**
- **Type**: Frontend SPA Dashboard
- **Package**: `@tdsk/admin` v0.1.0 (private)
- **Authentication**: Neon Auth (via `@neondatabase/neon-js`) with social OAuth providers
- **Path Aliases**: Uses `@TAF/*` prefix via `alias-hq` for internal imports
- **Styling**: Emotion (CSS-in-JS) + Material-UI theming system
- **Toasts**: Sonner
- **Analytics**: PostHog

## Directory Structure

```
repos/admin/
├── configs/                    # Vite, biome, nginx, env loading (frontend.config.ts)
├── scripts/                    # addToProcess, loadEnvs, registerPaths, setupTests, testUtils
└── src/
    ├── index.tsx               # React bootstrap: StrictMode → Jotai Provider → AuthProvider → App + Version
    ├── App.tsx                 # Root: ThemeProvider → GlobalStyles → MUI GlobalStyles → RouterProvider
    ├── actions/                # ~170 files across 19 domains (agents, apiKeys, assets, auth, domains,
    │   │                       #   endpoints, functions, messages, orgs, profile, projects, providers,
    │   │                       #   quickstart, quotas, sandboxes, secrets, subscriptions, threads, users)
    │   └── <domain>/
    │       ├── api/            # Async: call service → update Jotai state → return response
    │       └── local/          # Sync: direct Jotai state mutations (upsert, remove, set)
    ├── components/             # 39 directories, 140+ files
    │   ├── Agents/             # AgentDrawer, AgentSection, AgentSettingsForm, BasicInfoForm, FunctionsSelector, ModelConfigForm, SecretsSelector, ToolsSelector
    │   ├── AI/                 # AssetsTab, ChatView, CreateThreadDrawer, EditThreadDrawer, MessageBubble, MessagesTab, ThreadsTab, ToolCallDisplay
    │   ├── Billing/            # CurrentPlan, PlanCard, QuotaUsage
    │   ├── Breadcrumbs/        # Breadcrumbs, OrgSelector, OrgsMenu, ProjectSelector
    │   ├── Endpoints/          # EndpointDrawer, EndpointFormBase, Endpoints, EndpointsTable + Agent/, Faas/, Proxy/ subdirs
    │   ├── Functions/          # FunctionDrawer, Functions, NoFunctions
    │   ├── Header/             # Header, Settings, Tabs (+ styled)
    │   ├── Login/              # GithubBtn, GitlabBtn, GoogleBtn, VercelBtn, Login, LoginError
    │   ├── Orgs/               # CreateApiKeyDrawer, CreateOrgDrawer, EditOrgDrawer, NoOrgs, OrgCard, OrgIcon, OrgsGrid
    │   ├── Projects/           # CreateProjectDrawer, NoProjects, ProjectCard, ProjectIcon, ProjectsGrid, ProjectsMenu
    │   ├── Providers/          # ProviderDrawer, Providers
    │   ├── Quickstart/         # AgentStep, ProviderStep, Quickstart, QuickstartButton, QuickstartWizard, ReviewStep
    │   ├── Sandboxes/          # Sandboxes (list+actions+copy), SandboxDrawer (create/edit with runtime fields), ConnectModal (SSH connection)
    │   ├── Secrets/            # SecretDrawer, Secrets
    │   ├── Sidebar/            # SBLogo, SBNavList, SBProjectSelector, SBSection, Sidebar (+ styles)
    │   ├── Users/              # InviteUserDrawer, NoUsers, UserCard, UsersGrid
    │   └── ...                 # ActionIconButton, AppError, ArrayEditor, CardGrid, Code, DataTable, Domains,
    │                           #   EmptyState, ErrorAlert, FilterSelect, InfoField, ItemCard, KeyValueEditor,
    │                           #   Link, LoadingButton, LoadingSpinner, PageHeader, PageLayout, ParamsEditor,
    │                           #   Permissions, Roles, SearchBar, Settings, Version
    ├── constants/              # endpoints.ts, envs.ts, monaco.ts, nav.tsx, providers.ts, query.ts, storage.ts, tools.ts, values.ts
    ├── contexts/               # AuthContext/Provider, OrgsContext/Provider, ProjectsContext/Provider
    ├── hooks/
    │   ├── chat/               # useAgentChat (SSE streaming)
    │   ├── components/         # useDrawerActions, useLocalSearch, useQuickStart, useReset, useSteps
    │   ├── endpoints/          # useAgentFormState, useEndpointFilter, useEndpointForm, useEndpoints, useFaasFormState, useProxyFormState
    │   ├── nav/                # useActiveNavData, useAgentsSidebarSync, useDynamicNav
    │   ├── org/                # useOrgSecrets, useOrgsState, useOrgUsersList
    │   ├── permissions/        # useCanPerform, usePermissions
    │   ├── project/            # useProjectSecrets, useProjectsState
    │   └── theme/              # useMakeTheme, useTheme, useThemeToggle
    ├── pages/                  # Account, Billing, Home, Layout, Login, Orgs/*, Page, Profile, Projects/* (incl. ProjectWorkspace, ProjectSandboxes), Providers, Settings
    ├── routes/Routes.tsx       # createBrowserRouter with lazy loading + SuspensePage helper
    ├── services/               # 22+ singleton service classes (see API Service Architecture)
    ├── state/                  # 18 Jotai atom files + accessors.ts + selectors.ts
    ├── theme/GlobalStyles.tsx  # Global CSS styles component
    ├── types/                  # 16 type definition files
    └── utils/                  # api/, endpoints/, errors/, nav/, text/, transforms/, user/
```

## Key Files

### Entry Point Flow

1. **index.html** loads `/src/index.tsx` via Vite
2. **src/index.tsx** bootstraps: `StrictMode` > `Jotai Provider (store)` > `AuthProvider` > `App` + `Version`
3. **src/App.tsx** renders: `ThemeProvider` > `GlobalStyles` + MUI `GlobalStyles` > `RouterProvider`

### Routing Configuration

**File**: `src/routes/Routes.tsx`

Uses React Router 7's `createBrowserRouter` with a `SuspensePage` helper component for consistent lazy loading with `Loading` fallback.

**Route Tree**:
```
/ (root)
├── Component: OrgsLoader → Layout (SignedIn guard + Sidebar + Outlet)
├── / (index) → Home
├── /orgs → Orgs list
├── /billing → Billing/subscriptions
├── /orgs/:orgId
│   ├── (index) → Org dashboard
│   ├── /users → OrgUsers
│   ├── /secrets → OrgSecrets
│   ├── /domains → OrgDomains
│   ├── /providers → OrgProviders
│   ├── /settings → OrgSettings
│   ├── /usage → OrgUsage (quota tracking)
│   ├── /api-keys → OrgApiKeys
│   ├── /projects → ProjectsLoader → Projects list
│   ├── /sandboxes → OrgSandboxes
│   └── /projects/:projectId (Component: ProjectsLoader)
│       ├── (index) → ProjectWorkspace (sandbox list + quick actions + recent threads)
│       ├── /endpoints → ProjectEndpoints
│       ├── /secrets → ProjectSecrets
│       ├── /domains → ProjectDomains
│       ├── /functions → ProjectFunctions
│       ├── /agents → ProjectAgents
│       ├── /agents/:agentId → ProjectAgent
│       ├── /agents/:agentId/threads → ProjectThreads
│       ├── /agents/:agentId/chat → ChatView (AI chat)
│       ├── /sandboxes → ProjectSandboxes
│       └── /settings → ProjectSettings
├── /settings → Settings
├── /profile → Profile
├── /auth/:pathname → Login
├── /account/:pathname → Account
└── * → Redirect to /
```

**Route Path Enum** (`src/types/routes.types.ts`):
```typescript
enum ERoutePath {
  // Global
  Home = `/`, Auth = `/auth`, Signin = `/auth/sign-in`, Signout = `/auth/sign-out`,
  AuthPage = `/auth/:pathname`, Account = `/account/:pathname`,
  Profile = `profile`, Billing = `billing`, Settings = `settings`,

  // Org (relative paths for nested routing)
  Orgs = `/orgs`, Org = `/orgs/:orgId`,
  Users = `users`, Secrets = `secrets`, Domains = `domains`, Providers = `providers`,
  ApiKeys = `api-keys`, Usage = `usage`, Projects = `projects`,

  // Org (absolute paths for nav/links)
  OrgUsers = `/orgs/:orgId/users`, OrgSecrets = `/orgs/:orgId/secrets`,
  OrgDomains = `/orgs/:orgId/domains`, OrgProviders = `/orgs/:orgId/providers`,
  OrgSettings = `/orgs/:orgId/settings`, OrgUsage = `/orgs/:orgId/usage`,
  OrgApiKeys = `/orgs/:orgId/api-keys`, OrgProjects = `/orgs/:orgId/projects`,

  // Project (relative and absolute)
  ProjectId = `projects/:projectId`, Endpoints = `endpoints`, Functions = `functions`,
  Agents = `agents`, AgentChat = `agents/:agentId/chat`, AgentThreads = `agents/:agentId/threads`,
  ProjectAgents = `/orgs/:orgId/projects/:projectId/agents`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,
  // ... etc

  Star = `*`
}
```

**Key design**: Route paths exist in both relative form (for nested React Router children, e.g., `users`) and absolute form (for navigation links, e.g., `/orgs/:orgId/users`). The `buildRoute()` utility replaces `:orgId`, `:projectId`, etc. with actual IDs from context.

### State Management (Jotai)

**Global Store** (`src/state/accessors.ts`): `export const store = createStore()`

**18 State Atom Files** with the following pattern:
```typescript
// state/<entity>.ts
import { atomWithReset } from 'jotai/utils'
export const entityState = atomWithReset<Record<string, Entity> | undefined>(undefined)
export const activeEntityIdState = atomWithReset<string | undefined>(undefined)
```

**All atom files and their exports**:
- `agents.ts` — `agentsState`, `activeAgentIdState`, `activeAgentState` (derived)
- `sandboxes.ts` — `sandboxesState`, `projectSandboxesState` (derived from sandboxesState + activeProjectIdState)
- `apiKeys.ts` — `apiKeysState`, `activeApiKeyIdState`
- `app.ts` — `sidebarOpenState`
- `assets.ts` — `assetsState`, `activeAssetIdState`
- `domains.ts` — `domainsState`, `activeDomainIdState`
- `endpoints.ts` — `endpointsState`, `activeEndpointIdState`, `proxyFormState`, `faasFormState`, `agentFormState`
- `functions.ts` — `functionsState`, `activeFunctionIdState`
- `messages.ts` — `messagesState`, `activeMessageIdState`
- `orgs.ts` — `orgsState`, `orgUsersState`, `activeOrgIdState`, `activeOrgRoleState`, `activeOrgState` (derived)
- `projects.ts` — `projectsState`, `activeProjectIdState`, `activeProjectState` (derived)
- `providers.ts` — `providersState`
- `quickstart.ts` — `quickstartState` (boolean)
- `quotas.ts` — `orgQuotaState`, `orgLimitsState`
- `secrets.ts` — `secretsState`, `activeSecretIdState`
- `subscriptions.ts` — `subscriptionState`, `paymentPlansState`
- `theme.ts` — `themeTypeState`
- `threads.ts` — `threadsState`, `activeThreadIdState`
- `user.ts` — `userState`

**Accessors** (`src/state/accessors.ts`) — Imperative `get*/set*/reset*` for each atom (for use outside React in actions/services).

**Selectors** (`src/state/selectors.ts`) — Hook-based access:
```typescript
// useRecState - Returns [value, setter, resetter] for atomWithReset atoms
// useDerivedState - Returns [value, setter, noOp] for read-only derived atoms
export const useOrgs = () => useRecState(orgsState)
export const useActiveOrg = () => useDerivedState<Organization>(activeOrgState)
export const useActiveProject = () => useDerivedState<Project>(activeProjectState)
export const useActiveAgent = () => useDerivedState<Agent>(activeAgentState)
// ... etc for all entities
```

### API Service Architecture

**Three-layer design**:

1. **ApiService** (`src/services/api.ts`) — Base fetch wrapper:
   - Manages base URL, path prefix (`_`), default headers (`Accept`, `Content-Type: application/json`)
   - `bearer()` — Fetches session token from Neon Auth, sets `Authorization: Bearer <token>`
   - `fetch()` — Core method: builds URL, handles FormData, returns `TApiRes<T>` (data or error)
   - `get()` — Wraps fetch with TanStack QueryClient caching
   - `post()`, `put()`, `delete()` — Simple method wrappers
   - URL building: `apiUrl()` resolves from `TDSK_CADDY_PX_HOST` > `TDSK_PX_URL` > `TDSK_PX_HOST:TDSK_PX_PORT`

2. **BaseApi** (`src/services/api.ts`) — Base class for domain APIs:
   - Holds `api: apiService` singleton reference
   - `_onError()` — Shows toast notification via Sonner + console.warn

3. **Domain APIs** — Entity-specific services extending `BaseApi`:

```
ApiService (base fetch with Bearer auth + TanStack Query caching)
    └── BaseApi (adds _onError toast notifications)
        ├── OrgsApi          ├── EndpointsApi      ├── AssetsApi
        ├── ProjectsApi      ├── FunctionsApi      ├── UsersApi
        ├── AgentsApi (+ SSE .run())  ├── ApiKeysApi    ├── QuotasApi
        ├── SecretsApi       ├── DomainsApi        ├── SubscriptionsApi
        ├── ProvidersApi     ├── ThreadsApi        ├── QuickstartApi
        ├── MessagesApi      └── SandboxApi (CRUD + lifecycle: start, stop, connect, status, sessions)
```

All exported as singletons (e.g., `export const orgsApi = new OrgsApi()`).

**Cache Key Pattern**:
```typescript
cache: TApiCacheKeys = {
  all: () => [this.path] as const,
  list: () => [...this.cache.all(), `list`] as const,
  detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
}
```

**TanStack React Query Integration**:
- `QueryService` (`src/services/query.ts`) wraps `QueryClient`
- Defaults: staleTime 5 min, gcTime 30 min, no retry, refetchOnWindowFocus off

### Authentication System

**Neon Auth Client** (`src/services/auth.ts`):
```typescript
export const authClient = createAuthClient(TDSK_AUTH_URL)

export class Auth {
  client = authClient
  signin(provider: string)   // Social OAuth (GitHub, GitLab, Google, Vercel)
  signout()                  // Sign out + clear session
  session()                  // Get current session (returns { session, user: new User(data.user) })
}
```

**AuthProvider** (`src/contexts/AuthProvider.tsx`):
- Wraps app with `NeonAuthUIProvider` from `@neondatabase/neon-js/auth/react`
- On mount: calls `initAuth()` → `auth.session()`, sets session state
- Shows `Loading` during auth check, `LoginError` on failure

**Protected Routes** (`src/pages/Layout/Layout.tsx`):
- Layout uses Neon Auth's `SignedIn` and `RedirectToSignIn` — all routes under Layout require authentication

**Data Loading Flow**:
- `OrgsLoader` wraps Layout children in `OrgsProvider` which calls `useOrgsState()` on mount
- `ProjectsLoader` wraps project children in `ProjectsProvider` which calls `useProjectsState()` on mount
- Both providers show Loading/AppError states while fetching

### Action Pattern

**API Actions** (`actions/<domain>/api/<action>.ts`):
```typescript
// Async functions that call service → update Jotai state
export const fetchOrgs = async () => {
  const resp = await orgsApi.list()
  if (resp.data) setOrgs(resp.data)
  return resp
}
```

**Local Actions** (`actions/<domain>/local/<action>.ts`):
```typescript
// Synchronous Jotai state mutations
export const upsertAgent = (agent: Agent) => {
  const current = getAgents() || {}
  setAgents({ ...current, [agent.id]: agent })
}
```

Components call API actions which internally delegate to local actions after successful API responses.

### Navigation

**NavService** (`src/services/nav.ts`):
```typescript
class NavService {
  context(ctx?)     // Build nav context from Jotai state (orgId, projectId, agentId, org, project, agents)
  route(route, ctx?) // Build + navigate to parameterized route
  to(to, base?)     // Push state + dispatch popstate event
  is(loc)           // Exact path match
  not(loc)          // Not exact match
  has(loc)          // startsWith match
  back()            // history.back()
  home()            // Navigate to /
  signin()          // Navigate to /auth/sign-in
}
```

**buildRoute** (`src/utils/nav/buildRoute.ts`):
- Takes an `ERoutePath` string and returns a function that accepts `TNavCtx`
- Replaces `:orgId`, `:projectId`, `:agentId` etc. with actual values from context

**Sidebar Navigation** (`src/constants/nav.tsx`):
- `OrgNavItems` — 9 items in 4 groups:
  - **Resources**: Sandboxes (first), Projects
  - **Security**: Secrets, Providers, Domains, Api Keys
  - **Management**: Users, Usage, Settings
  - **AI**: Agents (deprioritized from top-level)
- `ProjectNavItems` — 8 items in 4 groups:
  - **Development**: Sandboxes (first), Endpoints, Functions
  - **Security**: Secrets, Domains
  - **Management**: Settings
  - **AI**: Agents, Threads (deprioritized)
- `BottomNavItems` — 1 item: Settings
- `HeaderSettingsItems` — 3 items: Profile, Billing, Sign Out
- `QSSteps` — 3 quickstart steps: "AI Provider", "Project & Agent", "Review & Create"

### Sandbox UI

**SandboxDrawer** (`src/components/Sandboxes/SandboxDrawer.tsx`):
- **Runtime dropdown**: Select from Claude Code, Codex, OpenCode, or Custom
- **runtimeCommand field**: Read-only for built-in runtimes (auto-populated from `SandboxRuntimeConfigs`), editable for Custom
- **initScript editor**: Monaco editor with shell language, pre-filled with runtime defaults for built-in runtimes
- **Custom command/args fields**: Only visible when runtime is `custom`
- Built-in sandboxes show a badge and have restricted editing (runtime, command fields are read-only)

**Copy Action** (`src/components/Sandboxes/Sandboxes.tsx`):
- Copy button on sandbox list rows triggers `POST /_/sandboxes/:id/copy`
- Copies always have `builtIn: false` — user can customize the copy freely

**ProjectWorkspace** (`src/pages/Projects/ProjectWorkspace.tsx`):
- New project landing page (replaces previous project index route)
- **Quick Actions bar**: Links to Sandboxes, Endpoints, Functions, Agents
- **Sandboxes panel**: Lists project sandboxes with runtime type badges and builtIn indicators
- **Recent Threads panel**: Placeholder for thread activity feed

### Agent Chat (SSE Streaming)

**useAgentChat hook** (`src/hooks/chat/useAgentChat.ts`):
- Calls `agentsApi.run(orgId, agentId, prompt, threadId)` which POSTs to `/_/orgs/:orgId/agents/:agentId/run`
- Reads SSE stream via `ReadableStreamDefaultReader`
- Processes event types: `text`, `toolCallStart`, `toolCallArgs`, `toolResult`, `error`, `thread`
- Returns `{ messages, sendMessage, isStreaming, threadId, error, reset }`

## Architecture

### Application Bootstrap Sequence

```
1. index.html loads → /src/index.tsx
2. overlayScrollBody() → custom scrollbar
3. Render tree:
   <StrictMode>
     <Provider store={store}>              # Jotai global store
       <AuthProvider>                      # NeonAuthUIProvider + session init
         <App>
           <ThemeProvider theme={theme}>   # MUI theme from useMakeTheme()
             <GlobalStyles />              # Admin global CSS
             <MUI GlobalStyles />          # Body text/bg colors
             <RouterProvider>              # React Router 7
               <OrgsLoader>               # Fetch orgs → OrgsContext
                 <Layout>                  # SignedIn guard + Sidebar
                   <Outlet />             # Page content
                 </Layout>
               </OrgsLoader>
             </RouterProvider>
           </ThemeProvider>
         </App>
         <Version />                       # App version footer
       </AuthProvider>
     </Provider>
   </StrictMode>
```

### Request/Data Flow

```
User Action → Component → Action (api/) → Service (api.ts) → TanStack QueryClient cache
                                               ↓
                                         fetch() → Caddy proxy → Auth proxy → Backend
                                               ↓
                                         Response (JSON)
                                               ↓
                                      Domain model instantiation (e.g., new Organization(data))
                                               ↓
                                      Action (local/) → Jotai store update
                                               ↓
                                      Selectors recompute → Components re-render
```

## Key Patterns

### 1. Action Split: API vs Local

Every domain has up to two action subdirectories:
- **`api/`** — Async functions: call service, handle response, update state, return result
- **`local/`** — Synchronous functions: directly mutate Jotai state (upsert, remove, set, reset)

Components call API actions which internally delegate to local actions after successful API responses.

### 2. State: atomWithReset + Accessors + Selectors

Three-layer state design:
1. **Atoms** (state files) — `atomWithReset` for resettable state, derived atoms for computed values
2. **Accessors** (accessors.ts) — Imperative `get*/set*/reset*` functions for use outside React (actions, services)
3. **Selectors** (selectors.ts) — `useRecState`/`useDerivedState` hooks for use inside React components

### 3. Context Providers for Data Loading

```typescript
// OrgsLoader → OrgsProvider → useOrgsState() → fetchOrgs() on mount
// ProjectsLoader → ProjectsProvider → useProjectsState() → fetchProjects() on mount
// Pattern: show Loading while fetching, AppError on failure, MemoChildren on success
```

### 4. Lazy Loading & Code Splitting

All pages use `React.lazy()` wrapped by `SuspensePage` with `<Loading fixed full />` fallback. Pages must use default exports.

### 5. Template Mustache Syntax

The `Templates` service (`src/services/templates.ts`) handles `{{variable}}` template syntax for secret/endpoint value interpolation:
- `has(value)` — Test if string contains `{{...}}`
- `extract(value)` — Extract variable name from `{{name}}`
- `wrap(value)` — Wrap a string in `{{...}}`

### 6. Component Co-location

Each component has its own directory with sub-components and an `index.ts` barrel export. Styled components go in `.styles.tsx` files using `styled()` from `@mui/material/styles`.

### 7. Event Handler Naming

Event handler callbacks always use the `on` prefix: `onBlur`, `onDeleteClick`, `onSuccess`, etc.

## Development Guidelines

### Adding a New Page
Add route enum to `src/types/routes.types.ts` (both relative and absolute forms), create page component with default export in `src/pages/`, add lazy route in `src/routes/Routes.tsx` using `SuspensePage`, and optionally add nav item in `src/constants/nav.tsx`. See existing pages like `src/pages/Orgs/Org.tsx` for the pattern.

### Adding a New Entity
Follow the existing entity pattern: create state atom (`src/state/`), add accessors (`src/state/accessors.ts`), add selectors (`src/state/selectors.ts`), create service class extending `BaseApi` (`src/services/`), create API and local actions (`src/actions/<domain>/`). See `src/state/agents.ts`, `src/services/agentsApi.ts`, and `src/actions/agents/` as reference.

### Adding Global State
Create atom with `atomWithReset` in `src/state/`, add imperative `get*/set*/reset*` in `src/state/accessors.ts`, add hook-based selector in `src/state/selectors.ts`. See any existing state file for the pattern.

### Creating Styled Components
Use `styled()` from `@mui/material/styles` with theme access. Co-locate in `.styles.tsx` files. See `src/pages/Layout/Layout.styles.tsx` or `src/components/Header/Header.styled.tsx` for examples.

## Environment Variables

**Available in Admin** (`src/constants/envs.ts`):
- `TDSK_AUTH_URL` — Neon Auth API URL (required)
- `TDSK_AUTH_PROVIDERS` — Comma-separated OAuth providers (default: `github`)
- `TDSK_AD_APP_VERSION` — App version from package.json (required)
- `TDSK_AD_BASE_PATH` — Base path for deployment (default `/`)
- `TDSK_PX_URL` — Proxy URL
- `TDSK_PX_HOST` / `TDSK_PX_PORT` — Proxy host/port
- `TDSK_CADDY_PX_HOST` — Caddy proxy host (takes priority in apiUrl resolution)
- `TDSK_BE_API_ADMIN_PATH` — Backend admin API path
- `TDSK_POSTHOG_KEY` / `TDSK_POSTHOG_HOST` — PostHog analytics

## Tests

6 co-located test files:
- `src/actions/orgs/api/createOrg.test.ts`
- `src/actions/orgs/api/fetchOrgs.test.ts`
- `src/actions/projects/api/createProject.test.ts`
- `src/actions/projects/api/fetchProjects.test.ts`
- `src/constants/nav.test.tsx`
- `src/utils/api/genFormData.test.ts`

Test setup: `scripts/setupTests.ts` with `scripts/testUtils.tsx` helpers. Test environment: jsdom.

## Common Issues & Solutions

1. **State Not Updating in Component** — Use `useRecState()` or `useDerivedState()` hooks (not `store.get()` in components). Always create new objects/arrays (never mutate).

2. **API Calls Returning 401** — Verify Neon Auth session is valid (`auth.session()`). Check `apiUrl()` resolution (`TDSK_CADDY_PX_HOST` should point to Caddy proxy). Verify `bearer()` has been called on `apiService`.

3. **TanStack Query Cache Issues** — Check `queryKey` uniqueness. Use `query.reset()` to clear all cached data. Defaults: staleTime 5 min, gcTime 30 min.

---
