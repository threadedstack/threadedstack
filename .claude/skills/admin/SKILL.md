---
name: "Threaded Stack - Admin Repo"
description: "Knowledge base for the admin SPA dashboard repo"
version: "1.2.0"
tags: ["react", "vite", "mui", "jotai", "frontend", "admin-dashboard", "billing", "quotas"]
---
# Admin Repo Skill

## Overview

The **Admin** repo (`repos/admin`) is the Single Page Application (SPA) dashboard for Threaded Stack. It provides the primary user interface for managing **organizations**, **projects**, API keys, providers, secrets, endpoints, and other platform resources. Built with modern React tooling, it uses Vite for blazing-fast HMR, MUI for UI components, and Jotai for lightweight state management.

**Key Characteristics:**
- **Type**: Frontend SPA Dashboard
- **Tech Stack**: Vite 5, React 18, Material-UI 6, Jotai 2.16, React Router 7
- **Authentication**: Neon Auth (via `@neondatabase/neon-js`) with social OAuth providers
- **Path Aliases**: Uses `@TAF/*` prefix via `alias-hq` for internal imports
- **Build Tool**: Vite with SWC for fast React compilation
- **Styling**: Emotion (CSS-in-JS) + Material-UI theming system
- **Total Files**: ~105 TypeScript/TSX files

## Directory Structure

```
repos/admin/
├── index.html                    # Entry HTML (loads /src/index.tsx)
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config with path mappings
├── configs/                      # Build & tooling configs
│   ├── vite.config.ts            # Vite entry point
│   ├── vite.workspace.ts         # Main Vite configuration
│   ├── frontend.config.ts        # Env loading & alias setup
│   ├── biome.json                # Biome linter config
│   └── nginx.conf                # Nginx deployment config
├── scripts/                      # Build/dev helper scripts
│   ├── registerPaths.ts          # Path alias registration
│   ├── loadEnvs.ts               # Environment variable loader
│   └── setupTests.ts             # Vitest test setup
└── src/                          # Application source code
    ├── index.tsx                 # React app bootstrap (entry point)
    ├── App.tsx                   # Root component (theme + routing)
    ├── types/                    # TypeScript type definitions
    │   ├── routes.types.ts       # Route path enum (ERoutePath)
    │   └── index.ts              # Type exports
    ├── routes/                   # React Router configuration
    │   ├── Routes.tsx            # Route definitions with lazy loading
    │   └── index.ts              # Route exports
    ├── pages/                    # Page-level components
    │   ├── Layout/               # Main layout with sidebar
    │   │   ├── Layout.tsx        # Layout wrapper (SignedIn guard)
    │   │   └── Layout.styles.tsx # Styled components
    │   ├── Home/                 # Home page (dashboard)
    │   ├── Login/                # Login page (OAuth flows)
    │   ├── Account/              # User account settings
    │   ├── Orgs/                 # Organization management (renamed from Teams)
    │   │   ├── Orgs.tsx          # Organizations list
    │   │   ├── Org.tsx           # Single org dashboard
    │   │   ├── OrgUsers.tsx      # Org user management
    │   │   ├── OrgSecrets.tsx    # Org-level secrets
    │   │   ├── OrgProviders.tsx  # Org-level providers
    │   │   ├── OrgApiKeys.tsx    # API key management
    │   │   └── OrgProjects.tsx   # Projects within org
    │   ├── Projects/             # Project management (renamed from Repos)
    │   │   ├── Projects.tsx      # Projects list
    │   │   ├── Project.tsx       # Single project dashboard
    │   │   ├── ProjectEndpoints.tsx   # Project endpoints
    │   │   ├── ProjectSecrets.tsx     # Project-level secrets
    │   │   ├── ProjectProviders.tsx   # Project-level providers
    │   │   └── ProjectFunctions.tsx   # Project functions
    │   └── Page/                 # Base page component
    ├── components/               # Reusable UI components
    │   ├── Sidebar/              # Collapsible navigation sidebar
    │   ├── Header/               # Page header component
    │   ├── Login/                # Login form components
    │   ├── Link/                 # Router-aware link component
    │   └── Version/              # App version display
    ├── state/                    # Jotai state management
    │   ├── accessors.ts          # Global store + getters/setters
    │   ├── selectors.ts          # Derived state selectors (hooks)
    │   ├── user.ts               # User state atom
    │   ├── theme.ts              # Theme type state (light/dark)
    │   ├── app.ts                # App-level state (sidebar open)
    │   ├── orgs.ts               # Organizations state + active org ID
    │   ├── projects.ts           # Projects state + active project ID
    │   ├── providers.ts          # Providers state
    │   ├── apiKeys.ts            # API keys state
    │   ├── secrets.ts            # Secrets state
    │   ├── endpoints.ts          # Endpoints state
    │   └── functions.ts          # Functions state
    ├── services/                 # Singleton service classes
    │   ├── auth.ts               # Auth service (Neon Auth wrapper)
    │   ├── nav.ts                # Navigation service (routing utils)
    │   └── storage.ts            # LocalStorage wrapper
    ├── actions/                  # Async action handlers
    │   └── auth/
    │       └── local/
    │           ├── init.ts       # Initialize auth session
    │           └── signin.ts     # Social OAuth sign-in
    ├── contexts/                 # React contexts
    │   ├── AuthContext.ts        # Auth context definition
    │   └── AuthProvider.tsx      # Auth provider (session management)
    ├── hooks/                    # Custom React hooks
    │   ├── theme/                # Theme-related hooks
    │   │   └── useMakeTheme.ts   # Theme builder hook
    │   └── components/           # Component-specific hooks
    ├── theme/                    # MUI theme configuration
    │   ├── GlobalStyles.tsx      # Global CSS styles
    │   └── index.ts              # Theme exports
    ├── constants/                # App constants
    │   ├── nav.ts                # Navigation items config
    │   ├── envs.ts               # Environment variable exports
    │   ├── values.ts             # Static values
    │   └── storage.ts            # Storage key constants
    └── utils/                    # Utility functions
        ├── api/                  # API utilities
        │   ├── genFormData.ts    # FormData generator
        │   └── toQueryParams.ts  # Query string builder
        └── errors/               # Error handling utilities
```

