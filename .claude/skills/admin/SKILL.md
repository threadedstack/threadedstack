---
name: "Threaded Stack - Admin Repo"
description: "Knowledge base for the admin SPA dashboard repo"
version: "2.0.0"
tags: ["react", "vite", "mui", "jotai", "tanstack-query", "frontend", "admin-dashboard", "billing", "quotas", "agents", "ai-chat"]
---
# Admin Repo Skill

## Overview

The **Admin** repo (`repos/admin`) is the Single Page Application (SPA) dashboard for Threaded Stack. It provides the primary user interface for managing **organizations**, **projects**, API keys, providers, secrets, endpoints, functions, agents, threads, and other platform resources. Built with modern React tooling, it uses Vite for fast HMR, MUI for UI components, Jotai for lightweight state management, and TanStack React Query for API caching.

**Key Characteristics:**
- **Type**: Frontend SPA Dashboard
- **Package**: `@tdsk/admin` v0.1.0 (private)
- **Tech Stack**: Vite 5, React 18.3, Material-UI 6.1.2, Jotai 2.16.1, TanStack React Query 5.90.16, React Router 7.1.1, TypeScript 5.3
- **Authentication**: Neon Auth (via `@neondatabase/neon-js` 0.1.0-beta.21) with social OAuth providers
- **Path Aliases**: Uses `@TAF/*` prefix via `alias-hq` for internal imports
- **Build Tool**: Vite with SWC (`@vitejs/plugin-react-swc`) for fast React compilation
- **Styling**: Emotion (CSS-in-JS) + Material-UI theming system
- **Toasts**: Sonner 2.0.7
- **Analytics**: PostHog (`posthog-js` 1.242.2)
- **Total Files**: ~400+ TypeScript/TSX files across 18 action domains, 38+ component directories, 22+ services, 21 state atoms, 32+ hooks

## Directory Structure

