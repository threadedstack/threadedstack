---
name: "tdsk-threads"
description: "Knowledge base for the user-facing threads SPA — sandbox session management and interaction"
tags: ["react", "vite", "mui", "jotai", "threads", "auth", "neon", "spa", "sandbox", "session", "websocket", "terminal", "ghostty"]
---
# Threads Repo Skill

## Overview

The **Threads** repo (`repos/threads`, `@tdsk/threads`) is the user-facing SPA for org members to interact with sandbox sessions. Key facts:

- **Type**: User-facing sandbox session SPA (distinct from admin dashboard), Vite 5 + Bun, port 5887
- **Architecture**: Mirrors admin repo -- Jotai 3-layer state, ApiService + TanStack Query, Neon Auth, lazy-loaded routes, MUI 6 theming via shared `makeTheme()`
- **Path Aliases**: `@TTH/*` prefix via `alias-hq`
- **Features**: Dual chat/terminal views, real-time WebSocket streaming, generative UI rendering, hierarchical org/project/sandbox/session navigation
- **Terminal**: Ghostty-based emulator via `ghostty-web`

## Directory Structure

```
repos/threads/
├── configs/                # vite, frontend config, biome
├── scripts/                # setupTests, registerPaths, testUtils
├── public/                 # index.html
├── src/
│   ├── index.tsx           # Bootstrap: Jotai Provider → AuthProvider → App
│   ├── App.tsx             # ThemeProvider → GlobalStyles → RouterProvider
│   ├── actions/            # init, auth/, orgs/, projects/, sandboxes/, sessions/, threads/
│   ├── components/
│   │   ├── Breadcrumbs/    # Breadcrumbs, OrgSelector, ProjectSelector
│   │   ├── ChatView/       # ChatView, AiBubble, UserBubble, ToolCallCard, PermissionCard, DiffCard, ErrorCard, ThinkingIndicator, GenerativeUIRenderer
│   │   │   └── registry/   # GuiSelect, GuiConfirm, GuiTextInput, GuiAlert, GuiProgressBar
│   │   ├── Login/          # Login, EmailLoginForm, OAuth buttons
│   │   ├── Session/        # SessionCommands (stop/restart/recreate/share/new/leave)
│   │   ├── SessionTabs/    # SessionTabs (desktop tab bar) + OpenSessionStrip (mobile chips)
│   │   ├── Sidebar/        # Sidebar, NavTree, NavProjectItem, NavSandboxItem, NavSessionItem, NavThreadItem
│   │   ├── SmartInput/     # Context-aware input (5 modes)
│   │   ├── TerminalView/   # ghostty-web terminal emulator
│   │   └── Version/        # Version display
│   ├── constants/          # envs, nav, sessions, storage, query defaults, layout values
│   ├── contexts/           # AuthProvider (Neon Auth)
│   ├── hooks/              # theme hooks
│   ├── pages/              # Home, Login, Project, Sandbox, Session, Settings, Layout, Page
│   ├── routes/             # Routes.tsx (React Router v7, lazy loading)
│   ├── services/           # api, auth, nav, orgsApi, projectsApi, sandboxApi, threadsApi, query, storage, tokenRefresh
│   ├── state/              # atoms (user, theme, app, sessions), accessors, selectors
│   ├── theme/              # GlobalStyles
│   ├── types/              # api, auth, query, routes, sessions, theme types
│   └── utils/              # api helpers, errors, sessionStorage, stdinTranslation
```

## Routing

React Router v7 with lazy loading and Suspense:

```
/ (Layout: Sidebar + SessionTabs + Outlet)
├── /                         → Home (dashboard)
├── /settings                 → Settings
├── /project/:projectId       → Project (sandbox card grid)
├── /sandbox/:sandboxId       → Sandbox (session list: own + shared)
└── /session/:sessionId       → Session (chat/terminal workspace)

/auth/:pathname → Login (OAuth + email/password)
```

## Services

