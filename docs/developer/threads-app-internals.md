# Threads App Internals

Technical reference for the Threads App (`repos/threads/`, package `@tdsk/threads`). Runs on port **5887** as a Vite-powered single-page application.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build Tool | Vite |
| UI Framework | React 18, TypeScript |
| Component Library | MUI 6 (Material UI) |
| State Management | Jotai (atom-based) |
| Server State | TanStack Query |
| Routing | React Router 7 |
| Authentication | Neon Auth (`@neondatabase/neon-js`) |
| AI UI Components | `@mariozechner/pi-web-ui` |
| Markdown | `react-markdown` with `remark-gfm` |
| Diagrams | Mermaid |
| Notifications | Sonner (toast) |
| Analytics | PostHog |

## Architecture

- **Entry point**: `repos/threads/src/main.tsx` bootstraps the React app.
- **Auth**: `AuthProvider.tsx` wraps the app with Neon Auth's `NeonAuthUIProvider`. On login, it stores the session and starts `TokenRefreshManager`, which proactively refreshes JWTs 2 minutes before expiry and on tab visibility change.
- **Router**: `createBrowserRouter` (React Router 7) with lazy-loaded pages and a catch-all redirect.
- **API layer**: `ApiService` class with bearer token management, TanStack Query integration for cached GETs, and automatic 401 retry with token refresh.
- **Login providers**: Configured via the `TDSK_AUTH_PROVIDERS` environment variable (comma-separated). Supported values: `github`, `google`, `vercel`, `email`.

## Current State

### What is Built

- **Authentication** -- Full sign-in flow via Neon Auth with social login (GitHub, Google, Vercel) and email/password with forgot-password support. JWT tokens are managed automatically with proactive refresh and retry-on-401 logic.
- **Routing** -- Client-side routing via React Router 7 with lazy-loaded pages and catch-all redirect.
- **Layout** -- Authenticated shell with responsive sidebar (desktop and mobile variants), mobile toggle button, and outlet for nested page content.
- **State Management** -- Jotai atom-based state for user data, theme preference, and sidebar visibility.
- **API Service Layer** -- `ApiService` class with bearer token management, TanStack Query integration for cached GET requests, and automatic 401 retry with token refresh.
- **Settings Page** -- User preferences for dark mode, email notifications, agent run notifications, and security alerts, persisted to local storage.
- **Theming** -- MUI 6 theming with dark/light mode toggle.
- **Page Wrapper** -- `Page` component that runs initialization logic on mount and provides consistent page structure.

### In Development

- **Thread Listing** -- Browsing and searching existing conversation threads.
- **Message Display** -- Rendering message history within a thread, including support for the full content type system (text, images, files, tool use/results, artifacts, thinking blocks).
- **Message Input** -- Composing and sending new messages to an agent.
- **Agent Selection** -- Choosing which agent to interact with.
- **Thread Branching UI** -- Forking a conversation at any message point to explore alternative paths.
- **File Upload** -- Attaching files to messages (the backend supports this up to 25 MB).
- **Sidebar Navigation** -- The sidebar shell exists but currently renders placeholder text ("Threads Sidebar") with no navigation items.
- **Project Selector** -- A `SBProjectSelector` component exists in the sidebar but is not yet wired into the navigation flow with data.

## Current Routes

Routes are defined in the router configuration and use lazy-loaded page components.

## Current Components

Key components live under `repos/threads/src/`:

- `AuthProvider.tsx` -- Neon Auth wrapper, session management, `TokenRefreshManager`
- `Layout.tsx` -- Authenticated shell with `<RedirectToSignIn>`, responsive sidebar, outlet
- `Page.tsx` -- Page wrapper with initialization logic
- Settings page components under `pages/settings/`
- Sidebar components (desktop and mobile variants)

## Relationship to Admin UI (Technical Comparison)

| Aspect | Admin Dashboard | Threads App |
|--------|----------------|-------------|
| Port | 5887 | 5887 |
| Package | `@tdsk/admin` | `@tdsk/threads` |
| State Management | Jotai with React Router loaders | Jotai with TanStack Query |

## Shared Dependencies

Both apps depend on:

- `@tdsk/domain` -- Shared model classes, types, and utilities
- `@tdsk/components` -- Shared React component library and hooks
- `@neondatabase/neon-js` -- Authentication client
- MUI 6 -- Component library and theming
- Jotai -- State management
- React Router 7 -- Client-side routing