## Key Files

### Entry Point Flow

1. **index.html** → Loads `/src/index.tsx` via Vite
2. **src/index.tsx** → Bootstraps React app with:
   - `StrictMode` wrapper
   - Jotai `Provider` with global store
   - `AuthProvider` for Neon Auth integration
   - `App` component (root)
   - `Version` component (app version display)
   - `overlayScrollBody()` for custom scrollbar
3. **src/App.tsx** → Root component with:
   - `ThemeProvider` (MUI theme system)
   - `GlobalStyles` component
   - `RouterProvider` with `Routes` definition
   - `useWindowResize()` hook for responsive behavior
   - `useMakeTheme()` hook for dynamic theme creation

### Routing Configuration

**File**: `src/routes/Routes.tsx`

Uses React Router 7's `createBrowserRouter` with:
- **Lazy Loading**: All pages wrapped in `React.lazy()` + `Suspense`
- **Nested Routes**: Layout component as parent with `Outlet` for children
- **Loading States**: `<Loading fixed full />` fallback during code splitting
- **Catch-All**: `*` route redirects to home

**Route Definitions** (from `src/types/routes.types.ts`):
```typescript
enum ERoutePath {
  Home = `/`,
  Orgs = `/orgs`,
  Org = `/orgs/:orgId`,
  OrgUsers = `/orgs/:orgId/users`,
  OrgSecrets = `/orgs/:orgId/secrets`,
  OrgProviders = `/orgs/:orgId/providers`,
  OrgSettings = `/orgs/:orgId/settings`,
  OrgApiKeys = `/orgs/:orgId/api-keys`,
  OrgUsage = `/orgs/:orgId/usage`,       // NEW v1.2
  OrgProjects = `/orgs/:orgId/projects`,
  // Project routes (nested under orgs)
  Project = `/orgs/:orgId/projects/:projectId`,
  ProjectEndpoints = `/orgs/:orgId/projects/:projectId/endpoints`,
  ProjectSecrets = `/orgs/:orgId/projects/:projectId/secrets`,
  ProjectProviders = `/orgs/:orgId/projects/:projectId/providers`,
  ProjectFunctions = `/orgs/:orgId/projects/:projectId/functions`,
  ProjectSettings = `/orgs/:orgId/projects/:projectId/settings`,
  // Billing & subscription routes
  Billing = `/billing`,
  // Other routes
  Settings = `/settings`,
  Profile = `/profile`,
  Auth = `/auth`,
  Login = `/auth/:pathname`,
  Account = `/account/:pathname`,
  ApiTokens = `/api-tokens`,
  AI = `/ai`,
  AIAgents = `/ai/agents`,
  MCPTools = `/ai/mcp-tools`,
  Star = `*`
}
```

**Note**: Projects are now **nested under organizations** in the URL structure.

### State Management (Jotai)

**File**: `src/state/accessors.ts`

Uses Jotai's `atomWithReset` for resettable state atoms:

**Global Store**:
```typescript
export const store = createStore()
```

