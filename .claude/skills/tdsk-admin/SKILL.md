---
name: "tdsk-admin"
description: "Knowledge base for the admin SPA dashboard repo"
tags: ["react", "vite", "mui", "jotai", "tanstack-query", "frontend", "admin-dashboard", "billing", "quotas", "agents", "ai-chat", "skills", "schedules"]
---
# Admin Repo Skill

## Overview

The **Admin** repo (`repos/admin`) is the Single Page Application (SPA) dashboard for Threaded Stack. It provides the primary user interface for managing **organizations**, **projects**, API keys, providers, secrets, endpoints, functions, agents, threads, sandboxes, skills, schedules, and other platform resources. Built with modern React tooling, it uses Vite for fast HMR, MUI for UI components, Jotai for lightweight state management, and TanStack React Query for API caching.

**Key Characteristics:**
- **Type**: Frontend SPA Dashboard
- **Package**: `@tdsk/admin` v0.1.0 (private)
- **Authentication**: Neon Auth (via `@neondatabase/neon-js`) with social OAuth providers + email login
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
    ├── index.tsx               # React bootstrap: StrictMode > Jotai Provider > AuthProvider > App + Version
    ├── App.tsx                 # Root: ThemeProvider > GlobalStyles > MUI GlobalStyles > RouterProvider
    ├── actions/                # ~256 files across 22 domains (agents, apiKeys, assets, auth, domains,
    │   │                       #   endpoints, functions, messages, orgs, profile, projectMembers, projects,
    │   │                       #   providers, quickstart, quotas, sandboxes, schedules, secrets, skills,
    │   │                       #   subscriptions, threads, users)
    │   └── <domain>/
    │       ├── api/            # Async: call service > update Jotai state > return response
    │       └── local/          # Sync: direct Jotai state mutations (upsert, remove, set)
    ├── components/             # 49 directories, 210+ files
    │   ├── ActionCards/        # ActionCards
    │   ├── ActionIconButton/   # ActionIconButton
    │   ├── Agents/             # AgentBreadcrumbs, AgentDetailTab, AgentDrawer, AgentLayout, AgentSection,
    │   │                       #   AgentSettingsForm, BasicInfoForm, ModelConfigForm, ModelSelect, WebProviderSettings
    │   ├── AI/                 # AssetsTab, ChatView, CreateThreadDrawer, EditThreadDrawer, MessagesTab, ThreadsTab
    │   ├── Billing/            # CurrentPlan, PlanCard, QuotaUsage
    │   ├── Breadcrumbs/        # Breadcrumbs, OrgSelector, OrgsMenu, ProjectSelector
    │   ├── Endpoints/          # EndpointBreadcrumbs, EndpointDrawer, EndpointFormBase, EndpointLayout, Endpoints,
    │   │                       #   EndpointsTable, EndpointTestPanel, Envs, NoEndpoints
    │   │                       #   + Agent/ (AgentInputs, EndpointAgent), Faas/ (EndpointFass, FaasInputs,
    │   │                       #   ResourcesLimits), Proxy/ (EndpointAuth, EndpointBasicOptions, EndpointHeaders,
    │   │                       #   EndpointOAuth, EndpointProxy, EndpointTransform, EndpointWhitelist, ProxyInputs),
    │   │                       #   Tabs/ (AgentConfigTab, EndpointConfigTab, EndpointTab, EndpointTestTab,
    │   │                       #   FaasConfigTab, ProxyConfigTab)
    │   ├── Functions/          # FunctionDrawer, Functions, NoFunctions
    │   ├── GuiConfig/          # GuiConfigForm (generative UI configuration)
    │   ├── Header/             # Header, Settings, Tabs (+ styled)
    │   ├── Login/              # EmailLoginForm, GithubBtn, GitlabBtn, GoogleBtn, VercelBtn, Login, LoginError (+ styles)
    │   ├── Orgs/               # CreateApiKeyDrawer, CreateOrgDrawer, EditOrgDrawer, NoOrgs, OrgCard, OrgIcon, OrgsGrid
    │   ├── PI/                 # PiChatPanel, PiModelSelector
    │   ├── Projects/           # CreateProjectDrawer, NoProjects, ProjectCard, ProjectIcon, ProjectsGrid, ProjectsMenu
    │   ├── Providers/          # ProviderDrawer, Providers
    │   ├── Quickstart/         # AgentStep, ProviderStep, Quickstart, QuickstartButton, QuickstartWizard, ReviewStep
    │   ├── Sandboxes/          # Sandboxes (list+actions+copy), SandboxDrawer (create/edit with runtime fields), ConnectModal (SSH connection)
    │   ├── Schedules/          # Schedules (list), ScheduleDrawer (create/edit)
    │   ├── Secrets/            # SecretDrawer, Secrets
    │   ├── SecretSelector/     # SecretSelector
    │   ├── Selectors/          # AgentSelector, EndpointSelector, EntitySelector, FunctionsSelector,
    │   │                       #   ProviderSelector, SecretsSelector, ToolsSelector, UserSelector
    │   ├── Sidebar/            # SBLogo, SBNavList, SBProjectSelector, SBSection, Sidebar (+ styles)
    │   ├── Skills/             # Skills (list), SkillDrawer (create/edit)
    │   ├── Users/              # EditUserDrawer, InviteUserDrawer, NoUsers, UserCard, UsersGrid
    │   └── ...                 # AppError, ArrayEditor, CardGrid, Code, DataTable, Domains, EditorList,
    │                           #   EmptyState, ErrorAlert, FilterSelect, FormSection, InfoField, ItemCard,
    │                           #   KeyValueEditor, Link, LoadingButton, LoadingSpinner, PageHeader, PageLayout,
    │                           #   ParamsEditor, Permissions, Roles, SearchBar, Settings, Version
    ├── constants/              # endpoints.ts, envs.ts, monaco.ts, nav.tsx, providers.ts, query.ts, storage.ts, tools.ts, values.ts
    ├── contexts/               # AuthContext/Provider (Neon Auth — OrgsContext/ProjectsContext removed in favor of React Router loaders)
    ├── hooks/                  # 40 files across 7 categories
    │   ├── chat/               # useAgentChat (SSE streaming), useMessageActions
    │   ├── components/         # useAsyncAction, useDrawerActions, useLocalSearch, useQuickStart, useReset, useSteps
    │   ├── endpoints/          # createEndpointFormHook, useAgentFormState, useEndpointFilter, useEndpointForm,
    │   │                       #   useEndpoints, useEndpointTest, useFaasFormState, useProxyFormState, useUnsavedChangesGuard
    │   ├── nav/                # useActiveNavData, useAutoRailSection, useDynamicNav, useRailNav
    │   ├── org/                # useOrgSecrets, useOrgUsersList
    │   ├── permissions/        # useCanPerform, usePermissions
    │   ├── project/            # useProjectSecrets
    │   └── theme/              # useMakeTheme, useTheme, useThemeToggle
    ├── pages/                  # Account, Billing, Home, Layout, Login, Orgs/*, Page, Profile, Projects/* (incl. ProjectWorkspace,
    │                           #   ProjectSandboxes, ProjectMembers, ProjectAI, ProjectThreadDetail, ProjectThreadChat), Providers, Settings
    ├── routes/
    │   ├── Routes.tsx          # createBrowserRouter with lazy loading + SuspensePage helper + RouteError boundary
    │   └── loaders.ts          # 26 React Router v7 loaders (389 lines) — criticalFetch/safeFetch pattern
    ├── services/               # 36 files — singleton service classes (see API Service Architecture)
    ├── state/                  # 22 Jotai atom files + accessors.ts + selectors.ts + index.ts (26 total)
    ├── theme/GlobalStyles.tsx  # Global CSS styles component
    ├── types/                  # 19 type definition files
    └── utils/                  # api/, endpoints/, errors/, nav/, sandbox/, text/, transforms/, user/
