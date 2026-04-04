# Threads App

## What is the Threads App

The Threads App is a standalone, browser-based interface designed for end users to interact with AI agents through conversations. It is separate from the Admin Dashboard and serves a different audience and purpose.

While the Admin Dashboard (`repos/admin/`) is built for developers and administrators who configure organizations, agents, tools, secrets, and billing, the Threads App (`repos/threads/`) is built for the people who *use* those agents. It provides a focused, conversation-first experience where users can start threads, send messages, and receive AI-generated responses without needing to understand or manage the underlying infrastructure.

The Threads App is packaged as `@tdsk/threads` and runs as its own Vite-powered single-page application on port 5887.

## Current State

The Threads App has its foundational infrastructure built and functional. The conversation UI -- thread listing, message display, message input, and branching controls -- is not yet implemented.

### What is Built

- **Authentication** -- Full sign-in flow via Neon Auth, supporting social login providers (GitHub, Google, Vercel) and email/password authentication with forgot-password support. JWT tokens are managed automatically with proactive refresh before expiry and retry-on-401 logic.
- **Routing** -- Client-side routing via React Router 7 with lazy-loaded pages and a catch-all redirect.
- **Layout** -- Authenticated shell with responsive sidebar (desktop and mobile variants), mobile toggle button, and outlet for nested page content.
- **State Management** -- Jotai atom-based state for user data, theme preference, and sidebar visibility.
- **API Service Layer** -- `ApiService` class with bearer token management, TanStack Query integration for cached GET requests, and automatic 401 retry with token refresh.
- **Settings Page** -- User preferences for dark mode, email notifications, agent run notifications, and security alerts, persisted to local storage.
- **Theming** -- MUI 6 theming with dark/light mode toggle.
- **Page Wrapper** -- `Page` component that runs initialization logic on mount and provides consistent page structure.

### In Development

The following features are planned but not yet implemented:

- **Thread Listing** -- Browsing and searching existing conversation threads.
- **Message Display** -- Rendering message history within a thread, including support for the full content type system (text, images, files, tool use/results, artifacts, thinking blocks).
- **Message Input** -- Composing and sending new messages to an agent.
- **Agent Selection** -- Choosing which agent to interact with.
- **Thread Branching UI** -- Forking a conversation at any message point to explore alternative paths.
- **File Upload** -- Attaching files to messages (the backend supports this up to 25 MB).
- **Sidebar Navigation** -- The sidebar shell exists but currently renders placeholder text ("Threads Sidebar") with no navigation items.
- **Project Selector** -- A `SBProjectSelector` component exists in the sidebar but is not yet wired into the navigation flow with data.

## Access

### URL

In local development, the Threads App runs at:

```
http://localhost:5887
```

Start the dev server from the repo directory:

```bash
cd repos/threads && pnpm start
```

### Authentication Flow

1. When an unauthenticated user visits any route, the `Layout` component's `<RedirectToSignIn>` sends them to the login page.
2. The login page presents social login buttons (configurable via the `TDSK_AUTH_PROVIDERS` environment variable) and optionally an email/password form.
3. After successful authentication through Neon Auth, the user receives a JWT token.
4. The `AuthProvider` stores the session and starts the `TokenRefreshManager`, which proactively refreshes the JWT before it expires (2 minutes before expiry by default) and also refreshes when the browser tab regains visibility.
5. All API requests include the JWT as a `Bearer` token in the `Authorization` header.
6. The auth proxy validates the JWT using JWKS from Neon Auth before forwarding requests to the backend.
7. If a request returns 401, the `ApiService` automatically attempts a token refresh and retries the request once.

### Supported Login Providers

The available login providers are configured through the `TDSK_AUTH_PROVIDERS` environment variable (comma-separated). The app includes UI buttons for:

- GitHub
- Google
- Vercel
- Email/password (shown when `email` is included in `TDSK_AUTH_PROVIDERS`)

## Features

### Home Page

The home page currently displays a welcome card. This page will be the primary landing point after login, and is expected to surface thread listings and agent selection once those features are built.

### Settings

The settings page (`/settings`) provides user-level preferences:

- **Appearance** -- Toggle between dark and light themes. The preference persists across sessions via local storage.
- **Notifications** -- Toggle switches for email notifications, agent run notifications, and security alerts. These preferences are stored in local storage.

### Sidebar

The app includes a responsive sidebar that adapts to screen size:

- **Desktop** -- A persistent sidebar panel on the left side of the layout.
- **Mobile** -- A drawer-based sidebar toggled by a floating action button in the bottom-left corner.

The sidebar currently renders placeholder content. When fully built, it will provide navigation to threads, agents, and settings.

### Thread Conversations (In Development)

The backend API fully supports thread operations. Once the frontend is connected, users will be able to:

- **Create threads** under a specific agent to start a new conversation.
- **List threads** to browse previous conversations, with pagination support.
- **View messages** within a thread, rendered by content type (text, images, tool calls, artifacts, and more).
- **Send messages** to continue a conversation with the AI agent.
- **Branch threads** at any message to fork a conversation and explore different directions. Branching copies all messages up to the branch point into a new thread while preserving the original.
- **Upload files** to a thread (up to 25 MB per file) for the agent to process.
- **Delete threads and messages** to manage conversation history.

Each thread is scoped to an agent within an organization, and users can only see their own threads.

## Relationship to Admin UI

The Threads App and the Admin Dashboard are distinct applications serving different audiences within the same platform.

| Aspect | Admin Dashboard (`repos/admin/`) | Threads App (`repos/threads/`) |
|--------|----------------------------------|-------------------------------|
| **Audience** | Developers, administrators, org owners | End users, team members, non-technical users |
| **Purpose** | Configure and manage platform resources | Interact with AI agents through conversations |
| **Key Activities** | Create orgs, manage agents, configure tools and secrets, set up endpoints, manage billing and quotas, invite users | Start conversations, send messages, browse thread history, branch conversations |
| **Port** | 5887 (shared in local dev) | 5887 |
| **Package** | `@tdsk/admin` | `@tdsk/threads` |
| **State** | Jotai with React Router loaders | Jotai with TanStack Query |

The two apps share a common authentication system (Neon Auth) and communicate with the same backend API. An administrator uses the Admin Dashboard to create an organization, set up agents with tools and provider keys, and invite team members. Those team members then use the Threads App to have conversations with the configured agents -- without needing access to the underlying configuration.

### Shared Dependencies

Both apps depend on:

- `@tdsk/domain` -- Shared model classes, types, and utilities
- `@tdsk/components` -- Shared React component library and hooks
- `@neondatabase/neon-js` -- Authentication client
- MUI 6 -- Component library and theming
- Jotai -- State management
- React Router 7 -- Client-side routing

### Tech Stack

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