```
repos/admin/
├── index.html                       # Entry HTML (loads /src/index.tsx)
├── package.json                     # v0.1.0, private, type: module
├── tsconfig.json                    # TypeScript config with path mappings
├── configs/
│   ├── biome.json                   # Biome linter config
│   ├── frontend.config.ts           # Env loading & alias setup (loadConfig)
│   ├── nginx.conf                   # Nginx deployment config
│   ├── vite.config.ts               # Vite entry point (delegates to vite.workspace.ts)
│   └── vite.workspace.ts            # Main Vite config (React SWC, aliases, tsconfig paths, markdown loader, test config)
├── scripts/
│   ├── addToProcess.ts              # Add envs to process.env
│   ├── loadEnvs.ts                  # Environment variable loader
│   ├── registerPaths.ts             # Path alias registration
│   ├── setupTests.ts                # Vitest test setup
│   └── testUtils.tsx                # Test utility helpers
└── src/
    ├── index.tsx                    # React bootstrap: StrictMode → Jotai Provider → AuthProvider → App + Version
    ├── App.tsx                      # Root: ThemeProvider → GlobalStyles → MUI GlobalStyles → RouterProvider
    ├── actions/                     # ~160 files across 18 domains
    │   ├── agents/
    │   │   ├── api/                 # createAgent, deleteAgent, fetchAgent, fetchAgents, updateAgent
    │   │   └── local/               # upsertAgent, upsertAgents, removeAgent
    │   ├── apiKeys/                 # createApiKey, fetchApiKey, fetchApiKeys, revokeApiKey, updateApiKey
    │   ├── assets/
    │   │   ├── api/                 # fetchAssets, deleteAsset
    │   │   └── local/               # upsertAsset, upsertAssets, removeAsset
    │   ├── auth/
    │   │   └── local/               # init, signin, signout, reset
    │   ├── domains/
    │   │   ├── api/                 # createDomain, deleteDomain, fetchDomain, fetchDomains, updateDomain
    │   │   └── local/               # upsertDomain, upsertDomains, removeDomain
    │   ├── endpoints/
    │   │   ├── api/                 # createEndpoint, deleteEndpoint, fetchEndpoint, fetchEndpoints, updateEndpoint
    │   │   └── local/               # upsertEndpoint, upsertEndpoints, removeEndpoint, setProxyFormField, setFaasFormField, setAgentFormField
    │   ├── functions/               # createFunction, deleteFunction, fetchFunction, fetchFunctions, updateFunction
    │   ├── messages/
    │   │   ├── api/                 # fetchMessages, updateMessage, deleteMessage
    │   │   └── local/               # upsertMessage, upsertMessages, removeMessage
    │   ├── orgs/
    │   │   ├── api/                 # createOrg, deleteOrg, fetchOrg, fetchOrgs, updateOrg (+ tests)
    │   │   └── local/               # setOrgActive, unsetActiveOrg
    │   ├── profile/
    │   │   ├── api/                 # updateProfile
    │   │   └── local/               # (index only)
    │   ├── projects/
    │   │   ├── api/                 # createProject, deleteProject, fetchProject, fetchProjects, updateProject (+ tests)
    │   │   └── local/               # setProjectActive, unsetActiveProject
    │   ├── providers/               # createProvider, deleteProvider, fetchProvider, fetchProviders, updateProvider
    │   ├── quickstart/
    │   │   ├── api/                 # create (one-shot Provider+Secret+Project+Agent+Endpoint)
    │   │   └── local/               # toggle
    │   ├── quotas/
    │   │   ├── api/                 # checkQuota, fetchOrgLimits, fetchOrgQuota
    │   │   └── local/               # setOrgLimits, setOrgQuota
    │   ├── secrets/
    │   │   ├── api/                 # createSecret, deleteSecret, fetchSecret, fetchSecrets, updateSecret
    │   │   └── local/               # upsertSecret, setSecrets, removeSecret
    │   ├── subscriptions/
    │   │   ├── api/                 # cancelSubscription, createCheckoutSession, createPortalSession, fetchCurrentSubscription, fetchPaymentPlans
    │   │   └── local/               # setPlans, setSubscription
    │   ├── threads/
    │   │   ├── api/                 # branchThread, createThread, deleteThread, fetchThreads, updateThread
    │   │   └── local/               # upsertThread, upsertThreads, removeThread
    │   └── users/                   # inviteToOrg, listOrgUsers, removeFromOrg, updateOrgRole
    ├── components/                  # 38+ directories, 140+ files
    │   ├── ActionIconButton/
    │   ├── Agents/                  # AgentDrawer, AgentSettingsForm, BasicInfoForm, ModelConfigForm, SecretsSelector, ToolsSelector
    │   ├── AI/                      # AssetsTab, ChatView, CreateThreadDrawer, EditThreadDrawer, MessageBubble, MessagesTab, ThreadsTab, ToolCallDisplay
    │   ├── AppError/
    │   ├── ArrayEditor/
    │   ├── Billing/                 # CurrentPlan, PlanCard, QuotaUsage
    │   ├── Breadcrumbs/             # OrgSelector, OrgsMenu, ProjectSelector
    │   ├── CardGrid/
    │   ├── Code/
    │   ├── DataTable/
    │   ├── Domains/                 # DomainDrawer, Domains
    │   ├── EmptyState/
    │   ├── Endpoints/               # EndpointDrawer, EndpointFormBase, Endpoints, EndpointsTable, Envs, NoEndpoints
    │   │   ├── Agent/               # AgentInputs, EndpointAgent
    │   │   ├── Faas/                # EndpointFass, FaasInputs, ResourcesLimits
    │   │   └── Proxy/               # EndpointAuth, EndpointBasicOptions, EndpointHeaders, EndpointOAuth, EndpointProxy, EndpointTransform, EndpointWhitelist, ProxyInputs
    │   ├── ErrorAlert/
    │   ├── FilterSelect/
    │   ├── Functions/               # FunctionCard, FunctionDrawer, FunctionsGrid, NoFunctions
    │   ├── Header/
    │   ├── InfoField/
    │   ├── ItemCard/
    │   ├── KeyValueEditor/
    │   ├── Link/
    │   ├── LoadingButton/
    │   ├── LoadingSpinner/
    │   ├── Login/                   # GithubBtn, GitlabBtn, GoogleBtn, VercelBtn, LoginError
    │   ├── Orgs/                    # CreateApiKeyDrawer, CreateOrgDrawer, EditOrgDrawer, NoOrgs, OrgCard, OrgIcon, OrgsGrid
    │   ├── PageHeader/
    │   ├── PageLayout/
    │   ├── Permissions/             # PermissionGate
    │   ├── Projects/                # CreateProjectDrawer, NoProjects, ProjectCard, ProjectIcon, ProjectsGrid, ProjectsMenu
    │   ├── Providers/               # ProviderDrawer, Providers
    │   ├── Quickstart/              # AgentStep, ProviderStep, QuickstartButton, QuickstartWizard, ReviewStep
    │   ├── Roles/                   # EditRoleDrawer, RoleSelect
    │   ├── SearchBar/
    │   ├── Secrets/                 # SecretDrawer, Secrets
    │   ├── Settings/                # DangerZoneCard, InfoCard, SettingsFormCard
    │   ├── Sidebar/                 # SBLogo, SBNavList, SBProjectSelector, SBSection, Sidebar
    │   ├── Users/                   # InviteUserDrawer, NoUsers, UserCard, UsersGrid
    │   └── Version/
    ├── constants/
    │   ├── endpoints.ts             # Default endpoint form states (DefProxyState, DefFaasState, DefAgentState)
    │   ├── envs.ts                  # Environment variable exports (TDSK_AUTH_URL, etc.)
    │   ├── monaco.ts                # Monaco editor config
    │   ├── nav.tsx                  # Navigation items: OrgNavItems, ProjectNavItems, BottomNavItems, HeaderSettingsItems, QSSteps
    │   ├── providers.ts             # Provider-related constants
    │   ├── query.ts                 # Cache timing: DefCacheStaleTime (5min), DefRefetchInterval (5min), DefCacheGarbageColTime (30min)
    │   ├── storage.ts               # Storage key constants (ThemeTypeStorageKey, ApiHeadersStorageKey)
    │   ├── tools.ts                 # Tool-related constants
    │   └── values.ts                # Static values
    ├── contexts/
    │   ├── AuthContext.ts           # Auth context definition
    │   ├── AuthProvider.tsx         # Neon Auth provider (NeonAuthUIProvider + session init + loading/error states)
    │   ├── OrgsContext.ts           # Orgs context definition
    │   ├── OrgsProvider.tsx         # Fetches orgs on mount, provides via context
    │   ├── ProjectsContext.ts       # Projects context definition
    │   └── ProjectsProvider.tsx     # Fetches projects on mount, provides via context
    ├── hooks/
    │   ├── chat/
    │   │   └── useAgentChat.ts      # SSE streaming chat with agent (sendMessage, isStreaming, messages, threadId, error, reset)
    │   ├── components/
    │   │   ├── useDrawerActions.ts   # Drawer open/close actions
    │   │   ├── useLocalSearch.ts     # Client-side search filtering
    │   │   ├── useQuickStart.ts      # Quickstart wizard state
    │   │   ├── useReset.ts           # Reset state on unmount
    │   │   └── useSteps.ts           # Multi-step form state
    │   ├── endpoints/
    │   │   ├── useAgentFormState.ts  # Agent endpoint form state
    │   │   ├── useEndpointFilter.ts  # Endpoint type filtering
    │   │   ├── useEndpointForm.ts    # Endpoint form state management
    │   │   ├── useEndpoints.ts       # Endpoints data hook
    │   │   ├── useFaasFormState.ts   # FaaS endpoint form state
    │   │   └── useProxyFormState.ts  # Proxy endpoint form state
    │   ├── nav/
    │   │   ├── useActiveNavData.ts   # Active navigation data from route params
    │   │   ├── useAgentsSidebarSync.ts # Sync agents to sidebar nav
    │   │   └── useDynamicNav.ts      # Dynamic navigation based on context
    │   ├── org/
    │   │   ├── useOrgsState.ts       # Fetch orgs on mount, provide orgs/loading/error
    │   │   └── useOrgUsersList.ts    # Org users list hook
    │   ├── permissions/
    │   │   ├── useCanPerform.tsx     # Check if user can perform action
    │   │   └── usePermissions.tsx    # Permissions resolution hook
    │   ├── project/
    │   │   └── useProjectsState.ts   # Fetch projects on mount, provide projects/loading/error
    │   └── theme/
    │       ├── useMakeTheme.ts       # MUI theme builder hook (watches themeTypeState)
    │       ├── useTheme.ts           # Theme access hook
    │       └── useThemeToggle.ts     # Theme toggle hook
    ├── pages/
    │   ├── Account/Account.tsx
    │   ├── Billing/Billing.tsx
    │   ├── Home/Home.tsx
    │   ├── Layout/
    │   │   ├── Layout.tsx           # Auth guard: SignedIn → Sidebar + Outlet; RedirectToSignIn fallback
    │   │   └── Layout.styles.tsx    # LayoutContainer, LayoutContent styled components
    │   ├── Login/
    │   │   ├── Login.tsx            # OAuth login page
    │   │   └── Login.styles.tsx
    │   ├── Orgs/
    │   │   ├── Org.tsx              # Single org dashboard
    │   │   ├── Orgs.tsx             # All orgs list
    │   │   ├── OrgsLoader.tsx       # Wraps children in OrgsProvider context
    │   │   ├── OrgApiKeys.tsx
    │   │   ├── OrgDomains.tsx
    │   │   ├── OrgProviders.tsx
    │   │   ├── OrgSecrets.tsx
    │   │   ├── OrgSettings.tsx
    │   │   ├── OrgUsage.tsx         # Quota usage tracking
    │   │   └── OrgUsers.tsx
    │   ├── Page/Page.tsx            # Base page wrapper component
    │   ├── Profile/Profile.tsx
    │   ├── Projects/
    │   │   ├── Project.tsx          # Single project dashboard
    │   │   ├── Projects.tsx         # Projects list
    │   │   ├── ProjectsLoader.tsx   # Wraps children in ProjectsProvider context
    │   │   ├── ProjectAgent.tsx     # Single agent detail view
    │   │   ├── ProjectAgents.tsx    # Agents list for project
    │   │   ├── ProjectAI.tsx        # AI features page (stub)
    │   │   ├── ProjectDomains.tsx
    │   │   ├── ProjectEndpoints.tsx
    │   │   ├── ProjectFunctions.tsx
    │   │   ├── ProjectSecrets.tsx
    │   │   ├── ProjectSettings.tsx
    │   │   └── ProjectThreads.tsx   # Threads list for project agents
    │   ├── Providers/
    │   │   ├── Provider.tsx         # Stub
    │   │   └── Providers.tsx        # Stub
    │   └── Settings/Settings.tsx
    ├── routes/
    │   └── Routes.tsx               # createBrowserRouter with lazy loading + SuspensePage helper
    ├── services/                    # 22+ singleton service classes
    │   ├── api.ts                   # ApiService base (fetch/get/post/put/delete) + BaseApi (adds cache keys + toast errors)
    │   ├── agentsApi.ts             # AgentsApi (list/get/create/update/delete/run with SSE)
    │   ├── apiKeysApi.ts            # ApiKeysApi
    │   ├── assetsApi.ts             # AssetsApi
    │   ├── auth.ts                  # Auth class wrapping Neon Auth (signin/signout/session)
    │   ├── domainsApi.ts            # DomainsApi
    │   ├── endpointsApi.ts          # EndpointsApi
    │   ├── functionsApi.ts          # FunctionsApi
    │   ├── messagesApi.ts           # MessagesApi
    │   ├── nav.ts                   # NavService (to/route/is/not/has/back/home/signin)
    │   ├── orgsApi.ts               # OrgsApi (list/get/create/update/delete/addMember/removeMember)
    │   ├── projectsApi.ts           # ProjectsApi
    │   ├── providersApi.ts          # ProvidersApi
    │   ├── query.ts                 # QueryService wrapping TanStack QueryClient (fetch/options/reset/key)
    │   ├── quickstartApi.ts         # QuickstartApi (create one-shot setup)
    │   ├── quotasApi.ts             # QuotasApi
    │   ├── secretsApi.ts            # SecretsApi
    │   ├── storage.ts               # Storage class extending @tdsk/components Storage (theme + headers)
    │   ├── subscriptionsApi.ts      # SubscriptionsApi (current/plans/checkout/portal/cancel)
    │   ├── templates.ts             # Templates class for {{mustache}} template handling
    │   ├── threadsApi.ts            # ThreadsApi
    │   └── usersApi.ts              # UsersApi
    ├── state/                       # 21 Jotai atom files + accessors + selectors
    │   ├── accessors.ts             # Global store (createStore) + get*/set*/reset* functions for all atoms
    │   ├── selectors.ts             # Hook-based selectors: useRecState, useDerivedState, and per-entity hooks
    │   ├── agents.ts                # agentsState, activeAgentIdState, activeAgentState (derived)
    │   ├── apiKeys.ts               # apiKeysState, activeApiKeyIdState
    │   ├── app.ts                   # sidebarOpenState
    │   ├── assets.ts                # assetsState, activeAssetIdState
    │   ├── domains.ts               # domainsState, activeDomainIdState
    │   ├── endpoints.ts             # endpointsState, activeEndpointIdState, proxyFormState, faasFormState, agentFormState
    │   ├── functions.ts             # functionsState, activeFunctionIdState
    │   ├── messages.ts              # messagesState, activeMessageIdState
    │   ├── orgs.ts                  # orgsState, orgUsersState, activeOrgIdState, activeOrgRoleState, activeOrgState (derived)
    │   ├── projects.ts              # projectsState, activeProjectIdState, activeProjectState (derived)
    │   ├── providers.ts             # providersState
    │   ├── quickstart.ts            # quickstartState (boolean)
    │   ├── quotas.ts                # orgQuotaState, orgLimitsState
    │   ├── secrets.ts               # secretsState, activeSecretIdState
    │   ├── subscriptions.ts         # subscriptionState, paymentPlansState
    │   ├── theme.ts                 # themeTypeState
    │   ├── threads.ts               # threadsState, activeThreadIdState
    │   └── user.ts                  # userState
    ├── theme/
    │   └── GlobalStyles.tsx         # Global CSS styles component
    ├── types/                       # 15 type definition files
    │   ├── api.types.ts             # TApiRes, TApiReq, TApiData, TApiReqEx, TApiService, TFetchOpts, TApiCacheKeys, EAPIMethod
    │   ├── auth.types.ts            # TAuthData, TAuthSession, TAuthError, TAuthResp
    │   ├── components.types.ts      # Component prop types
    │   ├── endpoints.types.ts       # TProxyFormState, TFaasFormState, TAgentFormState
    │   ├── helper.types.ts          # Utility types
    │   ├── nav.types.ts             # TNavItem, TNavCtx
    │   ├── qs.types.ts              # Quickstart types
    │   ├── query.types.ts           # TQueryKey, TReadOnlyQueryKey
    │   ├── quotas.types.ts          # TQuotaData, TLimitsData
    │   ├── routes.types.ts          # ERoutePath enum (all route paths)
    │   ├── state.types.ts           # State-related types
    │   ├── subscriptions.types.ts   # TCheckoutData, TCheckoutSession, TPortalSession
    │   ├── theme.types.ts           # EThemeType
    │   └── user.types.ts            # User-related types
    └── utils/                       # 7 categories
        ├── api/
        │   ├── apiUrl.ts            # Build API URL from env vars (TDSK_CADDY_PX_HOST takes priority)
        │   ├── authHeader.ts        # Auth header utility
        │   ├── genFormData.ts       # Convert object to FormData
        │   ├── objToQuery.ts        # Convert object to URL query string (alias: toQueryParams)
        │   ├── toQueryParams.ts     # (see objToQuery)
        │   └── validateUrl.ts       # URL validation
        ├── endpoints/
        │   ├── mappers.ts           # Endpoint data mappers
        │   └── validators.ts        # Endpoint form validators
        ├── errors/
        │   └── ApiError.ts          # Custom ApiError class (message + status code)
        ├── nav/
        │   ├── buildRoute.ts        # Build parameterized route string from context (replaces :orgId, :projectId, etc.)
        │   ├── getDynamicNav.ts     # Dynamic navigation builder
        │   └── getParamValue.ts     # Extract route param values
        ├── text/
        │   ├── getInitials.ts       # Get initials from text
        │   └── pluralize.ts         # Simple pluralization
        ├── transforms/
        │   └── kvs.ts              # Key-value transforms
        └── user/
            ├── getInitials.ts       # Get user initials
            └── getRoleColor.ts      # Map role to MUI color
```