```

## Key Files

### Entry Point Flow

1. **index.html** loads `/src/index.tsx` via Vite
2. **src/index.tsx** bootstraps: `StrictMode` > `Jotai Provider (store)` > `AuthProvider` > `App` + `Version`
3. **src/App.tsx** renders: `ThemeProvider` > `GlobalStyles` + MUI `GlobalStyles` > `RouterProvider`

### Routing Configuration

**File**: `src/routes/Routes.tsx`

Uses React Router 7's `createBrowserRouter` with a `SuspensePage` helper component for consistent lazy loading with `Loading` fallback, and a `RouteError` boundary that surfaces loader errors via `AppError`.

**Route Tree**:
```
/ (root)
├── Component: rootLoader > Layout (SignedIn guard + Sidebar + Outlet)
├── / (index) > Home
├── /orgs > Orgs list
├── /billing > Billing/subscriptions
├── /orgs/:orgId (loader: orgScopeLoader)
│   ├── (index) loader: orgDetailLoader > Org dashboard
│   ├── /members loader: orgMembersLoader > OrgUsers
│   ├── /secrets loader: orgSecretsLoader > OrgSecrets
│   ├── /domains loader: orgDomainsLoader > OrgDomains
│   ├── /providers loader: orgProvidersLoader > OrgProviders
│   ├── /sandboxes loader: orgSandboxesLoader > OrgSandboxes
│   ├── /settings > OrgSettings
│   ├── /usage loader: orgUsageLoader > OrgUsage (quota tracking)
│   ├── /skills loader: orgSkillsLoader > OrgSkills
│   ├── /schedules loader: orgSchedulesLoader > OrgSchedules
│   ├── /api-keys loader: orgApiKeysLoader > OrgApiKeys
│   ├── /agents loader: orgAgentsLoader > OrgAgents
│   ├── /projects > Projects list
│   └── /projects/:projectId (loader: projectScopeLoader)
│       ├── (index) loader: projectSandboxesLoader > ProjectWorkspace
│       ├── /endpoints loader: projectEndpointsLoader > ProjectEndpoints
│       ├── /endpoints/:endpointId loader: endpointDetailLoader > EndpointLayout
│       │   ├── (index) > EndpointTab
│       │   ├── /config > EndpointConfigTab
│       │   └── /test > EndpointTestTab
│       ├── /secrets loader: projectSecretsLoader > ProjectSecrets
│       ├── /domains loader: projectDomainsLoader > ProjectDomains
│       ├── /functions loader: projectFunctionsLoader > ProjectFunctions
│       ├── /agents loader: projectAgentsLoader > ProjectAgents
│       ├── /sandboxes loader: projectSandboxesLoader > ProjectSandboxes
│       ├── /agents/:agentId loader: agentDetailLoader > AgentLayout
│       │   ├── (index) > AgentDetailTab
│       │   ├── /threads loader: projectThreadsLoader > ProjectThreads
│       │   ├── /chat > AgentChat (ChatView)
│       │   ├── /threads/:threadId loader: threadDetailLoader > ProjectThreadDetail
│       │   ├── /threads/:threadId/chat loader: threadDetailLoader > ProjectThreadChat
│       │   ├── /skills > SkillsTab
│       │   └── /schedules > SchedulesTab
│       ├── /api-keys loader: projectApiKeysLoader > ProjectApiKeys
│       ├── /settings > ProjectSettings
│       └── /members loader: projectMembersLoader > ProjectMembers
├── /settings > Settings
├── /profile > Profile
├── /auth/:pathname > Login
├── /account/:pathname > Account
└── * > Redirect to /
```

**React Router v7 Loaders** (`src/routes/loaders.ts` — 389 lines):

26 loaders total using a `criticalFetch`/`safeFetch` pattern:
- `criticalFetch` — Throws on error so the route's `errorElement` renders. Used for top-level data the app cannot function without (e.g., orgs).
- `safeFetch` — Silently returns `undefined` on error. Used for data that can load lazily or fail gracefully.

Loader hierarchy:
- `rootLoader` — Fetches orgs (critical)
- `orgScopeLoader` — Sets active org ID, fetches projects + providers (safe)
- `orgDetailLoader`, `orgMembersLoader`, `orgSecretsLoader`, `orgDomainsLoader`, `orgProvidersLoader`, `orgSandboxesLoader`, `orgUsageLoader`, `orgApiKeysLoader`, `orgAgentsLoader`, `orgSkillsLoader`, `orgSchedulesLoader` — Org-level data
- `projectScopeLoader` — Sets active project ID
- `projectEndpointsLoader`, `projectFunctionsLoader`, `projectSecretsLoader`, `projectDomainsLoader`, `projectAgentsLoader`, `projectSandboxesLoader`, `projectThreadsLoader`, `projectMembersLoader`, `projectApiKeysLoader` — Project-level data
- `agentDetailLoader`, `endpointDetailLoader`, `threadDetailLoader` — Entity-level detail

**Route Path Enum** (`src/types/routes.types.ts`):
```typescript
enum ERoutePath {
  // Global
  Home = `/`, Auth = `/auth`, Signin = `/auth/sign-in`, Signout = `/auth/sign-out`,
  AuthPage = `/auth/:pathname`, Account = `/account/:pathname`,
  Profile = `profile`, Billing = `billing`, Settings = `settings`,