**State Atoms**:
- `themeTypeState` - Theme mode (light/dark)
- `sidebarOpenState` - Sidebar expanded/collapsed
- `userState` - Current authenticated user
- `orgsState` - All organizations (Record<id, Organization>)
- `activeOrgIdState` - Selected organization ID
- `orgUsersState` - Users in current org (Record<string, User[]>)
- `projectsState` - All projects (Record<id, Project>)
- `activeProjectIdState` - Selected project ID
- `providersState` - API providers (Record<id, Provider>)
- `secretsState` - Secrets (Record<id, Secret>)
- `activeSecretIdState` - Selected secret ID
- `apiKeysState` - API keys (Record<id, ApiKey>)
- `activeApiKeyIdState` - Selected API key ID
- `endpointsState` - Endpoints (Record<id, Endpoint>)
- `activeEndpointIdState` - Selected endpoint ID
- `functionsState` - Functions (Record<id, Function>)
- `activeFunctionIdState` - Selected function ID
- `currentSubscriptionAtom` - Current user subscription
- `paymentPlansAtom` - Available payment plans
- `subscriptionLoadingAtom` - Subscription loading state
- `plansLoadingAtom` - Plans loading state
- `orgQuotaAtom` - Organization quota usage
- `orgLimitsAtom` - Organization quota limits
- `quotaLoadingAtom` - Quota loading state

**Accessors**:
```typescript
// Getters
getThemeType() → EThemeType
getSidebarOpen() → boolean
getUser() → User
getTeams() → Record<string, Team>
getActiveTeamId() → string
// ... etc

// Setters
setThemeType(type: EThemeType)
setSidebarOpen(status: boolean)
setUser(user: User)
setTeams(teams: Record<string, Team>)
// ... etc

// Resetters
resetThemeType()
resetUser()
resetTeams()
// ... etc
```

**Selectors** (hooks from `src/state/selectors.ts`):
- `useSidebarOpen()` - Returns `[open, setOpen]`
- `useUser()` - Returns current user
- `useActiveTeam()` - Returns active team object
- etc.

### Authentication System

**Neon Auth Integration**:

**File**: `src/services/auth.ts`

```typescript
import { createAuthClient } from '@neondatabase/neon-js/auth'

export const authClient = createAuthClient(TDSK_AUTH_URL)

export class Auth {
  signin(provider: string) // Social OAuth (GitHub, GitLab, Google, Vercel)
  signout()
  session() // Get current session
}
```

**Auth Provider** (`src/contexts/AuthProvider.tsx`):
- Wraps app with `NeonAuthUIProvider`
- Initializes session on mount via `initAuth()`
- Shows loading spinner during auth check
- Displays error state if auth fails
- Provides `AuthContext` for child components

**Protected Routes** (`src/pages/Layout/Layout.tsx`):
- Uses `<SignedIn>` component from Neon Auth
- Redirects to login via `<RedirectToSignIn>` if not authenticated
- Wraps all authenticated pages

**Login Flow**:
1. User visits `/auth/:provider` (e.g., `/auth/github`)
2. `Login.tsx` renders OAuth provider buttons
3. Click triggers `signin(provider)` action
4. Neon Auth redirects to OAuth provider
5. Callback returns with session token
6. Session stored in Neon Auth client
7. User redirected to home page

### Component Architecture

**Layout Structure**:
```
<App>
  └─ <ThemeProvider>
      └─ <RouterProvider>
          └─ <Layout> (route: "/")
              ├─ <Sidebar /> (collapsible navigation)
              └─ <Outlet /> (child route content)
                  ├─ <Home /> (route: "/" index)
                  ├─ <Teams /> (route: "/teams")
                  ├─ <Repos /> (route: "/repos")
                  └─ ... other pages
```

**Key Components**:

1. **Sidebar** (`src/components/Sidebar/Sidebar.tsx`)
   - Collapsible navigation drawer (MUI `Drawer` variant="permanent")
   - State managed by `useSidebarOpen()` Jotai selector
   - Two navigation lists: main nav + bottom nav (settings/account)
   - Logo component that scales based on open/closed state
   - Toggle button (chevron left/right icon)

2. **Login** (`src/components/Login/Login.tsx`)
   - OAuth provider buttons (GitHub, GitLab, Google, Vercel)
   - Configured via `TDSK_AUTH_PROVIDERS` env variable
   - Loading state during authentication
   - Error display for failed auth

3. **Page** (`src/pages/Page/Page.tsx`)
   - Base page wrapper component
   - Provides consistent layout/padding
   - Used by all page-level components

### Theme System

**File**: `src/hooks/theme/useMakeTheme.ts`