## Key Files

### Entry Point Flow

1. **index.html** loads `/src/index.tsx` via Vite
2. **src/index.tsx** bootstraps the React app:
   - Imports Neon Auth CSS (`@neondatabase/neon-js/ui/css`)
   - `overlayScrollBody()` from `@tdsk/components` for custom scrollbar
   - Renders: `StrictMode` > `Jotai Provider (store)` > `AuthProvider` > `App` + `Version`
3. **src/App.tsx** renders the root component tree:
   - `useWindowResize()` hook from `@tdsk/components`
   - `useMakeTheme()` hook for dynamic MUI theme
   - `ThemeProvider` > `GlobalStyles` + MUI `GlobalStyles` (body colors) > `RouterProvider`

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
│   └── /projects/:projectId (Component: ProjectsLoader)
│       ├── (index) → Project dashboard
│       ├── /endpoints → ProjectEndpoints
│       ├── /secrets → ProjectSecrets
│       ├── /domains → ProjectDomains
│       ├── /functions → ProjectFunctions
│       ├── /agents → ProjectAgents
│       ├── /agents/:agentId → ProjectAgent
│       ├── /agents/:agentId/threads → ProjectThreads
│       ├── /agents/:agentId/chat → ChatView (AI chat)
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

**Global Store** (`src/state/accessors.ts`):
```typescript
export const store = createStore()
```