  // Org (relative paths for nested routing)
  Orgs = `/orgs`, Org = `/orgs/:orgId`,
  Members = `members`, Secrets = `secrets`, Domains = `domains`, Providers = `providers`,
  ApiKeys = `api-keys`, Usage = `usage`, Projects = `projects`,
  Skills = `skills`, Schedules = `schedules`, Sandboxes = `sandboxes`,

  // Org (absolute paths for nav/links)
  OrgMembers = `/orgs/:orgId/members`, OrgSecrets = `/orgs/:orgId/secrets`,
  OrgDomains = `/orgs/:orgId/domains`, OrgProviders = `/orgs/:orgId/providers`,
  OrgSettings = `/orgs/:orgId/settings`, OrgUsage = `/orgs/:orgId/usage`,
  OrgApiKeys = `/orgs/:orgId/api-keys`, OrgProjects = `/orgs/:orgId/projects`,
  OrgSandboxes = `/orgs/:orgId/sandboxes`, OrgAgents = `/orgs/:orgId/agents`,
  OrgSkills = `/orgs/:orgId/skills`, OrgSchedules = `/orgs/:orgId/schedules`,

  // Project (relative and absolute)
  ProjectId = `projects/:projectId`, OrgProject = `/orgs/:orgId/projects/:projectId`,
  Endpoints = `endpoints`, Functions = `functions`, Agents = `agents`,
  Agent = `agents/:agentId`, Endpoint = `endpoints/:endpointId`,
  Threads = `threads`,