Dynamic MUI theme generation based on Jotai state:
- Watches `themeTypeState` (light/dark)
- Returns MUI `Theme` object with custom palette
- Supports Ubuntu font family (loaded in index.html)
- Uses Emotion for CSS-in-JS styling

**Theme Persistence**:
- Theme type stored in LocalStorage via `storage.ts` service
- Restored on app init from `src/state/theme.ts`

### API Communication Pattern

**File**: `src/utils/api/`

Utilities for API calls (not yet fully implemented):
- `genFormData()` - Convert object to FormData
- `toQueryParams()` - Convert object to URL query string

**Expected Flow** (based on architecture):
```
Component → Action (async) → API Service → Backend (/api/*)
                ↓
          State Update (Jotai)
                ↓
          UI Re-render
```

**Backend Integration**:
- Admin calls backend via auth-proxy (`repos/proxy`)
- Proxy routes to backend (`repos/backend`) at `/admin/*` endpoints
- JWT tokens injected by proxy (secrets server-side)
- Admin receives JSON responses

## Architecture

### Application Bootstrap Sequence

```
1. index.html loads → /src/index.tsx
2. Render:
   <StrictMode>
     <Provider store={store}>           # Jotai global store
       <AuthProvider>                   # Neon Auth + session init
         <App>
           <ThemeProvider>              # MUI theme system
             <RouterProvider>           # React Router 7
               <Layout>                 # Auth guard + sidebar
                 <Outlet />             # Page content
               </Layout>
             </RouterProvider>
           </ThemeProvider>
         </App>
         <Version />                    # App version footer
       </AuthProvider>
     </Provider>
   </StrictMode>
```

### Request/Data Flow

**Authentication Flow**:
```
User → Login Page → OAuth Provider → Callback → Neon Auth Session → AuthContext → App State
```

**Protected Route Access**:
```
User Request → Router → Layout → SignedIn Guard → Redirect to Login (if not authed)
                                               → Render Page (if authed)
```

**State Management Flow**:
```
User Action → Component → Jotai Setter (setTeams, setUser, etc.)
                                ↓
                         Store Update
                                ↓
                    Selectors Re-compute (useSidebarOpen, useUser, etc.)
                                ↓
                       Components Re-render
```

**Navigation Flow**:
```
User Click → nav.to(path) → history.pushState → popstate event → Router → Page Render
```

### Path Aliases

**Configured in**: `tsconfig.json` + `configs/vite.workspace.ts`

```typescript
@TAF/*        → repos/admin/src/*           # Admin internal imports
@TAF          → repos/admin/src             # Admin root
@TSC/*        → repos/components/src/*      # Shared components
@tdsk/components → repos/components/src     # Components barrel
@TDM/*        → repos/domain/src/*          # Domain models
@tdsk/domain  → repos/domain/src/web.ts     # Domain web bundle
```

**Example Usage**:
```typescript
import { User } from '@tdsk/domain'
import { Loading } from '@tdsk/components'
import { auth } from '@TAF/services/auth'
import { Routes } from '@TAF/routes/Routes'
```

## Logic Flow

### 1. Authentication Lifecycle

**Init Auth** (`src/actions/auth/local/init.ts`):
```typescript
1. AuthProvider mounts → useEffectOnce
2. Call initAuth()
3. auth.session() → Neon Auth API
4. If session exists:
   - Create User instance from response
   - Update userState via setUser()
   - Return { session, user }
5. If no session:
   - Return empty response
6. If error:
   - Return { error } → display LoginError
```

**Sign In** (`src/actions/auth/local/signin.ts`):
```typescript
1. User clicks OAuth provider button
2. Login.tsx → onLogin(provider)
3. Call signin(provider)
4. auth.client.signIn.social({ provider })
5. Neon Auth redirects to OAuth provider
6. User authorizes
7. Callback returns with session token
8. Session stored in Neon Auth
9. User redirected to home
```

### 2. Navigation Flow

**Navigation Service** (`src/services/nav.ts`):
```typescript
class NavService {
  to(path) {
    history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  is(path) // Check if current path matches
  not(path) // Check if current path doesn't match
  has(path) // Check if current path starts with
  home() // Navigate to home
  login() // Navigate to login
}
```

**Usage**:
```typescript
import { nav } from '@TAF/services/nav'

nav.to('/teams')
nav.is(ERoutePath.Home) // true if on home page
nav.has(ERoutePath.Signin) // true if on any /auth/* route
```

### 3. State Updates (Typical CRUD Flow)

**Example: Team Management**