| Service | Purpose |
|---------|---------|
| `api.ts` | `ApiService` + `BaseApi`: fetch wrapper, Bearer token via Neon Auth, TanStack Query caching. URL: `TDSK_CADDY_PX_HOST` > `TDSK_PX_URL` > `TDSK_PX_HOST:TDSK_PX_PORT` |
| `auth.ts` | Neon Auth client wrapper: `signin(provider)`, `signout()`, `session()` |
| `orgsApi.ts` | `list()` → `Organization[]` |
| `projectsApi.ts` | `list(orgId)` → `Project[]` |
| `sandboxApi.ts` | `list`, `connect` → `TSandboxConnectResponse`, `sessions` → `TSandboxSession[]`, `stop` |
| `threadsApi.ts` | `listBySandbox` → `Thread[]`, `messages` → `Message[]` |
| `tokenRefresh.ts` | Proactive JWT refresh before expiry, 401 retry once |
| `query.ts` | TanStack `QueryClient` wrapper (staleTime 5min, gcTime 30min) |
| `storage.ts` | Typed localStorage wrapper with JSON serialization |

## Session Management

The core of the SPA. `openSession()` establishes a WebSocket connection to a sandbox shell by first calling `sandboxApi.connect()` to start the pod and get a `shellToken`, then opening a WebSocket to `/_/sandboxes/:sandboxId/shell?token=...&cols=80&rows=24`.

Session intent resolution: `null` = new session, `string` = specific session ID, `undefined` = auto-resolve from sessionStorage. The WebSocket handles lifecycle messages (`connected`, `joined`, `reconnected`, `visibility`, `user-joined`, `user-left`, `generative-ui`, parsed events, `error`) and manages a raw terminal buffer (capped at 1MB) for terminal replay.

Module-scoped state (not Jotai): `connections` (Map of WebSocket instances), `rawBuffers` (terminal output ring buffer per session), `terminalWriters` (subscriber callbacks for terminal data via `subscribeTerminalData()`).

### Session Actions

| Action | Purpose |
|--------|---------|
| `openSession(opts)` | Connect WebSocket, returns `Promise<sessionId>` |
| `closeSession(sessionId, opts?)` | Close WebSocket, remove from state |
| `sendInput(sessionId, text)` | Send binary text to WebSocket |
| `sendControl(sessionId, msg)` | Send JSON control (resize, signal, permission-response, visibility) |
| `approvePermission` / `denyPermission` | Send permission response (`y`/`n`) |
| `getRawBuffer` / `getConnection` | Access session resources |
| `subscribeTerminalData(sessionId, cb)` | Subscribe to decoded terminal data, returns unsubscribe |
| `fetchSandboxSessions` | Fetch sessions from backend API |
| `classifySessions` | Categorizes sessions as `connected`, `disconnected`, or `shared` |

## ChatView System

### Event Routing

The `ChatView` renders `TParsedEvent` objects from `useSessionEvents(sessionId)`:

| Event Type | Component | Description |
|-----------|-----------|-------------|
| `input` | `UserBubble` | User text, distinguishes own vs other user |
| `text` | `AiBubble` | AI assistant response |
| `tool-call` | `ToolCallCard` | Tool invocation with name, args, result |
| `permission` | `PermissionCard` | Approve/deny buttons |
| `diff` | `DiffCard` | File diff display |
| `error` | `ErrorCard` | Error message |
| `activity` | `ThinkingIndicator` | Working animation |
| `unknown` | `UnknownBlock` | Fallback |
| `prompt-ready` | (null) | Suppressed |

### Generative UI

When the backend sends a `generative-ui` WebSocket message with `chunkId` and `tree`, the events for that chunk are replaced with interactive components. `GenerativeUIRenderer` recursively renders a `TJsonComponentTree` using registered components or allowed HTML elements, with `onAction` callbacks that translate interactions to terminal stdin.

| Component | Type Key | Purpose |
|-----------|----------|---------|
| `GuiSelect` | `Select` | Dropdown/list selection |
| `GuiConfirm` | `Confirm` | Yes/No confirmation |
| `GuiTextInput` | `TextInput` | Text input field |
| `GuiAlert` | `Alert` | Alert display |
| `GuiProgressBar` | `ProgressBar` | Progress indicator |

`translateInteraction()` in `utils/stdinTranslation.ts` converts GUI interactions to stdin bytes: ArrowSelect (arrow keys + Enter), NumberSelect (digit + Enter), YesNo (`y`/`n` + Enter), TextInput (text + Enter), Keystroke (raw key). Users can toggle between generative UI and raw events per chunk.

## SmartInput

Context-aware input adapting based on `useToolState(sessionId)`:

| Tool State | Mode | UI |
|-----------|------|-----|
| `idle` | IdleInput | Text field + "Start" button |
| `prompt` | PromptInput | Text field + Send icon |
| `working` | WorkingIndicator | Disabled field + Stop (SIGINT) button |
| `permission` | PermissionButtons | Approve (green) + Deny (red) |
| `interactive` | InteractiveInput | Monospace, keystrokes sent directly |