  // Agent nested
  AgentChat = `agents/:agentId/chat`, AgentThreads = `agents/:agentId/threads`,
  AgentThreadDetail = `threads/:threadId`, AgentThreadChat = `threads/:threadId/chat`,

  // Project absolute paths
  ProjectAgents, ProjectEndpoints, ProjectSecrets, ProjectDomains, ProjectApiKeys,
  ProjectSettings, ProjectSandboxes, ProjectFunctions, ProjectMembers,
  ProjectAgent, ProjectAgentChat, ProjectAgentThreads,
  ProjectAgentThreadDetail, ProjectAgentThreadChat,
  ProjectEndpoint, ProjectEndpointConfig, ProjectEndpointTest,

  Star = `*`
}
```

**Key design**: Route paths exist in both relative form (for nested React Router children, e.g., `members`) and absolute form (for navigation links, e.g., `/orgs/:orgId/members`). The `buildRoute()` utility replaces `:orgId`, `:projectId`, etc. with actual IDs from context.

### State Management (Jotai)

**Global Store** (`src/state/accessors.ts`): `export const store = createStore()`

**22 State Atom Files** with the following pattern:
```typescript
// state/<entity>.ts
import { atomWithReset } from 'jotai/utils'
export const entityState = atomWithReset<Record<string, Entity> | undefined>(undefined)
export const activeEntityIdState = atomWithReset<string | undefined>(undefined)
```

**All atom files and their exports**:
- `agents.ts` — `agentsState`, `activeAgentIdState`, `activeAgentState` (derived), `orgAgentsState` (derived), `projectAgentsState` (derived)
- `apiKeys.ts` — `apiKeysState`, `activeApiKeyIdState`
- `app.ts` — `sidebarOpenState`, `activeRailSectionState`
- `assets.ts` — `assetsState`, `activeAssetIdState`, `orgAssetsState` (derived), `projectAssetsState` (derived)
- `domains.ts` — `domainsState`, `activeDomainIdState`, `orgDomainsState` (derived), `projectDomainsState` (derived)
- `endpoints.ts` — `endpointsState`, `activeEndpointIdState`, `activeEndpointState` (derived), `projectEndpointsState` (derived), `proxyFormState`, `faasFormState`, `agentFormState`, `endpointTabsDisabledState`
- `functions.ts` — `functionsState`, `activeFunctionIdState`, `projectFunctionsState` (derived)
- `invoices.ts` — `invoicesState` (flat `Invoice[]`)
- `messages.ts` — `messagesState`, `activeMessageIdState`, `threadMessagesState` (derived)
- `orgs.ts` — `orgsState`, `orgUsersState`, `activeOrgIdState`, `activeOrgRoleState` (derived), `activeOrgState` (derived)
- `projectMembers.ts` — `projectMembersState` (keyed by projectId), `activeProjectMembersState` (derived from activeProjectId)
- `projects.ts` — `projectsState`, `activeProjectIdState`, `activeProjectState` (derived)
- `providers.ts` — `providersState`
- `quickstart.ts` — `quickstartState` (boolean)
- `quotas.ts` — `orgQuotaState`, `orgLimitsState`
- `sandboxes.ts` — `sandboxesState`, `orgSandboxesState` (derived), `projectSandboxesState` (derived)
- `schedules.ts` — `schedulesState`, `activeScheduleIdState` (org-scoped, flat `Record<string, Schedule>`)
- `secrets.ts` — `secretsState`, `activeSecretIdState`, `activeOrgSecretIdState`, `orgSecretsState` (derived), `projectSecretsState` (derived)
- `skills.ts` — `skillsState`, `activeSkillIdState` (org-scoped, flat `Record<string, Skill>`)
- `subscriptions.ts` — `subscriptionState`, `paymentPlansState`
- `theme.ts` — `themeTypeState`
- `threads.ts` — `threadsState`, `activeThreadIdState`, `activeThreadState` (derived), `orgThreadsState` (derived), `projectThreadsState` (derived)
- `user.ts` — `userState`

**Accessors** (`src/state/accessors.ts`) — Imperative `get*/set*/reset*` for each atom (for use outside React in actions/services). Includes scope-keyed accessors: `getContext*/setContext*` for agents, domains, threads, assets, sandboxes; `getProject*/setProject*` for endpoints, functions, secrets, members; `getThread*/setThread*` for messages.

**Selectors** (`src/state/selectors.ts`) — Hook-based access:
```typescript
// useRecState - Returns [value, setter, resetter] for atomWithReset atoms
// useDerivedState - Returns [value, setter, noOp] for read-only derived atoms
export const useOrgs = () => useRecState(orgsState)
export const useActiveOrg = () => useDerivedState<Organization>(activeOrgState)
export const useActiveProject = () => useDerivedState<Project>(activeProjectState)
export const useActiveAgent = () => useDerivedState<Agent>(activeAgentState)