**21 State Atom Files** with the following pattern:
```typescript
// state/<entity>.ts
import { atomWithReset } from 'jotai/utils'
export const entityState = atomWithReset<Record<string, Entity> | undefined>(undefined)
export const activeEntityIdState = atomWithReset<string | undefined>(undefined)
```

**Derived Atoms** (read-only, computed from other atoms):
- `activeOrgState` - Derives active Organization from `orgsState` + `activeOrgIdState`
- `activeProjectState` - Derives active Project from `projectsState` + `activeProjectIdState`
- `activeAgentState` - Derives active Agent from `agentsState` + `activeAgentIdState`

**Accessors** (`src/state/accessors.ts`) - Imperative get/set/reset for each atom:
```typescript
export const getOrgs = () => store.get(orgsState)
export const setOrgs = (orgs: Record<string, Organization>) => store.set(orgsState, orgs)
export const resetOrgs = () => store.set(orgsState, undefined)
// ... same pattern for all 21 entities
```

Special accessors for `apiKeys` include `setApiKey` (single upsert) and `removeApiKey` (single delete).

**Selectors** (`src/state/selectors.ts`) - Hook-based access:
```typescript
// useRecState - Returns [value, setter, resetter] for atomWithReset atoms
const useRecState = <T>(state) => {
  const [current, setCurrent] = useAtom(state)
  const resetCurrent = useResetAtom(state)
  return [current, setCurrent, resetCurrent]
}

// useDerivedState - Returns [value, setter, noOp] for read-only derived atoms
const useDerivedState = <T>(state) => {
  const [current, setCurrent] = useAtom(state)
  return [current, setCurrent, noOp]
}

// Per-entity selectors
export const useOrgs = () => useRecState(orgsState)
export const useActiveOrg = () => useDerivedState<Organization>(activeOrgState)
export const useActiveProject = () => useDerivedState<Project>(activeProjectState)
export const useActiveAgent = () => useDerivedState<Agent>(activeAgentState)
// ... etc for all entities
```