## TerminalView

Full terminal emulator via `ghostty-web` with JetBrains Mono font, Catppuccin Mocha theme, 10000-line scrollback. Uses FitAddon for auto-resize. On mount, replays `getRawBuffer(sessionId)` to restore output. Input/output wired: `term.onData` → `sendInput()`, `term.onResize` → `sendControl(resize)`, `subscribeTerminalData()` → `term.write()`.

## Sidebar Navigation

Hierarchical navigation: **Org → Project → Sandbox → Session/Thread**. Key components: `Sidebar` (responsive desktop/mobile), `NavTree` (groups sandboxes by project), `NavProjectItem`, `NavSandboxItem` (with status indicator), `NavSessionItem` (with tool state dot), `NavThreadItem`.

## Session Tabs

`SessionTabs` (desktop tab bar with close buttons, status dots, permission badges) and `OpenSessionStrip` (mobile compact chip bar). Status dot colors: green = working, amber = permission needed, gray = idle.

## Pages

- **Session**: Primary workspace -- chat/terminal toggle, SessionCommands toolbar, SmartInput, auto-reconnect on navigation, disconnected state shows sandbox config + "Start Session" button
- **Sandbox**: Session list (own + shared) with reconnect/join/new actions
- **Project**: Sandbox card grid with runtime chips, status indicators, git info
- **Home**: Dashboard with org/project/sandbox summary, mobile OpenSessionStrip
- **SessionCommands**: Stop, Restart, Recreate, New, Share/Shared toggle, Leave (non-owner)

## State Management

Jotai with the same 3-layer pattern as admin: atoms → accessors → selectors.

**Atoms** (`src/state/`): `userState`, `themeTypeState`, `sidebarOpenState`, `orgIdState`, `activeProjectIdState` (with derived `activeOrgState`/`activeProjectState`), `sessionEventsAtom` (Map of parsed events per session), `sessionToolStateAtom` (Map of tool state per session), `openSessionsAtom`, `activeSessionAtom`, `sandboxesAtom`, `orgsAtom`, `projectsAtom`, `sessionUpgradesAtom` (generative UI trees).

**Accessors** (`src/state/accessors.ts`): 30+ imperative `get*/set*/reset*` functions for use outside React. Key: `appendSessionEvent`, `setToolState`, `setOpenSession`, `removeOpenSession`, `setActiveSession`, `setSessionUpgrade`.

**Selectors** (`src/state/selectors.ts`): Hook-based access for components. Key: `useSessionEvents(sessionId)`, `useToolState(sessionId)`, `useOpenSessions()`, `useActiveSession()`, `useSandboxes()`, `useSessionsForSandbox(sandboxId)`, `useSandboxToolState(sandboxId)`, `useSessionUpgrades(sessionId)`.

## Key Patterns

**Event-Driven State**: WebSocket messages drive all state transitions. Parsed events → `appendSessionEvent()` → ChatView re-renders. Tool state derived via `deriveToolState(event)` → SmartInput mode switches. Generative UI trees → `setSessionUpgrade()` → interactive component rendering. Binary data flows through `rawBuffers` + `terminalWriters` → TerminalView.

**Session Persistence**: Browser `sessionStorage` tracks active sessions per sandbox: `storeSession`, `removeStoredSession`, `getStoredSessions`, `findSandboxForSession` (reverse lookup for Session page).

**Token Refresh**: `TokenRefreshManager` schedules proactive refresh before JWT expiry. On 401: refresh + retry once.

## Integration Points

- **@tdsk/components**: `makeTheme`, `Loading`, `Text`, `LoadingButton`, `Storage`, `TSIcon`, `useEffectOnce`, `MemoChildren`, `useTheme`, `colors`, `cmx`, `dims`
- **@tdsk/domain**: `User`, `Organization`, `Project`, `Sandbox`, `Thread`, `Message`, `TParsedEvent`, `TToolState`, `TJsonComponentTree`, `TInteraction`, `AllowedHtmlElements`, `ESandboxSessionVisibility`, `TSandboxConnectResponse`, `TSandboxSession`, `deriveToolState`
- **Path Aliases**: `@TTH/*` (threads), `@TDM/*` (domain), `@TSC/*` (components)

## Commands

```bash
pnpm start          # Dev server (port 5887)
pnpm build          # Production build
pnpm test           # Vitest tests
pnpm types          # TypeScript type checking
```
