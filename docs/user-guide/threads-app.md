# Threads App

## What is the Threads App

The Threads App is a standalone, browser-based interface designed for end users to interact with AI agents through conversations. It is separate from the Admin Dashboard and serves a different audience and purpose.

![Threads app login](./images/threads-login.png)

## Access

### Authentication

Sign in with any supported social login provider or email, and you are immediately taken to the app. Sessions are maintained automatically -- you stay signed in across browser tabs and page refreshes.

### Supported Login Providers

- GitHub
- Google
- Vercel
- Email/password

## Features

### Home Page

The home page is the primary landing point after login, surfacing thread listings and agent selection.

![Threads home view](./images/threads-home.png)

### Settings

The settings page provides user-level preferences:

- **Appearance** -- Toggle between dark and light themes. The preference persists across sessions.
- **Notifications** -- Toggle switches for email notifications, agent run notifications, and security alerts.

### Sidebar

The app includes a responsive sidebar that adapts to screen size:

- **Desktop** -- A persistent sidebar panel on the left side of the layout.
- **Mobile** -- A drawer-based sidebar toggled by a floating action button in the bottom-left corner.

The sidebar provides navigation to threads, agents, and settings.

### Thread Conversations

Thread conversations are the core of the Threads App. Within a thread, you can:

- **Create threads** under a specific agent to start a new conversation.
- **List threads** to browse previous conversations.
- **View messages** within a thread, rendered by content type (text, images, tool calls, artifacts, and more).
- **Send messages** to continue a conversation with the AI agent.
- **Branch threads** at any message to fork a conversation and explore different directions. Branching copies all messages up to the branch point into a new thread while preserving the original.
- **Upload files** to a thread (up to 25 MB per file) for the agent to process.
- **Delete threads and messages** to manage conversation history.

Each thread is scoped to an agent within an organization, and users can only see their own threads.

### Sandbox Sessions

The Threads App provides a browser-based terminal for sandbox sessions. Sessions are listed in the sidebar, grouped under their sandbox, with visual indicators for status:

- **Green dot** -- Active session (you are currently connected).
- **Yellow dot** -- Idle session (server-side PTY is alive but no client is attached). Click to reconnect.
- **Grey dot** -- Expired session (no longer available on the server).
- **People icon** -- Shared session from another user. Click to join.

#### Connecting and Disconnecting

Click any session in the sidebar to connect. For idle sessions, the terminal replays the PTY buffer so you see the full terminal state from where you left off.

The session command bar provides lifecycle controls:

- **Disconnect** (owner only) -- Closes your WebSocket connection without killing the PTY. The session enters a 5-minute idle window and can be reconnected.
- **Leave** (non-owner, when you have joined a shared session) -- Closes your connection. The session owner and other participants are unaffected.
- **New** -- Creates a new session on the same sandbox.

#### Sharing Sessions

Session owners can make a session public so other org members with sandbox exec permission can join:

- Click the **Share** button in the session command bar to toggle visibility. The button shows "Shared" (filled style) when the session is public.
- When a session is public, it appears in the sidebar for other org members with a people icon and a "Shared" label.
- Members without exec permission see shared sessions dimmed with a "View only" label.

The sidebar updates in real-time as sessions are created, destroyed, shared, or joined -- no manual refresh is needed.

## Relationship to Admin UI

The Threads App and the Admin Dashboard are distinct applications serving different audiences within the same platform. An administrator uses the Admin Dashboard to create an organization, set up agents with tools and provider keys, and invite team members. Those team members then use the Threads App to have conversations with the configured agents -- without needing access to the underlying configuration.

| Aspect | Admin Dashboard | Threads App |
|--------|----------------|-------------|
| **Audience** | Developers, administrators, org owners | End users, team members, non-technical users |
| **Purpose** | Configure and manage platform resources | Interact with AI agents through conversations |
| **Key Activities** | Create orgs, manage agents, configure tools and secrets, set up endpoints, manage billing and quotas, invite users | Start conversations, send messages, browse thread history, branch conversations |

Both apps share a common authentication system and communicate with the same backend API.