### API Service Architecture

**Three-layer design**:

1. **ApiService** (`src/services/api.ts`) - Base fetch wrapper:
   - Manages base URL, path prefix (`_`), default headers (`Accept`, `Content-Type: application/json`)
   - `bearer()` - Fetches session token from Neon Auth, sets `Authorization: Bearer <token>`
   - `fetch()` - Core method: builds URL, handles FormData, returns `TApiRes<T>` (data or error)
   - `get()` - Wraps fetch with TanStack QueryClient caching (`query.fetch(query.options({...}))`)
   - `post()`, `put()`, `delete()` - Simple method wrappers
   - URL building: `apiUrl()` resolves from `TDSK_CADDY_PX_HOST` > `TDSK_PX_URL` > `TDSK_PX_HOST:TDSK_PX_PORT`

2. **BaseApi** (`src/services/api.ts`) - Base class for domain APIs:
   - Holds `api: apiService` singleton reference
   - `_onError()` - Shows toast notification via Sonner + console.warn

3. **Domain APIs** (e.g., `OrgsApi`, `AgentsApi`, `SecretsApi`) - Entity-specific services:
   - Extend `BaseApi`
   - Define `path` and `cache` keys for TanStack Query
   - Each method: call API, handle errors via `_onError`, return typed response with domain model instantiation

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
- GET requests are cached with configurable `staleTime` and `queryKey`
- Defaults: staleTime 5 min, gcTime 30 min, no retry, refetchOnWindowFocus

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
- On mount: calls `initAuth()` which invokes `auth.session()`, sets session state
- Shows `Loading` during auth check, `LoginError` on failure
- Provides `AuthContext` with `{ session, loading }`

**Protected Routes** (`src/pages/Layout/Layout.tsx`):
```typescript
const Layout = () => (
  <>
    <SignedIn>
      <LayoutContainer>
        <LayoutContent>
          <Sidebar />
          <Outlet />
        </LayoutContent>
      </LayoutContainer>
    </SignedIn>
    <RedirectToSignIn />
  </>
)
```

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
- `OrgNavItems` - 8 items: Projects, Users, Secrets, Providers, Domains, Api Keys, Usage, Settings
- `ProjectNavItems` - 7 items: Endpoints, Functions, Secrets, Agents, Threads, Domains, Settings
- `BottomNavItems` - 1 item: Settings
- `HeaderSettingsItems` - 3 items: Profile, Billing, Sign Out
- `QSSteps` - 3 quickstart steps: "AI Provider", "Project & Agent", "Review & Create"

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

**API URL Resolution** (`src/utils/api/apiUrl.ts`):
1. If `TDSK_CADDY_PX_HOST` is set, use it (prepend `https://` if needed)
2. Else if `TDSK_PX_URL` is set, parse and use it
3. Else build from `TDSK_PX_HOST` + `TDSK_PX_PORT`

All API calls go through the Caddy reverse proxy which terminates TLS, then routes to the Auth proxy which validates JWT, then forwards to the Backend.

### Path Aliases

**Configured in**: `tsconfig.json` + `configs/vite.workspace.ts`

