# Threads

## What are Threads

Threads are persistent conversation containers in Threaded Stack. Each thread holds an ordered sequence of messages that represent a single conversational session between a user and an AI agent.

Threads are scoped to an **agent** within an **organization**. A user creates a thread under a specific agent, and all messages within that thread belong to that agent context. Threads can optionally be associated with a **project** and a **provider** (the LLM backend used for generation).

Key characteristics:

- **User-owned**: Every thread has a `userId` owner. Only the owner can read, update, or delete their threads and messages.
- **Agent-scoped**: Threads are always created under an agent (`agentId`). The backend validates that a thread belongs to the specified agent on every request.
- **Organization-scoped**: Threads belong to an org (`orgId`), which controls quota tracking and permission checks.
- **Branchable**: Threads support parent/child relationships for conversation branching (see [Thread Branching](#thread-branching)).
- **Quota-tracked**: Creating threads and messages increments the org's billing-period usage counters for `threads` and `messages` resource types.

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

### Message Type Enum (`EMsgType`)

Source: `repos/domain/src/types/ai.types.ts`

| Type | Value | Description |
|------|-------|-------------|
| `user` | `"user"` | Messages sent by the human user |
| `assistant` | `"assistant"` | Responses generated by the AI agent |
| `system` | `"system"` | System-level instructions or context injected into the conversation |
| `tool` | `"tool"` | Messages representing tool invocations or their results |
| `action` | `"action"` | Messages representing discrete actions taken by the agent |

### Content Format (`TMessageContent`)

Source: `repos/domain/src/types/ai.types.ts`

Message content is stored as a JSONB array of typed content blocks. Each block has a `type` discriminator from the `EContentType` enum. A single message can contain multiple content blocks of different types.

**Content block types:**

| Type | Interface | Key Fields | Description |
|------|-----------|------------|-------------|
| `text` | `TTextContent` | `text: string` | Plain text or markdown content |
| `image` | `TImageContent` | `data: string`, `mimeType: string` | Base64-encoded image data |
| `file` | `TFileContent` | `assetId: string`, `fileName: string` | Reference to an uploaded file asset |
| `tool_use` | `TToolUseContent` | `id: string`, `name: string`, `input: Record<string, unknown>` | A tool invocation request from the assistant |
| `tool_result` | `TToolResultContent` | `content: string`, `toolUseId: string`, `isError?: boolean` | The result of a tool invocation |
| `artifact` | `TArtifactContent` | `content: string`, `title?: string`, `language?: string`, `artifactType: TArtifactType` | A generated artifact (code, HTML, SVG, markdown, etc.) |
| `thinking` | `TThinkingContent` | `thinking: string`, `thinkingSignature?: string`, `redacted?: boolean` | Internal reasoning/chain-of-thought from the model |

## Thread Branching

Thread branching allows users to fork a conversation at any message point, creating a new thread that inherits the history up to (and including) the branch point.

### How It Works

Source: `repos/database/src/services/thread.ts` (`branchThread` method)

1. The user specifies a `threadId` and a `messageId` where they want to branch.
2. The system retrieves the original thread and all its messages in chronological order.
3. It locates the branch message by ID and determines its position in the message sequence.
4. A new thread is created with:
   - `parentThreadId` set to the original thread's ID
   - `branchMessageId` set to the specified message ID
   - `name` set to `"<original name> (branch)"`
   - All other metadata (`orgId`, `agentId`, `projectId`, `providerId`, `meta`, `public`) copied from the original
5. All messages from the start of the conversation up to and including the branch message are copied into the new thread.
6. The entire operation runs inside a database transaction for atomicity.

### Schema Support

The branching relationship is encoded in two thread columns:
- `parent_thread_id` -- points to the thread this branch was forked from
- `branch_message_id` -- the specific message in the parent thread where the fork occurred

The Drizzle relations define this as a self-referential relationship named `threadBranches`, enabling queries like:
- **Get branches**: list all threads where `parentThreadId` equals a given thread ID
- **Get parent**: follow `parentThreadId` to the original thread

### API Support

The `GET /:id` endpoint supports an `?include=` query parameter:
- `?include=branches` -- returns child threads as a `branches` array on the response
- `?include=parent` -- returns the parent thread as a `parentThread` object (with access control: same org, same user)
- `?include=branches,parent` -- both

## Backend API

Source: `repos/backend/src/endpoints/threads/threads.ts`

All thread endpoints are scoped under agents:

```
/_/:orgId/agents/:agentId/threads
```

Authentication is required for all endpoints (JWT or API key). Permission checks use the org-level RBAC system. The thread owner (`userId`) is enforced on all read/write operations -- users can only access their own threads.

### Thread Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/` | `createThread` | Create a new thread for the agent. Increments the org's `threads` quota counter. |
| `GET` | `/` | `listThreads` | List threads for the agent, scoped to the authenticated user. Supports `?limit` and `?offset` pagination. |
| `GET` | `/:id` | `getThread` | Get a single thread by ID. Supports `?include=branches,parent` for related data. |
| `PUT` | `/:id` | `updateThread` | Update thread `name`, `meta`, or `public` flag. |
| `DELETE` | `/:id` | `deleteThread` | Delete a thread and all its messages (cascade). |
| `POST` | `/:threadId/branch` | `branchThread` | Branch a thread at a specific message. Body: `{ messageId: string }`. |

### Message Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/:threadId/messages` | `createMessage` | Create a message in a thread. Body: `{ type, content }`. Increments the org's `messages` quota counter. |
| `GET` | `/:threadId/messages` | `listMessages` | List messages for a thread. Supports `?limit` and `?offset` pagination. |
| `PUT` | `/:threadId/messages/:messageId` | `updateMessage` | Update a message's `content`, `type`, or `meta`. |
| `DELETE` | `/:threadId/messages/:messageId` | `deleteMessage` | Delete a specific message from a thread. |

### File Endpoint

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/:threadId/files` | `uploadFile` | Upload a file to a thread. Body: `{ fileName, data (base64), mimeType }`. Creates an asset record, extracts text content, and returns extracted text and asset metadata. Max file size: 25 MB. |

Source files:
- `repos/backend/src/endpoints/threads/createThread.ts`
- `repos/backend/src/endpoints/threads/listThreads.ts`
- `repos/backend/src/endpoints/threads/getThread.ts`
- `repos/backend/src/endpoints/threads/updateThread.ts`
- `repos/backend/src/endpoints/threads/deleteThread.ts`
- `repos/backend/src/endpoints/threads/branchThread.ts`
- `repos/backend/src/endpoints/threads/createMessage.ts`
- `repos/backend/src/endpoints/threads/listMessages.ts`
- `repos/backend/src/endpoints/threads/updateMessage.ts`
- `repos/backend/src/endpoints/threads/deleteMessage.ts`
- `repos/backend/src/endpoints/threads/uploadFile.ts`

### Authorization Model

Every thread endpoint follows the same authorization pattern:

1. **Authentication**: `req.user.id` must be present (401 if missing).
2. **Thread-Agent validation**: The thread's `agentId` must match the `:agentId` route parameter (404 if mismatch).
3. **Permission check**: `checkPermission(req, action, resource, { orgId })` validates the user has the required RBAC permission for the operation.
4. **Owner check**: `thread.userId === req.user.id` (403 if mismatch). Users can only access their own threads.

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