```typescript
// 1. Fetch teams from API (action)
const fetchTeams = async () => {
  const response = await fetch('/admin/teams')
  const teams = await response.json()

  // 2. Convert to Record<id, Team>
  const teamsMap = teams.reduce((acc, team) => {
    acc[team.id] = new Team(team)
    return acc
  }, {})

  // 3. Update Jotai state
  setTeams(teamsMap)

  // 4. Optionally set active team
  setActiveTeamId(teams[0].id)
}

// 5. Component reads state via selector
const TeamsPage = () => {
  const teams = useAtomValue(teamsState)
  const activeTeamId = useAtomValue(activeTeamIdState)
  const activeTeam = teams?.[activeTeamId]

  return <div>{activeTeam?.name}</div>
}
```

### 4. Theme Switching

```typescript
// 1. User clicks theme toggle button
const onThemeToggle = () => {
  const current = getThemeType()
  const next = current === EThemeType.light
    ? EThemeType.dark
    : EThemeType.light

  // 2. Update state
  setThemeType(next)

  // 3. Persist to localStorage
  storage.setThemeType(next)
}

// 4. useMakeTheme() hook recomputes theme
// 5. ThemeProvider passes new theme to MUI
// 6. All components re-render with new colors
```

## Key Patterns

### 1. State Management (Jotai)

**Atomic State**:
- Each piece of state is an independent atom
- Atoms can depend on other atoms (derived state)
- Uses `atomWithReset` for easy reset to defaults
- Global store created once (`createStore()`)

**Accessor Pattern**:
```typescript
// Centralized store access in accessors.ts
export const store = createStore()

export const getUser = () => store.get(userState)
export const setUser = (user: User) => store.set(userState, user)
export const resetUser = () => store.set(userState, undefined)
```

**Selector Pattern**:
```typescript
// Hook-based selectors in selectors.ts
export const useUser = () => {
  return useAtomValue(userState)
}

export const useSidebarOpen = () => {
  return useAtom(sidebarOpenState) // [value, setter]
}

export const useActiveTeam = () => {
  const teams = useAtomValue(teamsState)
  const activeId = useAtomValue(activeTeamIdState)
  return teams?.[activeId]
}
```

### 2. Lazy Loading & Code Splitting

**Pattern**: All pages use `React.lazy()` + `Suspense`

```typescript
const Home = lazy(() => import('@TAF/pages/Home/Home'))

<Route
  path="/"
  Component={() => (
    <Suspense fallback={<Loading fixed full />}>
      <Home />
    </Suspense>
  )}
/>
```

**Benefits**:
- Reduced initial bundle size
- Faster time-to-interactive
- Loading states during chunk fetch

### 3. Service Classes (Singleton Pattern)

**Pattern**: Singleton classes for stateful services

```typescript
// auth.ts
export class Auth {
  client = authClient

  signin = async (provider: string) => { ... }
  signout = async () => { ... }
  session = async () => { ... }
}

export const auth = new Auth() // Singleton export

// Usage
import { auth } from '@TAF/services/auth'
await auth.signin('github')
```

**Benefits**:
- Shared state across components
- Easy testing (can mock singleton)
- Organized API surface

### 4. Type-Safe Routing

**Pattern**: Enum for route paths + centralized route definitions

```typescript
// types/routes.types.ts
export enum ERoutePath {
  Home = `/`,
  Teams = `/teams`,
  Team = `/teams/:teamId`,
}

// Usage
import { ERoutePath } from '@TAF/types'
nav.to(ERoutePath.Teams)
nav.is(ERoutePath.Home)
```

**Benefits**:
- Type-safe route references
- Single source of truth
- Easy refactoring (change once, updates everywhere)

### 5. Material-UI Theming

**Pattern**: Dynamic theme generation with MUI + Emotion

```typescript
// hooks/theme/useMakeTheme.ts
export const useMakeTheme = () => {
  const themeType = useAtomValue(themeTypeState)

  return useMemo(() => {
    return createTheme({
      palette: {
        mode: themeType,
        primary: { main: '#1976d2' },
        // ... custom colors
      },
      typography: {
        fontFamily: 'Ubuntu, sans-serif',
      },
    })
  }, [themeType])
}
```

**Benefits**:
- Centralized theme logic
- Auto re-renders on theme change
- Type-safe theme access

### 6. Component Co-location

**Pattern**: Each component has its own directory with related files

```
components/Sidebar/
├── Sidebar.tsx           # Main component
├── Sidebar.styles.tsx    # Styled components (Emotion)
├── SBLogo.tsx            # Sub-component (Logo)
├── SBNavList.tsx         # Sub-component (Nav list)
└── index.ts              # Barrel export
```

**Benefits**:
- Easy to find related code
- Clear component boundaries
- Easier refactoring/deletion

### 7. Protected Routes with Neon Auth

**Pattern**: Layout component as auth guard