```typescript
@TAF/*           → repos/admin/src/*           # Admin internal imports
@TAF             → repos/admin/src             # Admin root
@TSC/*           → repos/components/src/*      # Shared components
@tdsk/components → repos/components/src        # Components barrel
@TDM/*           → repos/domain/src/*          # Domain models
@tdsk/domain     → repos/domain/src/web.ts     # Domain web bundle
```

**Vite resolves cross-workspace paths** via `viteTsconfigPaths` with projects: `admin`, `domain`, `database`, `components`.

## Key Patterns

### 1. Action Split: API vs Local

Every domain has up to two action subdirectories:
- **`api/`** - Async functions: call service, handle response, update state, return result
- **`local/`** - Synchronous functions: directly mutate Jotai state (upsert, remove, set, reset)

Components call API actions which internally delegate to local actions after successful API responses.

### 2. State: atomWithReset + Accessors + Selectors

Three-layer state design:
1. **Atoms** (state files) - `atomWithReset` for resettable state, derived atoms for computed values
2. **Accessors** (accessors.ts) - Imperative `get*/set*/reset*` functions for use outside React (actions, services)
3. **Selectors** (selectors.ts) - `useRecState`/`useDerivedState` hooks for use inside React components

### 3. Service Class Hierarchy

```
ApiService (base fetch with Bearer auth + TanStack Query caching)
    └── BaseApi (adds _onError toast notifications)
        ├── OrgsApi
        ├── ProjectsApi
        ├── AgentsApi (includes SSE .run() method)
        ├── SecretsApi
        ├── ProvidersApi
        ├── EndpointsApi
        ├── FunctionsApi
        ├── ApiKeysApi
        ├── DomainsApi
        ├── ThreadsApi
        ├── MessagesApi
        ├── AssetsApi
        ├── UsersApi
        ├── QuotasApi
        ├── SubscriptionsApi
        └── QuickstartApi
```

All exported as singletons (e.g., `export const orgsApi = new OrgsApi()`).

### 4. Context Providers for Data Loading

```typescript
// OrgsLoader → OrgsProvider → useOrgsState() → fetchOrgs() on mount
// ProjectsLoader → ProjectsProvider → useProjectsState() → fetchProjects() on mount

// Pattern: show Loading while fetching, AppError on failure, MemoChildren on success
```

### 5. Lazy Loading & Code Splitting

All pages use `React.lazy()` wrapped by the `SuspensePage` helper:
```typescript
const SuspensePage = ({ Component }) => (
  <Suspense fallback={<Loading fixed full />}>
    <Component />
  </Suspense>
)
```

### 6. Template Mustache Syntax

The `Templates` service handles `{{variable}}` template syntax for secret/endpoint value interpolation:
- `has(value)` - Test if string contains `{{...}}`
- `extract(value)` - Extract variable name from `{{name}}`
- `wrap(value)` - Wrap a string in `{{...}}`

### 7. Component Co-location

Each component has its own directory:
```
components/Sidebar/
├── Sidebar.tsx           # Main component
├── SBLogo.tsx            # Sub-component
├── SBNavList.tsx          # Sub-component
├── SBProjectSelector.tsx  # Sub-component
├── SBSection.tsx          # Sub-component
└── index.ts              # Barrel export
```

### 8. Event Handler Callbacks

Event handler callbacks always use the `on` prefix followed by a descriptive name:
```typescript
const onBlur = (evt: Event) => { ... }
const onDeleteClick = (evt: Event) => { ... }
const onSuccess = (evt: Event) => { ... }
```

### 9. Protected Routes with Neon Auth

Layout acts as an auth guard using Neon Auth's `SignedIn` and `RedirectToSignIn` components. All routes under Layout require authentication.

## Dependencies

### Core Framework
- **react** (^18.3.1) - UI library
- **react-dom** (^18.3.1) - React DOM renderer
- **react-router** (7.1.1) - Client-side routing (v7 with createBrowserRouter)
- **vite** (^5.0.12) - Build tool + dev server

### UI Components
- **@mui/material** (6.1.2) - Material-UI components
- **@mui/icons-material** (6.1.2) - Material icons
- **@mui/lab** (6.0.0-beta.10) - Experimental MUI components
- **@emotion/react** (11.13.3) - CSS-in-JS styling
- **@emotion/styled** (11.13.0) - Styled components for Emotion

### State & Data
- **jotai** (2.16.1) - Primitive and flexible state management
- **@tanstack/react-query** (5.90.16) - Server state caching and synchronization

### Authentication
- **@neondatabase/neon-js** (0.1.0-beta.21) - Neon Auth SDK (createAuthClient, NeonAuthUIProvider, SignedIn, RedirectToSignIn)

### Utilities
- **@keg-hub/jsutils** (^10.0.0) - JavaScript utilities (limbo, isObj, isStr, exists, emptyObj, deepMerge, cleanColl, noOp, ife)
- **@keg-hub/parse-config** (2.1.0) - Environment config parser (loads deploy/values.*.yml)
- **alias-hq** (6.2.4) - Path alias management
- **sonner** (2.0.7) - Toast notifications
- **posthog-js** (1.242.2) - Product analytics

### Build Plugins
- **@vitejs/plugin-react-swc** (^3.3.2) - Vite + SWC for React fast compilation
- **vite-tsconfig-paths** (4.3.2) - TypeScript path resolution in Vite (cross-workspace)
- **vite-plugin-svgr-component** (1.0.1) - Import SVGs as React components
- **tsconfig-paths** (4.2.0) - Runtime path alias resolution
- **esbuild-register** (3.5.0) - Runtime TS transpilation for scripts

