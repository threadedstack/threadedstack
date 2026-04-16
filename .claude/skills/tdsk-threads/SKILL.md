---
name: "tdsk-threads"
description: "Knowledge base for the user-facing threads SPA — sandbox session management and interaction"
tags: ["react", "vite", "mui", "jotai", "threads", "auth", "neon", "spa", "sandbox", "session", "websocket", "terminal", "ghostty"]
---
# Threads Repo Skill

## Overview

The **Threads** repo (`repos/threads`, `@tdsk/threads`) is the user-facing SPA for org members to interact with sandbox sessions. It provides a full session management interface with dual chat/terminal views, real-time WebSocket streaming, generative UI rendering, and hierarchical org/project/sandbox navigation.

**Key Characteristics:**
- **Type**: User-facing sandbox session SPA (distinct from admin dashboard)
- **Package**: `@tdsk/threads` v0.1.0 (private)
- **Runtime**: Vite 5 + Bun, dev server on port 5887 (`TDSK_TH_PORT`)
- **Path Aliases**: Uses `@TTH/*` prefix via `alias-hq` for internal imports
- **Auth**: Neon Auth (OAuth + email/password) with proactive token refresh
- **Styling**: MUI 6 + Emotion CSS-in-JS
- **State**: Jotai (same 3-layer pattern as admin repo)
- **Terminal**: Ghostty-based terminal emulator via `ghostty-web`

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
│   │   ├── init.ts             # App initialization: auth session → org/sandbox/project hydration
│   │   ├── auth/               # Auth actions (init, signin, signout, reset)
│   │   ├── orgs/               # Org actions (selectOrg)
│   │   ├── projects/           # Project actions (listProjects)
│   │   ├── sandboxes/          # Sandbox actions (list, connect, recreate, restart, stop)
│   │   ├── sessions/           # Session actions (openSession, closeSession, sendInput, sendControl, loadSandboxSessions)
│   │   └── threads/            # Thread actions (loadThreadHistory, viewThread)
│   ├── components/
│   │   ├── Breadcrumbs/        # Breadcrumbs, OrgSelector, ProjectSelector
│   │   ├── ChatView/           # ChatView, AiBubble, UserBubble, ToolCallCard, PermissionCard, DiffCard, ErrorCard, ThinkingIndicator, UnknownBlock, GenerativeUIRenderer
│   │   │   └── registry/       # GuiSelect, GuiConfirm, GuiTextInput, GuiAlert, GuiProgressBar
│   │   ├── Login/              # Login, EmailLoginForm, OAuth buttons (Github, Google, Gitlab, Vercel), LoginError
│   │   ├── OrgSelector/        # OrgSelector component
│   │   ├── Session/            # SessionCommands (stop/restart/recreate/share/new/leave)
│   │   ├── SessionTabs/        # SessionTabs (tab bar) + OpenSessionStrip (chip bar for mobile)
│   │   ├── Sidebar/            # Sidebar, DesktopSidebar, MobileSidebar, NavTree, NavProjectItem, NavSandboxItem, NavSessionItem, NavThreadItem, SBLogo, Sidebar.styles
│   │   ├── SmartInput/         # SmartInput: context-aware input (5 modes: idle, prompt, working, permission, interactive)
│   │   ├── TerminalView/       # TerminalView: ghostty-web terminal emulator
│   │   └── Version/            # Version display (bottom-right corner)
│   ├── constants/
│   │   ├── envs.ts             # Environment variables
│   │   ├── nav.tsx             # Navigation items
│   │   ├── sessions.ts         # Session storage key
│   │   ├── storage.ts          # localStorage keys
│   │   ├── query.ts            # TanStack Query defaults (5min stale, 30min GC)
│   │   └── values.ts           # SidebarWidthOpen (240), SidebarWidthClosed (60), ConnectionTimeout (30s), RawBufferMaxBytes (1MB)
│   ├── contexts/
│   │   └── AuthProvider.tsx    # Neon Auth UI provider + session initialization
│   ├── hooks/
│   │   └── theme/              # useMakeTheme, useTheme, useThemeToggle
│   ├── pages/
│   │   ├── Home/               # Dashboard landing — org/project/sandbox summary with OpenSessionStrip
│   │   ├── Login/              # Auth page with OAuth + email login
│   │   ├── Project/            # Project detail — sandbox card grid with status indicators
│   │   ├── Sandbox/            # Sandbox detail — session list (own + shared), reconnect/join/new actions
│   │   ├── Session/            # Session workspace — chat/terminal toggle, SessionCommands, auto-reconnect
│   │   ├── Settings/           # User preferences (dark mode, notifications)
│   │   ├── Layout/             # Root layout: Sidebar + SessionTabs + Outlet
│   │   └── Page/               # Generic page wrapper with init, loading, responsive layout
│   ├── routes/
│   │   └── Routes.tsx          # React Router v7 with lazy loading
│   ├── services/
│   │   ├── api.ts              # ApiService + BaseApi: fetch wrapper + Bearer token + TanStack Query cache
│   │   ├── auth.ts             # Auth: Neon Auth client wrapper (signin, signout, session)
│   │   ├── nav.ts              # Navigation service
│   │   ├── orgsApi.ts          # OrgsApi: list organizations
│   │   ├── projectsApi.ts      # ProjectsApi: list projects (org-scoped)
│   │   ├── sandboxApi.ts       # SandboxApi: list, connect, sessions, stop (org+project-scoped)
│   │   ├── threadsApi.ts       # ThreadsApi: listBySandbox, messages
│   │   ├── query.ts            # QueryService: TanStack Query client wrapper
│   │   ├── storage.ts          # Storage: localStorage abstraction
│   │   └── tokenRefresh.ts     # TokenRefreshManager: proactive JWT refresh before expiry
│   ├── state/
│   │   ├── user.ts             # userState atom
│   │   ├── theme.ts            # themeTypeState atom
│   │   ├── app.ts              # sidebarOpenState, orgIdState, activeProjectIdState, derived activeOrgState/activeProjectState
│   │   ├── sessions.ts         # sessionEventsAtom, sessionToolStateAtom, openSessionsAtom, activeSessionAtom, sandboxesAtom, orgsAtom, projectsAtom, sessionUpgradesAtom
│   │   ├── accessors.ts        # Imperative get*/set*/reset* + shared store (30+ accessors)
│   │   └── selectors.ts        # Hook-based selectors (useUser, useSessionEvents, useToolState, useOpenSessions, useActiveSession, useSandboxes, useOrgs, useProjects, useActiveOrg, useActiveProject, useSessionsForSandbox, useSandboxHasSession, useSandboxToolState, useSessionUpgrades)
│   ├── theme/
│   │   └── GlobalStyles.tsx    # Global CSS (Ubuntu, JetBrains Mono, scrollbar, focus outlines)
│   ├── types/
│   │   ├── api.types.ts        # TApiRes, TApiCacheKeys
│   │   ├── auth.types.ts       # Auth-related types
│   │   ├── query.types.ts      # Query-related types
│   │   ├── routes.types.ts     # ERoutePath enum (Home, Auth, Settings, Project, Sandbox, Session, etc.)
│   │   ├── sessions.types.ts   # TOpenSession, TOpenSessionOpts, TSessionCategory, TClassifiedSession
│   │   └── theme.types.ts      # Theme-related types
│   └── utils/
│       ├── api/                # API helpers (genFormData)
│       ├── errors/             # Error handling utilities
│       ├── sessionStorage.ts   # Browser sessionStorage: storeSession, getStoredSessions, removeStoredSession, clearStoredSessionsForSandbox, findSandboxForSession
│       └── stdinTranslation.ts # translateInteraction: converts TInteraction to terminal stdin bytes (ArrowSelect, NumberSelect, YesNo, TextInput, Keystroke)
├── package.json
└── tsconfig.json
```

## Key Files

### Entry Point Flow

1. **public/index.html** loads `/src/index.tsx` via Vite
2. **src/index.tsx** bootstraps: `StrictMode` → `Jotai Provider (store)` → `AuthProvider` → `App` + `Version`
3. **src/App.tsx** renders: `ThemeProvider` → `GlobalStyles` → `RouterProvider`
4. **src/routes/Routes.tsx** defines all routes with lazy loading
5. **actions/init.ts** hydrates state: auth session → org list → restore saved org → load sandboxes + projects

### Services

- **`services/api.ts`** — `ApiService` class + `BaseApi` base class: manages base URL, Bearer token injection via Neon Auth session, TanStack Query caching, error handling. Methods: `fetch()`, `get()`, `post()`, `put()`, `delete()`. URL resolution: `TDSK_CADDY_PX_HOST` > `TDSK_PX_URL` > `TDSK_PX_HOST:TDSK_PX_PORT`
- **`services/auth.ts`** — `Auth` class: wraps Neon Auth client (`createAuthClient`). Methods: `signin(provider)`, `signout()`, `session()` (returns `{ session, user: new User(data.user) }`)
- **`services/orgsApi.ts`** — `OrgsApi`: `list()` → returns `Organization[]`
- **`services/projectsApi.ts`** — `ProjectsApi`: `list(orgId)` → returns `Project[]`
- **`services/sandboxApi.ts`** — `SandboxApi`: `list(orgId)`, `connect(orgId, projectId, id)` → `TSandboxConnectResponse`, `sessions(orgId, projectId, id)` → `TSandboxSession[]`, `stop(orgId, projectId, id, podName)`
- **`services/threadsApi.ts`** — `ThreadsApi`: `listBySandbox(orgId, sandboxId)` → `Thread[]`, `messages(orgId, sandboxId, threadId)` → `Message[]`
- **`services/tokenRefresh.ts`** — `TokenRefreshManager`: schedules proactive token refresh before JWT expiry. On 401: refresh token and retry the failed request once
- **`services/query.ts`** — `QueryService`: wraps TanStack `QueryClient`. Defaults: staleTime 5min, gcTime 30min, no retry, refetchOnWindowFocus off
- **`services/storage.ts`** — `Storage`: typed localStorage wrapper with JSON serialization

## Routing

**React Router v7** (`createBrowserRouter`):

```
/ (Layout: Sidebar + SessionTabs + Outlet)
├── /                         → Home (dashboard with org/project/sandbox summary)
├── /settings                 → Settings (theme toggle, notification preferences)
├── /project/:projectId       → Project (sandbox card grid with status indicators)
├── /sandbox/:sandboxId       → Sandbox (session list: own + shared, reconnect/join/new)
└── /session/:sessionId       → Session (chat/terminal toggle, commands, auto-reconnect)