// Project-scoped derived selectors
export const useProjectEndpoints = () => useDerivedState(projectEndpointsState)
export const useProjectFunctions = () => useDerivedState(projectFunctionsState)
export const useProjectSecrets = () => useDerivedState(projectSecretsState)
export const useProjectAgents = () => useDerivedState(projectAgentsState)
export const useProjectDomains = () => useDerivedState(projectDomainsState)
export const useProjectThreads = () => useDerivedState(projectThreadsState)
export const useProjectAssets = () => useDerivedState(projectAssetsState)
export const useProjectSandboxes = () => useDerivedState(projectSandboxesState)
export const useProjectMembers = () => useRecState(projectMembersState)
export const useActiveProjectMembers = () => useDerivedState(activeProjectMembersState)

// Org-scoped derived selectors
export const useOrgAgents = () => useDerivedState(orgAgentsState)
export const useOrgDomains = () => useDerivedState(orgDomainsState)
export const useOrgThreads = () => useDerivedState(orgThreadsState)
export const useOrgAssets = () => useDerivedState(orgAssetsState)
export const useOrgSandboxes = () => useDerivedState(orgSandboxesState)

// Org-scoped flat atoms (skills, schedules)
export const useSkills = () => useRecState(skillsState)
export const useActiveSkillId = () => useRecState(activeSkillIdState)
export const useSchedules = () => useRecState(schedulesState)
export const useActiveScheduleId = () => useRecState(activeScheduleIdState)