### Dev Tools
- **typescript** (^5.3.3) - Type checking
- **vitest** (1.6.1) - Unit testing framework
- **@testing-library/react** (^14.2.1) - React testing utilities
- **@testing-library/jest-dom** (^6.4.2) - Jest DOM matchers
- **@testing-library/user-event** (14.6.1) - User interaction simulation
- **jsdom** (^24.0.0) - DOM implementation for testing
- **@biomejs/biome** (2.1.2) - Linter and formatter

### Monorepo Workspaces
- **@tdsk/components** (workspace:*) - Shared React components (Loading, MemoChildren, useWindowResize, useEffectOnce, overlayScrollBody, Storage, dims)
- **@tdsk/database** (workspace:*) - Database types
- **@tdsk/domain** (workspace:*) - Domain models (Organization, Project, User, Agent, Secret, Provider, Endpoint, Function, ApiKey, Domain, Thread, Message, Asset, Plan, Subscription)

## Commands

### Development
```bash
pnpm start           # Vite dev server (default port 5887)
pnpm sf              # Start with NODE_ENV=local force refresh
pnpm host            # Start with --host --open (network access)
pnpm preview         # Preview production build
```

### Building
```bash
pnpm build           # Production build to /dist (vite build)
pnpm types           # Type check (tsc --noEmit --pretty)
```

### Testing
```bash
pnpm test            # Run Vitest tests (vitest run)
```

### Maintenance
```bash
pnpm clean           # Remove node_modules
```

### Command Notes
- Linting and formatting run automatically via Biome. Do NOT run `pnpm lint` or `pnpm format` manually.
- The dev server port (5887) is configured via `TDSK_AD_PORT` env var in deploy/values.yaml.

## Tests

6 co-located test files:
- `src/actions/orgs/api/createOrg.test.ts`
- `src/actions/orgs/api/fetchOrgs.test.ts`
- `src/actions/projects/api/createProject.test.ts`
- `src/actions/projects/api/fetchProjects.test.ts`
- `src/constants/nav.test.tsx`
- `src/utils/api/genFormData.test.ts`

Test setup: `scripts/setupTests.ts` with `scripts/testUtils.tsx` helpers. Test environment: jsdom.

## Environment Variables

**Loaded via**: `@keg-hub/parse-config` from `deploy/values.*.yml` → Vite `define` option

**Available in Admin** (`src/constants/envs.ts`):
- `TDSK_AUTH_URL` - Neon Auth API URL (required)
- `TDSK_AUTH_PROVIDERS` - Comma-separated OAuth providers (default: `github`)
- `TDSK_AD_APP_VERSION` - App version from package.json (required)
- `TDSK_AD_BASE_PATH` - Base path for deployment (default `/`)
- `TDSK_PX_URL` - Proxy URL
- `TDSK_PX_HOST` - Proxy host
- `TDSK_PX_PORT` - Proxy port
- `TDSK_CADDY_PX_HOST` - Caddy proxy host (takes priority in apiUrl resolution)
- `TDSK_BE_API_ADMIN_PATH` - Backend admin API path
- `TDSK_POSTHOG_KEY` - PostHog analytics key
- `TDSK_POSTHOG_HOST` - PostHog host URL

## Development Guidelines

### 1. Adding a New Page

```typescript
// 1. Add route enum value
// src/types/routes.types.ts
export enum ERoutePath {
  NewPage = `new-page`,                              // Relative (for nesting)
  OrgNewPage = `/orgs/:orgId/new-page`,              // Absolute (for links)
}

// 2. Create page component
// src/pages/NewPage/NewPage.tsx
const NewPage = () => {
  return <div>New Page Content</div>
}
export default NewPage  // Must be default export for lazy()

// 3. Add route definition
// src/routes/Routes.tsx
const NewPage = lazy(() => import('@TAF/pages/NewPage/NewPage'))
// Add to children array:
{ path: ERoutePath.NewPage, Component: () => <SuspensePage Component={NewPage} /> }

// 4. Add nav item (if needed)
// src/constants/nav.tsx
{ text: `New Page`, to: buildRoute(ERoutePath.OrgNewPage), Icon: <SomeIcon /> }
```

### 2. Adding a New Entity (Full Stack)

```typescript
// 1. Create state atom
// src/state/newEntity.ts
import { atomWithReset } from 'jotai/utils'
import type { NewEntity } from '@tdsk/domain'
export const newEntitiesState = atomWithReset<Record<string, NewEntity> | undefined>(undefined)
export const activeNewEntityIdState = atomWithReset<string | undefined>(undefined)

// 2. Add accessors
// src/state/accessors.ts
export const getNewEntities = () => store.get(newEntitiesState)
export const setNewEntities = (v: Record<string, NewEntity>) => store.set(newEntitiesState, v)
export const resetNewEntities = () => store.set(newEntitiesState, undefined)

// 3. Add selectors
// src/state/selectors.ts
export const useNewEntities = () => useRecState(newEntitiesState)
export const useActiveNewEntityId = () => useRecState(activeNewEntityIdState)

// 4. Create service
// src/services/newEntitiesApi.ts
export class NewEntitiesApi extends BaseApi {
  private readonly path = `/new-entities`
  cache: TApiCacheKeys = { ... }
  async list() { ... }
  async get(id: string) { ... }
  async create(data: Partial<NewEntity>) { ... }
  async update(id: string, data: Partial<NewEntity>) { ... }
  async delete(id: string) { ... }
}
export const newEntitiesApi = new NewEntitiesApi()

// 5. Create actions (api/ and local/)
// src/actions/newEntities/api/fetchNewEntities.ts
// src/actions/newEntities/local/upsertNewEntity.ts
```