/auth/:pathname → Login (OAuth + email/password)

* → Redirect to /
```

All pages lazy-loaded with `React.lazy()` + `<Suspense>` fallback via `Loading` component. Project and Session pages use React Router `lazy()` exports (`export const Component`).

## Session Management

### WebSocket Connection (`actions/sessions/openSession.ts`)

The core of the SPA. `openSession()` establishes a WebSocket connection to a sandbox shell:

1. Calls `sandboxApi.connect()` to start the pod and get a `shellToken`
2. Opens WebSocket to `/_/sandboxes/:sandboxId/shell?token=...&cols=80&rows=24`
3. Resolves session intent: `null` = new session, `string` = specific session, `undefined` = reconnect from sessionStorage
4. Handles connection lifecycle messages: `connected`, `joined`, `reconnected`, `visibility`, `user-joined`, `user-left`, `generative-ui`, parsed events, `error`
5. Manages raw terminal buffer (capped at 1MB via `RawBufferMaxBytes`) for terminal replay
6. Terminal writers: `subscribeTerminalData()` pushes decoded binary data to TerminalView instances
7. State updates: `setOpenSession()`, `setActiveSession()`, `appendSessionEvent()`, `setToolState()`, `setSessionUpgrade()`
8. Session persistence: `storeSession()` / `removeStoredSession()` in browser `sessionStorage`

**Connection module state** (module-scoped Maps, not Jotai):
- `connections: Map<string, WebSocket>` — active WebSocket connections
- `rawBuffers: Map<string, string[]>` — terminal output ring buffer per session
- `terminalWriters: Map<string, Set<(data: string) => void>>` — subscriber callbacks for terminal data

### Session Actions (`actions/sessions/`)

| Action | Purpose |
|--------|---------|
| `openSession(opts)` | Connect WebSocket to sandbox shell, returns `Promise<sessionId>` |
| `closeSession(sessionId, opts?)` | Close WebSocket, remove from state, optionally preserve sessionStorage |
| `sendInput(sessionId, text)` | Send text as binary (TextEncoder) to WebSocket |
| `sendControl(sessionId, msg)` | Send JSON control message (resize, signal, permission-response, visibility) |
| `approvePermission(sessionId)` | Send `{ type: 'permission-response', response: 'y' }` |
| `denyPermission(sessionId)` | Send `{ type: 'permission-response', response: 'n' }` |
| `getRawBuffer(sessionId)` | Get terminal output buffer for replay |
| `getConnection(sessionId)` | Get WebSocket instance |
| `subscribeTerminalData(sessionId, cb)` | Subscribe to decoded terminal data, returns unsubscribe |
| `fetchSandboxSessions(opts)` | Fetch sessions from backend API |
| `classifySessions(backend, local, userId)` | Pure classifier: categorizes sessions as `connected`, `disconnected`, or `shared` |

### Session Types (`types/sessions.types.ts`)

```typescript
type TOpenSession = {
  runtime: string
  podName: string
  threadId: string
  sandboxId: string
  sessionId: string
  projectId: string
  podOwnerUserId: string
  visibility: ESandboxSessionVisibility
}