// Thread-scoped
export const useActiveThread = () => useDerivedState(activeThreadState)
export const useThreadMessages = () => useDerivedState(threadMessagesState)

// Billing
export const useInvoices = () => useRecState(invoicesState)
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
        ├── OrgsApi              ├── EndpointsApi          ├── AssetsApi
        ├── ProjectsApi          ├── FunctionsApi          ├── UsersApi
        ├── AgentsApi (+ SSE .run())  ├── ApiKeysApi       ├── QuotasApi
        ├── SecretsApi           ├── DomainsApi            ├── SubscriptionsApi
        ├── ProvidersApi         ├── ThreadsApi            ├── QuickstartApi
        ├── MessagesApi          ├── FilesApi              ├── SkillsApi
        ├── ProjectMembersApi    ├── SchedulesApi          ├── AgentWSService (WebSocket agent sessions)
        ├── SandboxApi (CRUD + lifecycle: start, stop, connect, status, sessions)
        └── EndpointTestApi
```

36 service files total. All exported as singletons (e.g., `export const orgsApi = new OrgsApi()`).

Additional services:
- `agentWSService.ts` — WebSocket agent sessions (separate from SSE-based `agentsApi.run()`)
- `projectMembersApi.ts` — Project member management (add, remove, list)
- `schedulesApi.ts` — Schedule CRUD + trigger
- `skillsApi.ts` — Skill CRUD
- `filesApi.ts` — File operations
- `endpointTestApi.ts` — Endpoint testing
- `tokenRefresh.ts` — Token refresh management
- `storage.ts` — Local storage wrapper
- `templates.ts` — Mustache template syntax for secret/endpoint value interpolation

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
- On mount: calls `initAuth()` > `auth.session()`, sets session state
- Shows `Loading` during auth check, `LoginError` on failure

**Login Components** (`src/components/Login/`):
- Social login buttons: `GithubBtn`, `GitlabBtn`, `GoogleBtn`, `VercelBtn`
- `EmailLoginForm` — Email-based login form
- `Login` — Main login component composing social + email login
- `LoginError` — Error display for auth failures

**Protected Routes** (`src/pages/Layout/Layout.tsx`):
- Layout uses Neon Auth's `SignedIn` and `RedirectToSignIn` — all routes under Layout require authentication

**Data Loading Flow**:
- React Router v7 loaders handle all data fetching — no more `OrgsProvider`/`ProjectsProvider` context-based loading
- `rootLoader` fetches orgs on app boot (critical)
- `orgScopeLoader` sets active org ID and fetches projects + providers
- Entity-specific loaders fetch data for each route on navigation

### Action Pattern

**API Actions** (`actions/<domain>/api/<action>.ts`):
```typescript
// Async functions that call service > update Jotai state
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

**Action Domains (22 total)**:
| Domain | API Actions | Local Actions |
|--------|-------------|---------------|
| agents | fetchAgents, createAgent, updateAgent, deleteAgent, runAgent | upsertAgent, removeAgent, setAgents |
| apiKeys | fetchApiKeys, createApiKey, deleteApiKey | setApiKeys, upsertApiKey, removeApiKey |
| assets | fetchAssets | setAssets |
| auth | — | signout |
| domains | fetchDomains, createDomain, deleteDomain | setDomains, upsertDomain, removeDomain |
| endpoints | fetchEndpoints, createEndpoint, updateEndpoint, deleteEndpoint, testEndpoint | setEndpoints, upsertEndpoint, removeEndpoint |
| functions | fetchFunctions, createFunction, updateFunction, deleteFunction, fetchFunction | setFunctions, upsertFunction, removeFunction |
| messages | fetchMessages, createMessage | setMessages |
| orgs | fetchOrgs, createOrg, updateOrg, deleteOrg | setOrgs, upsertOrg, removeOrg |
| profile | updateProfile | setProfile |
| projectMembers | listProjectMembers, addProjectMember, removeProjectMember | setProjectMembers, upsertProjectMember, removeProjectMember |
| projects | fetchProjects, createProject, updateProject, deleteProject | setProjects, upsertProject, removeProject |
| providers | fetchProviders, createProvider, updateProvider, deleteProvider, fetchProvider | setProviders, upsertProvider, removeProvider |
| quickstart | runQuickstart | setQuickstart |
| quotas | fetchOrgQuota, fetchOrgLimits | setOrgQuota, setOrgLimits |
| sandboxes | fetchSandboxes, createSandbox, updateSandbox, deleteSandbox, copySandbox, connectSandbox | setSandboxes, upsertSandbox, removeSandbox |
| schedules | fetchSchedules, createSchedule, updateSchedule, deleteSchedule, triggerSchedule | setSchedules, upsertSchedule, removeSchedule |
| secrets | fetchSecrets, createSecret, updateSecret, deleteSecret | setSecrets, upsertSecret, removeSecret |
| skills | fetchSkills, createSkill, updateSkill, deleteSkill | setSkills, upsertSkill, removeSkill |
| subscriptions | fetchSubscription, createSubscription, updateSubscription | setSubscription |
| threads | fetchThreads, createThread, updateThread, deleteThread | setThreads, upsertThread, removeThread |
| users | listOrgUsers, inviteToOrg, removeFromOrg, updateOrgRole | setOrgUsers |

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