### 3. Adding Global State

```typescript
// 1. Create atom (src/state/myState.ts)
import { atomWithReset } from 'jotai/utils'
export const myState = atomWithReset<MyType>(undefined)

// 2. Add accessors (src/state/accessors.ts)
export const getMyState = () => store.get(myState)
export const setMyState = (value: MyType) => store.set(myState, value)
export const resetMyState = () => store.set(myState, undefined)

// 3. Add selector (src/state/selectors.ts)
export const useMyState = () => useRecState(myState)

// 4. Use in component
const [myState, setMyState, resetMyState] = useMyState()
```

### 4. Creating Styled Components

```typescript
// src/components/MyComponent/MyComponent.styles.tsx
import { styled } from '@mui/material/styles'
import { Box } from '@mui/material'

export const MyContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}))
```

## Common Issues & Solutions

### 1. Path Alias Not Resolving
- Check `tsconfig.json` paths configuration
- Verify `configs/vite.workspace.ts` includes workspace project via `viteTsconfigPaths`
- Restart Vite dev server after config changes
- Run `pnpm types` to check for TS errors

### 2. State Not Updating in Component
- Use `useRecState()` or `useDerivedState()` hooks (not `store.get()` in components)
- Ensure component tree is under `<Provider store={store}>`
- Always create new objects/arrays (never mutate)

### 3. API Calls Returning 401
- Verify Neon Auth session is valid (`auth.session()`)
- Check `apiUrl()` resolution (TDSK_CADDY_PX_HOST should point to Caddy proxy)
- Verify proxy is validating JWT correctly
- Check that `bearer()` has been called on `apiService`

### 4. TanStack Query Cache Issues
- Check `queryKey` uniqueness for different requests
- Use different `staleTime` values where needed
- Call `query.reset()` to clear all cached data

### 5. Environment Variables Not Loading
- Check `deploy/values.local.yml` has correct values
- Verify `configs/frontend.config.ts` `loadConfig()` is called
- Ensure env vars are defined in Vite `define` config
- Restart dev server after changing env files

### 6. HMR Not Working for Domain/Components
- Check `vite.workspace.ts` includes workspace projects
- Verify `tsconfig.json` paths are correct
- Use `pnpm sf` (force refresh) instead of `pnpm start`

## Best Practices

1. **Always use path aliases** - Prefer `@TAF/*` over relative imports
2. **Co-locate styles** - Keep styled components in `.styles.tsx` next to component
3. **Lazy load pages** - All route components must use `React.lazy()` + `SuspensePage`
4. **Use selectors for components** - `useRecState`/`useDerivedState` hooks, not `store.get()`
5. **Use accessors for actions** - `get*/set*/reset*` functions from accessors.ts
6. **Type everything** - Avoid `any`, use proper TypeScript types from `@TAF/types` or `@tdsk/domain`
7. **Singleton services** - Each API service is a singleton instance
8. **Cache keys for GET requests** - Always provide `queryKey` for TanStack Query caching
9. **Toast on error** - Use `_onError()` from BaseApi for user-facing error messages
10. **Event handler naming** - Always prefix with `on` (e.g., `onDeleteClick`, `onSuccess`)
11. **Default exports for pages** - Required for `React.lazy()` dynamic imports
12. **Theme-aware styling** - Use `theme` parameter in styled components

---

**Last Updated**: 2026-02-15
**Version**: 2.0.0
**Maintainer**: ThreadedStack Team

## Changelog

### v2.0.0 (2026-02-15)
- **Complete rewrite** based on actual codebase audit
- **Fixed**: Directory structure now reflects all 38+ component dirs, 18 action domains, 22+ services, 21 state atoms
- **Fixed**: Route definitions corrected (relative vs absolute paths, actual ERoutePath enum values)
- **Fixed**: Removed stale "Teams" and "Repos" references (now Organizations and Projects everywhere)
- **Fixed**: State management section updated with actual accessor/selector pattern (useRecState/useDerivedState)
- **Fixed**: API service architecture documented (ApiService → BaseApi → domain APIs with TanStack Query)
- **Fixed**: Dependencies list corrected (added @tanstack/react-query, posthog-js, sonner v2.0.7, vitest v1.6.1)
- **Added**: Agent chat SSE streaming documentation (useAgentChat hook)
- **Added**: Quickstart wizard flow (ProviderStep → AgentStep → ReviewStep)
- **Added**: All 18 action domains with api/local split documented
- **Added**: Context providers (OrgsProvider, ProjectsProvider) data loading pattern
- **Added**: Navigation system (NavService, buildRoute, OrgNavItems, ProjectNavItems)
- **Added**: Templates service for {{mustache}} syntax
- **Added**: Complete environment variables list
- **Added**: Test files inventory (6 test files)
- **Removed**: Outdated code examples referencing Teams/Repos/Page component patterns

### v1.2.0 (2026-01-18)
- Added Billing & Subscriptions (Polar.sh)
- Added Quota Management (12 resource types)
- Added subscriptionsApi, quotasApi services
- Added /billing and /orgs/:orgId/usage pages
- Added Billing components and state atoms

### v1.1.0 (2026-01-15)
- Teams renamed to Organizations (orgs)
- Repos renamed to Projects
- Added API Keys, Secrets, Endpoints, Functions management
- Added nested routing (Projects under Organizations)