type TOpenSessionOpts = {
  orgId: string
  run?: boolean
  sandboxId: string
  projectId: string
  sessionId?: string | null  // null = new, string = reconnect, undefined = auto-resolve
}

type TSessionCategory = 'connected' | 'disconnected' | 'shared'
type TClassifiedSession = Omit<TSandboxSession, 'orgId' | 'podName'> & { category: TSessionCategory }
```

## ChatView System

### Event Routing (`components/ChatView/ChatView.tsx`)

The `ChatView` renders a stream of `TParsedEvent` objects from `useSessionEvents(sessionId)`. Each event type maps to a dedicated component:

| Event Type | Component | Description |
|-----------|-----------|-------------|
| `input` | `UserBubble` | User-submitted text, distinguishes own vs other user input |
| `text` | `AiBubble` | AI assistant text response |
| `tool-call` | `ToolCallCard` | Tool invocation with name, args, result |
| `permission` | `PermissionCard` | Permission request with approve/deny buttons |
| `diff` | `DiffCard` | File diff display |
| `error` | `ErrorCard` | Error message display |
| `activity` | `ThinkingIndicator` | Working/thinking animation |
| `unknown` | `UnknownBlock` | Fallback for unrecognized event types |
| `prompt-ready` | (null) | Suppressed — indicates tool is ready for input |

### Generative UI System

The ChatView supports **generative UI upgrades**: when the backend sends a `generative-ui` WebSocket message with a `chunkId` and `tree`, the events for that chunk are replaced with an interactive component tree.

**`GenerativeUIRenderer`** (`components/ChatView/GenerativeUIRenderer.tsx`):
- Receives a `TJsonComponentTree` (recursive JSON component tree)
- Recursively renders nodes: registered components from `GuiComponentRegistry`, or allowed HTML elements from `AllowedHtmlElements`
- Each interactive component receives an `onAction` callback that translates interactions to terminal stdin

**Registry components** (`components/ChatView/registry/`):

| Component | Type Key | Purpose |
|-----------|----------|---------|
| `GuiSelect` | `Select` | Dropdown/list selection |
| `GuiConfirm` | `Confirm` | Yes/No confirmation dialog |
| `GuiTextInput` | `TextInput` | Text input field |
| `GuiAlert` | `Alert` | Alert/notification display |
| `GuiProgressBar` | `ProgressBar` | Progress indicator |

**Interaction translation** (`utils/stdinTranslation.ts`):
- `translateInteraction(interaction: TInteraction)` converts GUI interactions to terminal stdin bytes
- `ArrowSelect` → arrow key presses + Enter
- `NumberSelect` → digit + Enter
- `YesNo` → `y`/`n` + Enter
- `TextInput` → text + Enter
- `Keystroke` → raw key

Users can toggle between the generative UI and raw event rendering per chunk via "Show Raw" / "Show Interactive" buttons.

## SmartInput

**`SmartInput`** (`components/SmartInput/SmartInput.tsx`) is a context-aware input that adapts based on `useToolState(sessionId)`:

| Tool State | Mode | UI |
|-----------|------|-----|
| `idle` | IdleInput | Text field + "Start" button |
| `prompt` | PromptInput | Text field + Send icon button |
| `working` | WorkingIndicator | Disabled "Working..." field + Stop (SIGINT) button |
| `permission` | PermissionButtons | Approve (green) + Deny (red) buttons |
| `interactive` | InteractiveInput | Monospace field, keystrokes sent directly (arrow keys, escape, tab, etc.) |

## TerminalView

**`TerminalView`** (`components/TerminalView/TerminalView.tsx`) provides a full terminal emulator via `ghostty-web`:

- **Terminal config**: JetBrains Mono font, 14px, Catppuccin Mocha color scheme, 10000-line scrollback, bar cursor with blink
- **FitAddon**: auto-fits to container, observes resize, re-fits on visibility change
- **Buffer replay**: on mount, replays `getRawBuffer(sessionId)` to restore prior output
- **Input/output wiring**: `term.onData` → `sendInput()`, `term.onResize` → `sendControl(resize)`, `subscribeTerminalData()` → `term.write()`
- **Lifecycle**: full cleanup on unmount (dispose terminal, addons, unsubscribe)

## Sidebar Navigation

The sidebar provides hierarchical navigation: **Org → Project → Sandbox → Session/Thread**.

### Components (`components/Sidebar/`)

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Router-based sidebar (desktop vs mobile) |
| `DesktopSidebar` | Permanent drawer with NavTree |
| `MobileSidebar` | Temporary drawer overlay |
| `NavTree` | Groups sandboxes by project, renders NavProjectItem for each group |
| `NavProjectItem` | Expandable project node, contains NavSandboxItem children |
| `NavSandboxItem` | Sandbox node with status indicator, session/thread children |
| `NavSessionItem` | Individual session link with tool state dot |
| `NavThreadItem` | Thread link within a sandbox |
| `SBLogo` | Sidebar logo |
| `Sidebar.styles` | Shared sidebar styled components |

### Navigation Flow

1. **OrgSelector/ProjectSelector** (in Breadcrumbs) selects active org/project
2. **NavTree** groups sandboxes by their linked projects
3. Clicking a sandbox navigates to `/sandbox/:sandboxId` (session list)
4. Clicking a session navigates to `/session/:sessionId` (workspace)

## Session Tabs

Two session tab components for navigating between open sessions:

| Component | Purpose | Placement |
|-----------|---------|-----------|
| `SessionTabs` | Full tab bar with close buttons, status dots, permission badges | Desktop (Layout header) |
| `OpenSessionStrip` | Compact chip bar for horizontal scrolling | Mobile (Home page) |

Both display a status dot per session (green = working, amber = permission needed, gray = idle).

## Pages

### Session Page (`pages/Session/Session.tsx`)

The primary workspace page:
- **Header**: back button, session name, SessionCommands toolbar, chat/terminal toggle
- **Content area**: `ChatView` or `TerminalView` (toggled via `ToggleButtonGroup`)
- **SmartInput**: shown in chat mode below the content area
- **Auto-reconnect**: if navigated to a session URL with no active WebSocket, attempts reconnection via `openSession()` with the URL's sessionId
- **Disconnected state**: shows sandbox configuration card (image, runtime, workdir, SSH, idle timeout, init script) + "Start Session" button
- **Pending operations**: displays loading states for restart/recreate with appropriate messages

### SessionCommands (`components/Session/SessionCommands.tsx`)

Owner toolbar with confirmation dialogs:
- **Stop**: shuts down the sandbox pod, navigates to sandbox page
- **Restart**: restarts sandbox, preserves session history
- **Recreate**: recreates sandbox from scratch, clears history
- **New**: opens a new session (`sessionId: null`), navigates to new session
- **Share/Shared**: toggles session visibility (`public`/`private`)
- **Leave** (non-owner): closes the session locally

### Sandbox Page (`pages/Sandbox/Sandbox.tsx`)

Session list for a specific sandbox:
- **My Sessions**: own sessions with "Open" (if connected) or "Reconnect" (if disconnected) buttons
- **Shared Sessions**: other users' public sessions with "Join" button
- **New Session**: button at the bottom to create a fresh session

### Project Page (`pages/Project/Project.tsx`)

Sandbox card grid for a project:
- **SandboxCard**: displays sandbox name, runtime chip, built-in badge, running/stopped status
- Clicking a card navigates to `/sandbox/:sandboxId`
- **GitInfo**: displays git URL and branch if configured
- **EmptyState**: shown when project has no sandboxes

### Home Page (`pages/Home/Home.tsx`)

Dashboard landing:
- Contextual message: "Select an organization" or "Select a project or sandbox"
- Project and sandbox counts for the active org
- Mobile: shows `OpenSessionStrip` at the top

## State Management

**Jotai** with the same 3-layer pattern as the admin repo:

### Atoms (`src/state/`)

| File | Atoms | Purpose |
|------|-------|---------|
| `user.ts` | `userState` | Current authenticated user (`User` from `@tdsk/domain`) |
| `theme.ts` | `themeTypeState` | Light/dark theme mode |
| `app.ts` | `sidebarOpenState`, `orgIdState`, `activeProjectIdState` | UI state + active org/project IDs |
| `app.ts` | `activeOrgState`, `activeProjectState` | Derived atoms: look up `Organization`/`Project` from orgsAtom/projectsAtom by active ID |
| `sessions.ts` | `sessionEventsAtom` | `Map<sessionId, TParsedEvent[]>` — parsed shell events per session |
| `sessions.ts` | `sessionToolStateAtom` | `Map<sessionId, TToolState>` — tool state per session (idle/prompt/working/permission/interactive) |
| `sessions.ts` | `openSessionsAtom` | `Map<sessionId, TOpenSession>` — all active WebSocket sessions |
| `sessions.ts` | `activeSessionAtom` | `string | null` — currently focused session ID |
| `sessions.ts` | `sandboxesAtom` | `Sandbox[]` — all sandboxes for the active org |
| `sessions.ts` | `orgsAtom` | `Organization[]` — all orgs the user belongs to |
| `sessions.ts` | `projectsAtom` | `Project[]` — all projects for the active org |
| `sessions.ts` | `sessionUpgradesAtom` | `Map<sessionId, Map<chunkId, TJsonComponentTree>>` — generative UI upgrades |

### Accessors (`src/state/accessors.ts`)

30+ imperative `get*/set*/reset*` functions for use outside React (actions, services). Key accessors:

```typescript
// Core state
getUser / setUser / resetUser
getThemeType / setThemeType / resetThemeType
getSidebarOpen / setSidebarOpen / resetSidebarOpen
getOrgId / setOrgId / resetOrgId
getActiveProjectId / setActiveProjectId / resetActiveProjectId