Uses a rail navigation pattern with `RailNavSections` (Home, Org, Project) and `TSubNavGroup` groupings.

- `OrgSubNavGroups` — 3 groups:
  - **Resources**: Projects, Sandboxes, Providers, Skills, Agents
  - **Security**: Secrets, API Keys, Domains
  - **Management**: Members, Schedules, Usage, Settings
- `ProjectSubNavGroups` — 3 groups:
  - **Development**: Sandboxes, Endpoints, Functions, Agents
  - **Security**: Secrets, API Keys, Domains
  - **Management**: Members, Settings
- `HeaderSettingsItems` — 3 items: Profile, Billing, Sign Out
- `BottomNavItems` — 1 item: Settings
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

**AgentWSService** (`src/services/agentWSService.ts`):
- WebSocket-based agent session management (alternative to SSE streaming)

### Skills & Schedules UI

**Skills** (`src/components/Skills/`):
- `Skills.tsx` — List view with create/edit/delete actions
- `SkillDrawer.tsx` — Create/edit drawer form
- Org-scoped resource, accessible at `/orgs/:orgId/skills` and as a tab under agent detail

**Schedules** (`src/components/Schedules/`):
- `Schedules.tsx` — List view with create/edit/delete/trigger actions
- `ScheduleDrawer.tsx` — Create/edit drawer form
- Org-scoped resource, accessible at `/orgs/:orgId/schedules` and as a tab under agent detail

### GuiConfig

**GuiConfigForm** (`src/components/GuiConfig/GuiConfigForm.tsx`):
- Generative UI configuration form component

## Architecture

### Application Bootstrap Sequence

