---
name: "tdsk-threads"
description: "Knowledge base for the user-facing threads SPA (work in progress)"
tags: ["react", "vite", "mui", "jotai", "threads", "auth", "neon", "spa", "wip"]
---
# Threads Repo Skill

## Overview

The **Threads** repo (`repos/threads`, `@tdsk/threads`) is the user-facing SPA for org members to interact with ThreadedStack services. It allows users to log in to an organization and access services they've been granted via the Admin UI.

**Status: Work In Progress** — Core scaffolding is complete (auth, theming, routing, API layer, state management), but content pages are placeholders. Sidebar navigation and thread/agent UIs are not yet implemented.

**Key Characteristics:**
- **Type**: User-facing SPA (distinct from admin dashboard)
- **Package**: `@tdsk/threads` v0.1.0 (private)
- **Runtime**: Vite 5 + Bun, dev server on port 5887 (`TDSK_TH_PORT`)
- **Path Aliases**: Uses `@TTH/*` prefix via `alias-hq` for internal imports
- **Auth**: Neon Auth (OAuth + email/password) with proactive token refresh
- **Styling**: MUI 6 + Emotion CSS-in-JS
- **State**: Jotai (same pattern as admin repo)

## Directory Structure

```
repos/threads/
├── configs/
│   ├── vite.config.ts          # Vite config entry
│   ├── vite.workspace.ts       # Full Vite config (SWC, tsconfig-paths, SVGR, markdown)
│   ├── frontend.config.ts      # Env loader, port, aliases
│   └── biome.json              # Biome linter/formatter
├── scripts/
│   ├── setupTests.ts           # Vitest setup (mocks: Neon Auth, API, MUI)
│   ├── registerPaths.ts        # TypeScript path registration
│   └── testUtils.tsx           # Test helper utilities
├── public/
│   └── index.html              # HTML entry point
├── src/
│   ├── index.tsx               # React bootstrap: Jotai Provider → AuthProvider → App + Version
│   ├── App.tsx                 # Root: ThemeProvider → GlobalStyles → RouterProvider
│   ├── actions/
│   │   └── auth/               # Auth actions (init, signout)
│   ├── components/
│   │   ├── Login/              # Login, EmailLoginForm, OAuth buttons (Github, Google, Gitlab, Vercel), LoginError
│   │   ├── Sidebar/            # Sidebar (router), DesktopSidebar (placeholder), MobileSidebar (drawer), SBLogo, SBProjectSelector
│   │   └── Version/            # Version display (bottom-right corner)
│   ├── contexts/
│   │   └── AuthProvider.tsx    # Neon Auth UI provider + session initialization
│   ├── constants/
│   │   ├── envs.ts             # Environment variables
│   │   ├── nav.ts              # Navigation items (empty — WIP)
│   │   ├── storage.ts          # localStorage keys
│   │   ├── query.ts            # TanStack Query defaults (5min stale, 30min GC)
│   │   └── values.ts           # SidebarWidthOpen (240), SidebarWidthClosed (60)
│   ├── hooks/
│   │   └── theme/              # useMakeTheme, useTheme, useThemeToggle
│   ├── pages/
│   │   ├── Home/               # Welcome page (placeholder)
│   │   ├── Login/              # Auth page with OAuth + email login
│   │   ├── Settings/           # User preferences (dark mode, notifications — basic)
│   │   ├── Layout/             # Root layout: Sidebar + mobile toggle + Outlet
│   │   └── Page.tsx            # Generic page wrapper with init, loading, responsive layout
│   ├── routes/
│   │   └── Routes.tsx          # React Router v7 with lazy loading
│   ├── services/
│   │   ├── api.ts              # ApiService: fetch wrapper + Bearer token + TanStack Query cache
│   │   ├── auth.ts             # Auth: Neon Auth client wrapper (signin, signout, session)
│   │   ├── query.ts            # QueryService: TanStack Query client wrapper
│   │   ├── storage.ts          # Storage: localStorage abstraction
│   │   └── tokenRefresh.ts     # TokenRefreshManager: proactive JWT refresh before expiry
│   ├── state/
│   │   ├── user.ts             # userState atom
│   │   ├── theme.ts            # themeTypeState atom
│   │   ├── app.ts              # sidebarOpenState atom
│   │   ├── accessors.ts        # Imperative get*/set*/reset* + shared store
│   │   └── selectors.ts        # Hook-based useUser, useThemeType, useSidebarOpen
│   ├── theme/
│   │   └── GlobalStyles.tsx    # Global CSS (Ubuntu, JetBrains Mono, scrollbar, focus outlines)
│   ├── types/                  # TypeScript type definitions
│   └── utils/
│       ├── api/                # API helpers (genFormData)
│       └── errors/             # Error handling utilities
├── package.json
└── tsconfig.json
```