// Session state
getSessionEvents / setSessionEvents / appendSessionEvent / clearSessionEvents
getToolState / setToolState
getOpenSessions / setOpenSession / removeOpenSession
getActiveSession / setActiveSession
getSessionsForSandbox(sandboxId)

// Entity state
getSandboxes / setSandboxes
getOrgs / setOrgs
getProjects / setProjects

// Generative UI
setSessionUpgrade / getSessionUpgrades
```

### Selectors (`src/state/selectors.ts`)

Hook-based access for React components:

```typescript
useUser()                          // [User, setter, resetter]
useThemeType()                     // [EThemeType, setter, resetter]
useSidebarOpen()                   // [boolean, setter, resetter]
useOrgId()                         // string
useSessionEvents(sessionId)        // TParsedEvent[]
useToolState(sessionId)            // TToolState
useOpenSessions()                  // Map<string, TOpenSession>
useActiveSession()                 // string | null
useSandboxes()                     // Sandbox[]
useOrgs()                          // Organization[]
useProjects()                      // Project[]
useActiveOrgId()                   // [string, setter, resetter]
useActiveOrg()                     // Organization | undefined
useActiveProjectId()               // [string, setter, resetter]
useActiveProject()                 // Project | undefined
useSessionsForSandbox(sandboxId)   // TOpenSession[]
useSandboxHasSession(sandboxId)    // boolean
useSandboxToolState(sandboxId)     // TToolState (aggregated across sessions)
useSessionUpgrades(sessionId)      // Map<string, TJsonComponentTree>
```

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

8 co-located test files:
- `src/actions/auth/local/signout.test.ts`
- `src/components/Login/Login.test.tsx`
- `src/components/Login/EmailLoginForm.test.tsx`
- `src/components/ChatView/GenerativeUIRenderer.test.tsx`
- `src/pages/Login/Login.test.tsx`
- `src/services/api.test.ts`
- `src/utils/api/genFormData.test.ts`
- `src/utils/stdinTranslation.test.ts`

Test setup: `scripts/setupTests.ts` mocks Neon Auth client, API service, and MUI. Environment: jsdom.

## Dependencies

### Key Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ghostty-web` | 0.4.0 | Terminal emulator (Terminal, FitAddon) |
| `@mariozechner/pi-web-ui` | 0.55.3 | PI web UI components |
| `mermaid` | 11.12.3 | Diagram rendering |
| `sonner` | 2.0.7 | Toast notifications |
| `react-markdown` | 10.1.0 | Markdown rendering |
| `remark-gfm` | 4.0.1 | GitHub Flavored Markdown support |
| `jotai` | 2.16.1 | Atomic state management |
| `react-router` | 7.1.1 | Client-side routing |
| `@tanstack/react-query` | 5.90.16 | Server state caching |
| `@neondatabase/neon-js` | 0.1.0-beta.21 | Neon Auth client |

