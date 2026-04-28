# Threads - Developer Internals

## Thread Model

### Database Schema

Source: `repos/database/src/schemas/threads.ts`

The `threads` table uses the shared `base` fields (`id`, `createdAt`, `updatedAt`) plus:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `varchar(10)` | PK, nanoid | Unique thread identifier |
| `name` | `text` | nullable | Display name for the thread |
| `meta` | `jsonb` | nullable | Arbitrary metadata |
| `public` | `boolean` | default `false` | Whether the thread is publicly accessible |
| `parent_thread_id` | `varchar(10)` | nullable, indexed | Parent thread ID for branched conversations |
| `branch_message_id` | `varchar(10)` | nullable | The message ID where the branch diverged |
| `provider_id` | `varchar(10)` | FK -> `providers.id`, ON DELETE SET NULL | LLM provider used |
| `agent_id` | `varchar(10)` | FK -> `agents.id`, ON DELETE SET NULL, indexed | Agent this thread belongs to |
| `org_id` | `varchar(10)` | FK -> `orgs.id`, ON DELETE CASCADE, indexed | Owning organization |
| `project_id` | `varchar(10)` | FK -> `projects.id`, ON DELETE CASCADE, indexed | Associated project |
| `user_id` | `uuid` | FK -> `users.id`, ON DELETE CASCADE, NOT NULL, indexed | Thread owner |
| `createdAt` | `timestamp` | auto | Creation timestamp |
| `updatedAt` | `timestamp` | auto | Last update timestamp |

### Domain Model

Source: `repos/domain/src/models/thread.ts`

```typescript
class Thread extends Base {
  name?: string
  userId: string
  orgId?: string
  agentId?: string
  projectId?: string
  providerId?: string
  public: boolean = false
  parentThreadId?: string
  branchMessageId?: string
  meta?: Record<string, any>
}
```

### Relationships

Defined in `repos/database/src/schemas/threads.ts` via Drizzle relations:

- **Thread -> Messages**: one-to-many. A thread contains many messages.
- **Thread -> User**: many-to-one. Each thread belongs to one user.
- **Thread -> Agent**: many-to-one. Each thread belongs to one agent.
- **Thread -> Organization**: many-to-one. Each thread belongs to one org.
- **Thread -> Project**: many-to-one. Optional project association.
- **Thread -> Provider**: many-to-one. Optional LLM provider association.
- **Thread -> Parent Thread**: self-referential many-to-one (`threadBranches` relation). A branched thread points to its parent.
- **Thread -> Branches**: self-referential one-to-many. A thread can have many child branches.
- **Thread -> Branch Message**: many-to-one to `messages`. The specific message where a branch diverged.

## Message Types

### Database Schema

Source: `repos/database/src/schemas/messages.ts`

The `messages` table uses the shared `base` fields plus:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `varchar(10)` | PK, nanoid | Unique message identifier |
| `type` | `text` | NOT NULL | Message type (see below) |
| `content` | `jsonb` | NOT NULL | Array of structured content blocks |
| `meta` | `jsonb` | nullable | Arbitrary metadata |
| `thread_id` | `varchar(10)` | FK -> `threads.id`, ON DELETE CASCADE, NOT NULL, indexed | Parent thread |
| `org_id` | `varchar(10)` | FK -> `orgs.id`, ON DELETE CASCADE, indexed | Owning organization |
| `project_id` | `varchar(10)` | FK -> `projects.id`, ON DELETE CASCADE, indexed | Associated project |
| `createdAt` | `timestamp` | auto | Creation timestamp |
| `updatedAt` | `timestamp` | auto | Last update timestamp |

Messages also have a one-to-many relationship with `assets` (files attached to messages).

### Domain Model

Source: `repos/domain/src/models/message.ts`

```typescript
class Message extends Base {
  orgId?: string
  type: TMsgType
  threadId: string
  projectId?: string
  content: TMessageContent[]
  meta?: Record<string, any>
}
```