## Key Files

### Entry Point Flow

1. **public/index.html** loads `/src/index.tsx` via Vite
2. **src/index.tsx** bootstraps: `StrictMode` → `Jotai Provider (store)` → `AuthProvider` → `App` + `Version`
3. **src/App.tsx** renders: `ThemeProvider` → `GlobalStyles` → `RouterProvider`
4. **src/routes/Routes.tsx** defines all routes with lazy loading

### Services

- **`services/api.ts`** — `ApiService` class: manages base URL, Bearer token injection via Neon Auth session, TanStack Query caching, error handling. Methods: `fetch()`, `get()`, `post()`, `put()`, `delete()`. URL resolution: `TDSK_CADDY_PX_HOST` > `TDSK_PX_URL` > `TDSK_PX_HOST:TDSK_PX_PORT`
- **`services/auth.ts`** — `Auth` class: wraps Neon Auth client (`createAuthClient`). Methods: `signin(provider)`, `signout()`, `session()` (returns `{ session, user: new User(data.user) }`)
- **`services/tokenRefresh.ts`** — `TokenRefreshManager`: schedules proactive token refresh before JWT expiry. On 401: refresh token and retry the failed request once
- **`services/query.ts`** — `QueryService`: wraps TanStack `QueryClient`. Defaults: staleTime 5min, gcTime 30min, no retry, refetchOnWindowFocus off
- **`services/storage.ts`** — `Storage`: typed localStorage wrapper with JSON serialization

## Routing

**React Router v7** (`createBrowserRouter`):

```
/ (Layout: Sidebar + Outlet)
├── /          → Home (placeholder welcome page)
└── /settings  → Settings (theme toggle, notification preferences)

/auth/:pathname → Login (OAuth + email/password)

* → Redirect to /
```

All pages lazy-loaded with `React.lazy()` + `<Suspense>` fallback via `Loading` component.

## Authentication

**Neon Auth** integration (same pattern as admin repo):

1. **AuthProvider** (`contexts/AuthProvider.tsx`) wraps app with `NeonAuthUIProvider`
2. On mount: calls `auth.session()` to check existing session
3. Shows `Loading` during auth check, `LoginError` on failure
4. **Layout** page uses Neon Auth's `SignedIn` / `RedirectToSignIn` guards

**Login Methods:**
- OAuth: GitHub, Google, GitLab, Vercel (configurable via `TDSK_AUTH_PROVIDERS`)
- Email/password: `EmailLoginForm` component

**Token Refresh:**
- `TokenRefreshManager` schedules refresh before JWT expiry
- On 401: automatically refreshes token and retries the request once
- Prevents session expiration during active use

## State Management

**Jotai** with the same 3-layer pattern as the admin repo:

### Atoms (`src/state/`)

| File | Atoms | Purpose |
|------|-------|---------|
| `user.ts` | `userState` | Current authenticated user (`User` from `@tdsk/domain`) |
| `theme.ts` | `themeTypeState` | Light/dark theme mode |
| `app.ts` | `sidebarOpenState` | Sidebar open/closed toggle |

### Accessors (`src/state/accessors.ts`)

Imperative `get*/set*/reset*` functions for use outside React (actions, services):
```typescript
export const store = createStore()
export const getUser = () => store.get(userState)
export const setUser = (user) => store.set(userState, user)
export const resetUser = () => store.set(userState, RESET)
// ... same for theme, sidebar
```

### Selectors (`src/state/selectors.ts`)

Hook-based access for React components:
```typescript
export const useUser = () => useRecState(userState)       // [value, setter, resetter]
export const useThemeType = () => useRecState(themeTypeState)
export const useSidebarOpen = () => useRecState(sidebarOpenState)
```

## Styling

- **MUI v6** + **Emotion** for components and CSS-in-JS
- **`makeTheme()`** from `@tdsk/components` — shared theme factory (dark/light)
- **Global Styles** (`theme/GlobalStyles.tsx`):
  - Fonts: Ubuntu (body), JetBrains Mono (code)
  - Custom webkit scrollbar styling
  - Focus visible outlines (2px blue, 2px offset)
  - Utility classes: `.hidden`, `.inherit`, `.text-center`