## Integration Points

| Consumer | Import | Key Usage |
|----------|--------|-----------|
| **@tdsk/components** | Shared UI | `makeTheme`, `Loading`, `Text`, `LoadingButton`, `Storage`, `TSIcon`, `useEffectOnce`, `MemoChildren`, `useTheme`, `overlayScrollBody`, `colors`, `cmx`, `dims` |
| **@tdsk/domain** | Domain models + types | `User`, `Organization`, `Project`, `Sandbox`, `Thread`, `Message`, `TParsedEvent`, `TToolState`, `TJsonComponentTree`, `TJsonComponentNode`, `TInteraction`, `AllowedHtmlElements`, `ESandboxSessionVisibility`, `TSandboxConnectResponse`, `TSandboxSession`, `deriveToolState` |

### Path Aliases

```typescript
import { Something } from '@TTH/components/ChatView'    // → ./src/components/ChatView
import { User } from '@TDM/models'                       // → ../domain/src/models
import { makeTheme } from '@TSC/theme'                   // → ../components/src/theme
```

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
// actions/sessions/sendInput.ts
export const sendInput = (sessionId: string, text: string): boolean => {
  const ws = getConnection(sessionId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  const encoder = new TextEncoder()
  ws.send(encoder.encode(text))
  return true
}
```

### 3. Token Refresh

`TokenRefreshManager` wraps `ApiService` to handle JWT lifecycle:
- Schedules refresh before expiry (proactive, not reactive)
- On 401: refresh + retry once (prevents unnecessary logouts)
- Cleanup on signout

### 4. Session Persistence

Browser `sessionStorage` tracks active sessions per sandbox:
- `storeSession(sandboxId, sessionId)` on connect
- `removeStoredSession(sandboxId, sessionId)` on close
- `getStoredSessions(sandboxId)` for auto-reconnect resolution
- `findSandboxForSession(sessionId)` for reverse lookup (used by Session page)

### 5. Event-Driven State Updates

WebSocket messages drive all state transitions:
- Parsed events → `appendSessionEvent()` → `useSessionEvents()` re-renders ChatView
- Tool state derived via `deriveToolState(event)` → `setToolState()` → `useToolState()` switches SmartInput mode
- Generative UI trees → `setSessionUpgrade()` → `useSessionUpgrades()` renders interactive components
- Binary data → `rawBuffers` + `terminalWriters` → TerminalView writes

## Development Notes

### Adding a New Page

1. Create page component with default export in `src/pages/<Name>/`
2. Add lazy route in `src/routes/Routes.tsx` inside Layout children
3. For pages that need route params, export `Component` for React Router `lazy()` pattern

### Adding State

Follow the admin repo's 3-layer pattern:
1. Create atom in `src/state/<entity>.ts` with `atomWithReset`
2. Add imperative accessors in `src/state/accessors.ts`
3. Add hook-based selector in `src/state/selectors.ts`

### Adding an API Service

Extend `BaseApi` from `@TTH/services/api`:
```typescript
class NewApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => ['new'] as const,
    list: (...scope: string[]) => [...this.cache.all(), 'list', ...scope] as const,
  }

  async list(orgId: string): Promise<TApiRes<NewModel[]>> {
    const resp = await this.api.get<NewModel[]>({
      path: `/orgs/${orgId}/new`,
      queryKey: this.cache.list(orgId),
    })
    resp.error && (await this._onError(resp.error, 'Failed to load items'))
    return { ...resp, data: resp?.data?.map?.((n) => new NewModel(n)) || [] }
  }
}
export const newApi = new NewApi()
```

### Adding a Generative UI Component

1. Create component in `src/components/ChatView/registry/Gui<Name>.tsx`
2. Component receives `onAction: (interaction: TInteraction) => void` + any custom props
3. Register in `src/components/ChatView/registry/index.ts` with a type key
4. If the interaction needs a new `TInteraction` variant, add it in `@tdsk/domain` and update `stdinTranslation.ts`