```typescript
const Layout = () => {
  return (
    <>
      <SignedIn>
        {/* Protected content */}
        <Sidebar />
        <Outlet />
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}
```

**Benefits**:
- Single point of auth enforcement
- Automatic redirect to login
- Session management handled by Neon Auth


### 8. Event handler callbacks

**Pattern**: Event handler callbacks should always use the `on` prefix then a related name.

```typescript

const onBlur = (evt:Event) => { ... }

const onDeleteClick = (evt:Event) => { ... }

const onSuccess = (evt:Event) => { ... }

```



## Dependencies

### Core Framework
- **react** (18.3.1) - UI library
- **react-dom** (18.3.1) - React DOM renderer
- **react-router** (7.1.1) - Client-side routing
- **vite** (5.0.12) - Build tool + dev server

### UI Components
- **@mui/material** (6.1.2) - Material-UI components
- **@mui/icons-material** (6.1.2) - Material icons
- **@mui/lab** (6.0.0-beta.10) - Experimental MUI components
- **@emotion/react** (11.13.3) - CSS-in-JS styling
- **@emotion/styled** (11.13.0) - Styled components for Emotion

### State Management
- **jotai** (2.16.1) - Primitive and flexible state management

### Authentication
- **@neondatabase/neon-js** (0.1.0-beta.21) - Neon Auth SDK

### Utilities
- **@keg-hub/jsutils** (10.0.0) - JavaScript utilities
- **@keg-hub/parse-config** (2.1.0) - Environment config parser
- **alias-hq** (6.2.4) - Path alias management
- **sonner** (1.2.3) - Toast notifications

### Build Tools
- **@vitejs/plugin-react-swc** (3.3.2) - Vite + SWC for React
- **vite-tsconfig-paths** (4.3.1) - TypeScript paths in Vite
- **vite-plugin-svgr-component** (1.0.1) - Import SVGs as React components
- **tsconfig-paths** (4.2.0) - Runtime path alias resolution
- **esbuild-register** (3.5.0) - Runtime TS transpilation

### Dev Tools
- **typescript** (5.3.3) - Type checking
- **vitest** (1.4.0) - Unit testing framework
- **@testing-library/react** (14.2.1) - React testing utilities
- **@testing-library/jest-dom** (6.4.2) - Jest DOM matchers
- **jsdom** (24.0.0) - DOM implementation for testing

### Monorepo Workspaces
- **@tdsk/components** (workspace:*) - Shared React components
- **@tdsk/database** (workspace:*) - Database models/ORM
- **@tdsk/domain** (workspace:*) - Domain models/types

## Commands

### Development
```bash
pnpm start           # Start dev server (default port 5887)
pnpm sf              # Start with force refresh (NODE_ENV=local)
pnpm host            # Start with network access (--host --open)
pnpm preview         # Preview production build
```

### Building
```bash
pnpm build           # Production build to /dist
pnpm types           # Type check (tsc -b)
```

### Testing
```bash
pnpm test            # Run Vitest tests
```

### Maintenance
```bash
pnpm clean           # Remove node_modules
```

### Commands Notes

* Linting and formatting are automatically, so `pnpm lint` and `pnpm format` commands should be ignored.


## Integration Points

### 1. Backend API Communication

**Proxy Integration**:
```
Admin SPA → Auth-Proxy (repos/proxy) → Backend (repos/backend)
    ↓
/admin/*  → Backend Admin API endpoints
/proxy/*  → Backend Proxy Engine
/faas/*   → Backend FaaS Engine
/ai/*     → Backend AI Engine
```

**API Call Pattern** (expected):
```typescript
// From admin component
const response = await fetch('/admin/teams', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.token}` // JWT injected by proxy
  }
})
```

### 2. Shared Components

**Import from @tdsk/components** (`repos/components`):
```typescript
import { Loading, MemoChildren, useWindowResize } from '@tdsk/components'
```

**Available Components**:
- `Loading` - Loading spinner with fixed/full options
- `MemoChildren` - Memoized children wrapper
- `useWindowResize` - Hook for responsive behavior
- `overlayScrollBody` - Custom scrollbar overlay
- `dims` - Dimension constants (header height, etc.)

### 3. Domain Models

**Import from @tdsk/domain** (`repos/domain`):
```typescript
import { User, Team, Repo, Provider } from '@tdsk/domain'
```

**Model Classes**:
- `User` - User model with methods
- `Team` - Team model
- `Repo` - Repository model
- `Provider` - API provider model
- `Endpoint` - API endpoint model
- `Function` - FaaS function model
- `Secret` - Secret model

### 4. Database Types

**Import from @tdsk/database** (`repos/database`):
```typescript
import type { DatabaseUser, DatabaseTeam } from '@tdsk/database'
```

**Usage**: Convert database types to domain models:
```typescript
const team = new Team(databaseTeam)
```

### 5. Environment Variables

**Loaded via**: `@keg-hub/parse-config` from `deploy/values.*.yml`

**Available in Admin**:
- `TDSK_AUTH_URL` - Neon Auth API URL
- `TDSK_AUTH_PROVIDERS` - Comma-separated OAuth providers (github,gitlab,google,vercel)
- `TDSK_AD_PORT` - Dev server port (default 5887)
- `TDSK_AD_BASE_PATH` - Base path for deployment (default `/`)
- `TDSK_AD_APP_VERSION` - App version (from package.json)
- `TDSK_AD_OVERRIDE_ENVS` - Override env loading behavior

**Access Pattern**:
```typescript
// constants/envs.ts
export const TDSK_AUTH_URL = process.env.TDSK_AUTH_URL as string
export const TDSK_AUTH_PROVIDERS = (process.env.TDSK_AUTH_PROVIDERS as string)
  .split(',')
  .map(p => p.trim())