- **Responsive**: MUI breakpoints, mobile sidebar drawer vs desktop sidebar

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TDSK_TH_PORT` | `5887` | Dev server port |
| `TDSK_TH_BASE_PATH` | `/` | URL base path |
| `TDSK_TH_APP_VERSION` | from package.json | App version (required) |
| `TDSK_AUTH_URL` | — | Neon Auth API URL (required) |
| `TDSK_AUTH_PROVIDERS` | `github` | Comma-separated OAuth providers |
| `TDSK_PX_URL` / `TDSK_PX_HOST` / `TDSK_PX_PORT` | — | Proxy server config |
| `TDSK_CADDY_PX_HOST` | — | Caddy proxy host (takes priority in URL resolution) |
| `TDSK_BE_API_ADMIN_PATH` | — | Backend admin API path |
| `TDSK_POSTHOG_KEY` / `TDSK_POSTHOG_HOST` | — | PostHog analytics |

## Commands

```bash
pnpm start          # Dev server (port 5887)
pnpm build          # Production build
pnpm test           # Vitest tests
pnpm types          # TypeScript type checking
```

## Tests

6 co-located test files:
- `src/pages/Login/Login.test.tsx`
- `src/components/Login/Login.test.tsx`
- `src/components/Login/EmailLoginForm.test.tsx`
- `src/actions/auth/local/signout.test.ts`
- `src/services/api.test.ts`
- `src/utils/api/genFormData.test.ts`

Test setup: `scripts/setupTests.ts` mocks Neon Auth client, API service, and MUI. Environment: jsdom.

## Integration Points

| Consumer | Import | Key Usage |
|----------|--------|-----------|
| **@tdsk/components** | Shared UI | `makeTheme`, `Loading`, `Text`, `LoadingButton`, `Storage`, `TSIcon`, `useEffectOnce`, `MemoChildren`, `useTheme`, `overlayScrollBody` |
| **@tdsk/domain** | Domain models | `User` type/class |

### Path Aliases

```typescript
import { Something } from '@TTH/components/Login'   // → ./src/components/Login
import { User } from '@TDM/models'                   // → ../domain/src/models
import { makeTheme } from '@TSC/theme'               // → ../components/src/theme
```

## WIP Status

The following areas are scaffolded but not yet implemented:

| Area | Current State | Next Steps |
|------|---------------|------------|
| **Sidebar** | Desktop: placeholder text "Threads Sidebar". Mobile: drawer shell | Implement thread/agent navigation |
| **Home page** | "Welcome to Threaded Stack" card | Thread list, activity feed |
| **Settings** | Theme toggle + notification checkbox | User preferences, API key management |
| **Navigation** | `nav.ts` exports empty | Define nav items once thread/agent routes exist |
| **SBProjectSelector** | Component exists, not wired | Org/project switching |
| **Thread UI** | Not started | Thread list, message view, chat interface |
| **Agent UI** | Not started | Agent interaction panel |

## Key Patterns

### 1. Same Architecture as Admin

The threads repo mirrors the admin repo's architecture:
- Jotai 3-layer state (atoms → accessors → selectors)
- ApiService with Bearer token + TanStack Query caching
- AuthProvider with Neon Auth + session init
- Layout with SignedIn guard
- Lazy-loaded routes with Suspense
- MUI theming via shared `makeTheme()`

### 2. Action Pattern

```typescript
// actions/auth/local/signout.ts
export const signout = async () => {
  await auth.signout()
  resetUser()
  // ... clear state
}
```

### 3. Token Refresh

`TokenRefreshManager` wraps `ApiService` to handle JWT lifecycle:
- Schedules refresh before expiry (proactive, not reactive)
- On 401: refresh + retry once (prevents unnecessary logouts)
- Cleanup on signout

## Development Notes

### Adding a New Page

1. Create page component with default export in `src/pages/<Name>/`
2. Add lazy route in `src/routes/Routes.tsx` inside Layout children
3. Add nav item in `src/constants/nav.ts` (once nav is implemented)

### Adding State

Follow the admin repo's 3-layer pattern:
1. Create atom in `src/state/<entity>.ts` with `atomWithReset`
2. Add imperative accessors in `src/state/accessors.ts`
3. Add hook-based selector in `src/state/selectors.ts`

### Adding an API Service

Extend or create new service class using `ApiService` singleton:
```typescript
class ThreadsApi extends BaseApi {
  list = (orgId: string) => this.api.get(`/orgs/${orgId}/threads`)
}
export const threadsApi = new ThreadsApi()
```