```
1. index.html loads > /src/index.tsx
2. overlayScrollBody() > custom scrollbar
3. Render tree:
   <StrictMode>
     <Provider store={store}>              # Jotai global store
       <AuthProvider>                      # NeonAuthUIProvider + session init
         <App>
           <ThemeProvider theme={theme}>   # MUI theme from useMakeTheme()
             <GlobalStyles />              # Admin global CSS
             <MUI GlobalStyles />          # Body text/bg colors
             <RouterProvider>              # React Router 7 + loaders
               <Layout>                   # SignedIn guard + Sidebar
                 <Outlet />               # Page content
               </Layout>
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
Route Navigation > React Router Loader > Action (api/) > Service (api.ts) > TanStack QueryClient cache
                                                              |
                                                         fetch() > Caddy proxy > Auth proxy > Backend
                                                              |
                                                         Response (JSON)
                                                              |
                                                      Domain model instantiation (e.g., new Organization(data))
                                                              |
                                                      Action (local/) > Jotai store update
                                                              |
                                                      Selectors recompute > Components re-render
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

### 3. React Router v7 Loaders for Data Loading

Data loading is handled by React Router v7 loaders in `src/routes/loaders.ts`:
```typescript
// criticalFetch — throws on error, renders errorElement
// safeFetch — silently returns undefined on error
export const orgScopeLoader = async ({ params }: LoaderFunctionArgs) => {
  setActiveOrgId(params.orgId!)
  await Promise.all([safeFetch(fetchProjects, getProjects), ...])
  return null
}
```

Loaders run before the route component renders, ensuring data is available on mount.

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

### 8. useAsyncAction Hook

Common hook for wrapping async operations with loading/error state:
```typescript
const { loading, error, setError, clearError, run } = useAsyncAction()
await run(() => createAgent(data))
```

## Development Guidelines

### Adding a New Page
Add route enum to `src/types/routes.types.ts` (both relative and absolute forms), create page component with default export in `src/pages/`, add lazy route in `src/routes/Routes.tsx` using `SuspensePage`, add loader in `src/routes/loaders.ts` if data fetching is needed, and optionally add nav item in `src/constants/nav.tsx`. See existing pages like `src/pages/Orgs/OrgSkills.tsx` for the pattern.

### Adding a New Entity
Follow the existing entity pattern: create state atom (`src/state/`), add accessors (`src/state/accessors.ts`), add selectors (`src/state/selectors.ts`), create service class extending `BaseApi` (`src/services/`), create API and local actions (`src/actions/<domain>/`), add loader to `src/routes/loaders.ts`. See `src/state/skills.ts`, `src/services/skillsApi.ts`, and `src/actions/skills/` as reference.

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

53 co-located test files across actions, components, hooks, pages, routes, services, and utils:

**Actions** (24 test files):
- `actions/auth/local/signout.test.ts`
- `actions/endpoints/api/fetchEndpoints.test.ts`, `testEndpoint.test.ts`
- `actions/functions/api/` — createFunction, deleteFunction, fetchFunction, fetchFunctions, updateFunction (5 files)
- `actions/orgs/api/` — createOrg, fetchOrgs (2 files)
- `actions/projectMembers/api/` — addProjectMember, listProjectMembers, removeProjectMember (3 files)
- `actions/projects/api/` — createProject, fetchProjects (2 files)
- `actions/providers/api/` — createProvider, deleteProvider, fetchProvider, fetchProviders, updateProvider (5 files)
- `actions/users/api/` — inviteToOrg, listOrgUsers, removeFromOrg, updateOrgRole (4 files)

**Components** (12 test files):
- `Agents/AgentDrawer.test.tsx`
- `AI/EditThreadDrawer.test.tsx`, `ThreadsTab.test.tsx`
- `Login/EmailLoginForm.test.tsx`, `Login.test.tsx`
- `Orgs/CreateApiKeyDrawer.test.tsx`
- `Quickstart/ProviderStep.test.tsx`, `QuickstartWizard.test.tsx`, `ReviewStep.test.tsx`
- `SearchBar/SearchBar.test.tsx`
- `Selectors/AgentSelector.test.tsx`, `EntitySelector.test.tsx`
- `Users/EditUserDrawer.test.tsx`, `Users.test.tsx`

**Other** (17 test files):
- `hooks/chat/useAgentChat.test.ts`, `hooks/endpoints/useEndpointTest.test.ts`
- `pages/Login/Login.test.tsx`, `pages/Orgs/Org.test.tsx`, `pages/Projects/Project.test.tsx`, `pages/Projects/ProjectThreads.test.tsx`
- `routes/loaders.test.ts`
- `services/api.test.ts`, `auth.test.ts`, `endpointTestApi.test.ts`, `query.test.ts`, `tokenRefresh.test.ts`
- `constants/nav.test.tsx`
- `utils/endpoints/snippets.test.ts`, `utils/nav/getRailNavConfig.test.tsx`

Test setup: `scripts/setupTests.ts` with `scripts/testUtils.tsx` helpers. Test environment: jsdom.

## Common Issues & Solutions

1. **State Not Updating in Component** — Use `useRecState()` or `useDerivedState()` hooks (not `store.get()` in components). Always create new objects/arrays (never mutate).

2. **API Calls Returning 401** — Verify Neon Auth session is valid (`auth.session()`). Check `apiUrl()` resolution (`TDSK_CADDY_PX_HOST` should point to Caddy proxy). Verify `bearer()` has been called on `apiService`.

3. **TanStack Query Cache Issues** — Check `queryKey` uniqueness. Use `query.reset()` to clear all cached data. Defaults: staleTime 5 min, gcTime 30 min.

4. **Loader Not Firing** — Ensure the route has a `loader` property in `Routes.tsx`. Check that loaders are imported from `@TAF/routes/loaders`. Verify the route path matches the expected pattern.

---