```

### 6. Monorepo Path Resolution

**Vite Config** (`configs/vite.workspace.ts`):
```typescript
viteTsconfigPaths({
  root: rootDir,
  projects: [
    rootDir,                      // repos/admin
    path.join(rootDir, '../domain'),    // repos/domain
    path.join(rootDir, '../database'),  // repos/database
    path.join(rootDir, '../components') // repos/components
  ]
})
```

**Enables**:
- Cross-workspace TypeScript path resolution
- Vite HMR across workspace dependencies
- Single tsconfig.json per repo

## Development Guidelines

### 1. Adding a New Page

```typescript
// 1. Create page component
// repos/admin/src/pages/NewPage/NewPage.tsx
import { Page } from '@TAF/pages/Page/Page'

export const NewPage = () => {
  return <Page className='tdsk-new-page'>
    {/* content */}
  </Page>
}

export default NewPage

// 2. Add route enum
// repos/admin/src/types/routes.types.ts
export enum ERoutePath {
  // ... existing
  NewPage = `/new-page`,
}

// 3. Add route definition
// repos/admin/src/routes/Routes.tsx
const NewPage = lazy(() => import('@TAF/pages/NewPage/NewPage'))

export const Routes = createBrowserRouter([
  {
    path: ERoutePath.Home,
    Component: Layout,
    children: [
      // ... existing
      {
        path: ERoutePath.NewPage,
        Component: () => (
          <Suspense fallback={<Loading fixed full />}>
            <NewPage />
          </Suspense>
        )
      }
    ]
  }
])

// 4. Add nav item (if needed)
// repos/admin/src/constants/nav.ts
export const NavItems = [
  // ... existing
  { label: 'New Page', path: ERoutePath.NewPage, icon: <Icon /> }
]
```

### 2. Adding Global State

```typescript
// 1. Create atom
// repos/admin/src/state/myState.ts
import { atomWithReset } from 'jotai/utils'

export const defMyState: MyType = undefined
export const myState = atomWithReset<MyType>(defMyState)

// 2. Add accessors
// repos/admin/src/state/accessors.ts
import { myState, defMyState } from '@TAF/state/myState'

export const getMyState = () => store.get(myState)
export const resetMyState = () => store.set(myState, defMyState)
export const setMyState = (value: MyType) => store.set(myState, value)

// 3. Add selector (if needed)
// repos/admin/src/state/selectors.ts
export const useMyState = () => {
  return useAtom(myState)
}

// 4. Use in component
import { useMyState } from '@TAF/state/selectors'

const MyComponent = () => {
  const [myState, setMyState] = useMyState()
  // ...
}
```

### 3. Calling Backend API

```typescript
// 1. Create action
// repos/admin/src/actions/teams/fetchTeams.ts
import { setTeams } from '@TAF/state/accessors'

export const fetchTeams = async () => {
  try {
    const response = await fetch('/admin/teams')
    if (!response.ok) throw new Error('Failed to fetch teams')

    const teams = await response.json()
    const teamsMap = teams.reduce((acc, team) => {
      acc[team.id] = new Team(team)
      return acc
    }, {})

    setTeams(teamsMap)
    return { teams: teamsMap }
  } catch (error) {
    console.error('fetchTeams error:', error)
    return { error }
  }
}

// 2. Call from component
import { fetchTeams } from '@TAF/actions/teams/fetchTeams'

const TeamsPage = () => {
  const teams = useAtomValue(teamsState)

  useEffectOnce(() => {
    fetchTeams()
  })

  return <div>{/* render teams */}</div>
}
```

### 4. Creating Styled Components

```typescript
// repos/admin/src/components/MyComponent/MyComponent.styles.tsx
import { styled } from '@mui/material/styles'
import { Box, Button } from '@mui/material'