## Thread Branching

### Schema Support

The branching relationship is encoded in two thread columns:
- `parent_thread_id` -- points to the thread this branch was forked from
- `branch_message_id` -- the specific message in the parent thread where the fork occurred

The Drizzle relations define this as a self-referential relationship named `threadBranches`, enabling queries like:
- **Get branches**: list all threads where `parentThreadId` equals a given thread ID
- **Get parent**: follow `parentThreadId` to the original thread

Source: `repos/database/src/services/thread.ts` (`branchThread` method)

The branch operation runs inside a database transaction for atomicity. It:
1. Retrieves the original thread and all its messages in chronological order.
2. Locates the branch message by ID and determines its position in the message sequence.
3. Creates a new thread with `parentThreadId`, `branchMessageId`, and metadata copied from the original.
4. Copies all messages from the start up to and including the branch message into the new thread.

## Threads Web App

Source: `repos/threads/`

The `threads` repo (`@tdsk/threads`) is a standalone user-facing SPA for interacting with the Threaded Stack platform. It is separate from the admin dashboard (`repos/admin/`) and is intended for end-users to log in, select an organization, and interact with agents and their conversations.

### Tech Stack

- **Vite** -- Build tool and dev server
- **React 18** with **TypeScript**
- **MUI 6** (Material UI) -- Component library and theming
- **Jotai** -- Atom-based state management
- **React Router 7** -- Client-side routing
- **Neon Auth** -- Authentication via `@neondatabase/neon-js`
- **TanStack Query** -- Server state caching (via `@tanstack/react-query`)
- **pi-web-ui** -- `@mariozechner/pi-web-ui` for AI agent UI components

### Architecture

The app follows the same patterns as the admin SPA:

- **Entry point**: `repos/threads/src/index.tsx` -- Renders the React app wrapped in Jotai `Provider`, `AuthProvider`, and MUI `ThemeProvider`.
- **Auth**: `repos/threads/src/contexts/AuthProvider.tsx` -- Handles Neon Auth session lifecycle, JWT token refresh, and sign-out.
- **Routing**: `repos/threads/src/routes/Routes.tsx` -- Uses `createBrowserRouter` with lazy-loaded pages.
- **API service**: `repos/threads/src/services/api.ts` -- `ApiService` class with JWT bearer token management, automatic 401 retry with token refresh, and TanStack Query integration for GET requests.
- **State**: `repos/threads/src/state/` -- Jotai atoms for user, theme, sidebar, and app state. Accessors in `repos/threads/src/state/accessors.ts`.

### Current Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | `Home` | Welcome landing page |
| `/settings` | `Settings` | User preferences (dark mode, notification toggles) |
| `/login` | `Login` | Authentication page (social sign-in via Neon Auth) |
| `*` | Redirect | Catch-all redirects to `/` |

### Current Components

- **Layout** (`repos/threads/src/pages/Layout/Layout.tsx`) -- Authenticated shell with sidebar, mobile toggle, and `<Outlet>` for nested routes. Uses Neon Auth's `<SignedIn>` and `<RedirectToSignIn>`.
- **Sidebar** (`repos/threads/src/components/Sidebar/`) -- Responsive sidebar with desktop/mobile variants and a project selector.
- **Login** (`repos/threads/src/components/Login/`) -- Social sign-in buttons (GitHub, GitLab, Google, Vercel) and email login form.
- **Settings** (`repos/threads/src/pages/Settings/Settings.tsx`) -- Appearance and notification preferences persisted to local storage.

### Current State

The threads web app has its foundational infrastructure in place -- authentication, routing, theming, API service layer, and layout scaffolding. The conversation UI (thread list, message display, message input, branching controls) is not yet implemented. The `Home` page currently shows a welcome card placeholder.

### Shared Dependencies

- `@tdsk/domain` -- Models, types, enums (Thread, Message, EMsgType, EContentType)
- `@tdsk/components` -- Shared React components and hooks