export const MyContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}))

export const MyButton = styled(Button)(({ theme }) => ({
  color: theme.palette.primary.contrastText,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}))

// Usage in MyComponent.tsx
import { MyContainer, MyButton } from './MyComponent.styles'

export const MyComponent = () => {
  return (
    <MyContainer>
      <MyButton variant="contained">Click Me</MyButton>
    </MyContainer>
  )
}
```

### 5. Adding a Service

```typescript
// repos/admin/src/services/myService.ts
export class MyService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async getData() {
    const response = await fetch(`${this.baseUrl}/data`)
    return response.json()
  }
}

export const myService = new MyService('/api/my-service')

// Usage
import { myService } from '@TAF/services/myService'
const data = await myService.getData()
```

## Common Issues & Solutions

### 1. Path Alias Not Resolving

**Problem**: Import using `@TAF/*` not found

**Solution**:
- Check `tsconfig.json` paths configuration
- Verify `configs/vite.workspace.ts` has correct aliases
- Restart TypeScript server in IDE
- Run `pnpm types` to check for TS errors

### 2. State Not Updating

**Problem**: Jotai state changes not triggering re-render

**Solution**:
- Use `useAtomValue()` or `useAtom()` hook (not `store.get()`)
- Ensure component is wrapped in `<Provider store={store}>`
- Check for mutations (always create new objects/arrays)

### 3. Auth Redirect Loop

**Problem**: Stuck redirecting between login and home

**Solution**:
- Check `TDSK_AUTH_URL` is correct
- Verify Neon Auth session is valid
- Clear browser cookies/localStorage
- Check `SignedIn` / `RedirectToSignIn` logic in Layout

### 4. Environment Variables Not Loading

**Problem**: `process.env.TDSK_*` is undefined

**Solution**:
- Check `deploy/values.local.yml` has correct values
- Verify `configs/frontend.config.ts` loadEnvs() is called
- Ensure `TDSK_AD_OVERRIDE_ENVS` is set for local dev
- Restart dev server after changing env files

### 5. HMR Not Working for Domain/Components

**Problem**: Changes in `@tdsk/domain` or `@tdsk/components` don't trigger HMR

**Solution**:
- Check `vite.workspace.ts` includes workspace projects
- Verify `tsconfig.json` paths are correct
- Use `pnpm sf` (force refresh) instead of `pnpm start`
- Ensure workspace packages are built (`pnpm build` in each)

## Best Practices

1. **Always use path aliases** - Prefer `@TAF/*` over relative imports
2. **Co-locate styles** - Keep styled components in `.styles.tsx` next to component
3. **Lazy load pages** - Wrap all route components in `React.lazy()`
4. **Use Jotai selectors** - Create hooks in `selectors.ts` for derived state
5. **Type everything** - Avoid `any`, use proper TypeScript types
6. **Service classes for stateful APIs** - Use singleton pattern
7. **Atomic state** - Keep state atoms small and focused
8. **Error boundaries** - Wrap Suspense with error boundaries for robustness
9. **Loading states** - Always show loading UI during async operations
10. **Theme-aware styling** - Use `theme` parameter in styled components

---

**Last Updated**: 2026-01-18
**Version**: 1.2.0
**Maintainer**: ThreadedStack Team

## Changelog

### v1.2.0 (2026-01-18)
- **New**: Billing & Subscriptions - Payment plans via Polar.sh
- **New**: Quota Management - Track org resource usage (12 resource types)
- **New**: `subscriptionsApi.ts` - API service for subscriptions (current, plans, checkout, portal, cancel)
- **New**: `quotasApi.ts` - API service for quotas (get usage, limits, check)
- **New**: `/billing` page - Subscription management with plan cards and checkout flow
- **New**: `/orgs/:orgId/usage` page - Quota usage tracking with progress bars
- **New**: `Billing/` components - `PlanCard`, `CurrentPlan`, `QuotaUsage`
- **New**: State atoms for subscriptions and quotas (Jotai)
- **New**: Actions for subscriptions and quotas API integration
- **New**: Integration with backend payment endpoints

### v1.1.0 (2026-01-15)
- **Breaking**: Teams renamed to Organizations (orgs)
- **Breaking**: Repos renamed to Projects
- **New**: API Keys management at org level
- **New**: Secrets management at org and project levels
- **New**: Endpoints and Functions at project level
- **New**: User invitation and role management for orgs
- **New**: Nested routing - Projects are under Organizations
- **New**: Multiple new state atoms for all new entities
