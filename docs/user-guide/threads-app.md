# Threads App

## What is the Threads App

The Threads App is a standalone, browser-based interface designed for end users to interact with sandbox sessions and conversations. It is separate from the Admin Dashboard and serves a different audience and purpose.

![Threads app login](./images/threads-login.png)

## Access

### Authentication

Sign in with any supported social login provider or email, and you are immediately taken to the app. Sessions are maintained automatically -- you stay signed in across browser tabs and page refreshes.

The Threads App also handles CLI token authorization. When you run `tsa login` (browser login) from the CLI, the browser opens the Threads App to complete the OAuth flow and pass credentials back to the CLI.

### Supported Login Providers

- GitHub
- Google
- Vercel
- Email/password

## Features

### Home Page

After login, the app navigates to your organization's project list. If you belong to multiple organizations, you select one first. Each project displays its available sandbox configurations as cards, giving you a quick entry point to start or connect to sandbox sessions.

![Threads home view](./images/threads-home.png)

### Settings

The settings page provides user-level preferences:

- **Appearance** -- Toggle between dark and light themes. The preference persists across sessions.
- **Notifications** -- Toggle switches for email notifications and security alerts.

### Sidebar

The app includes a responsive sidebar that adapts to screen size:

- **Desktop** -- A persistent sidebar panel on the left side of the layout.
- **Mobile** -- A drawer-based sidebar toggled by a floating action button in the bottom-left corner.

The sidebar provides navigation to organizations, projects, sandboxes, instances, sessions, and settings.

### Session Workspace

The session workspace is the primary view when connected to a sandbox. It combines a terminal, file browser, code editor, activity feed, and port management into a single layout. The workspace opens when you click a session in the sidebar or start a new session on a sandbox instance.

#### Terminal

The terminal pane provides a full interactive shell powered by xterm.js. It connects to the sandbox pod via WebSocket and supports:

- Real-time input and output with ANSI color rendering
- Automatic terminal resizing to fit the viewport
- PTY buffer replay when reconnecting to idle sessions
- Customizable font family, font size, cursor style, scrollback, and theme via the terminal settings panel

#### File Tree

The left panel displays a hierarchical file browser showing the sandbox pod's filesystem. You can:

- **Browse directories** by expanding and collapsing tree nodes
- **Open files** in the code editor by clicking them
- **Create files and folders** via the context menu or inline input
- **Rename files** with inline editing
- **Delete files** with a confirmation dialog

The file tree updates in real-time as files change inside the sandbox.

#### Code Editor

Clicking a file in the file tree opens it in the code editor pane. The editor supports:

- **Tabbed editing** for multiple open files
- **Syntax highlighting** based on file extension
- **Status bar** showing file path and editor state

#### Activity Feed

The activity feed displays a chronological stream of events from the sandbox session. Cards include:

- **Prompt cards** -- AI tool prompts and instructions
- **Output cards** -- Command output and responses
- **Action cards** -- Tool calls and their results
- **User input cards** -- Your typed inputs
- **Idle markers** -- Visual separators for periods of inactivity

#### Port Management

The ports section lets you expose sandbox ports for external access directly from the browser:

- **List ports** -- View detected and exposed ports on the running instance
- **Expose a port** -- Make a port accessible via a public URL
- **Remove a port** -- Close an exposed port
- **Open URL** -- Navigate to the public URL for an exposed port

### Sandbox Sessions

The Threads App provides a browser-based terminal for sandbox sessions. Sessions are listed in the sidebar, grouped under their sandbox and instance, with visual indicators for status:

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

#### Instance Navigation

The sidebar displays sandbox instances as expandable sub-items under each sandbox. Each instance shows its state (Running, Pending, etc.) and a count of active sessions. Clicking an instance expands it to reveal the sessions running on that instance.

The sidebar organizes sandboxes and instances in a tree structure:

```
▼ Claude Code (sandbox)
  ▸ tdsk-sb-abc-x7k9 (Running) — 2 sessions
  ▸ tdsk-sb-abc-m3p2 (Running) — 1 session
▼ Codex (sandbox)
  ▸ tdsk-sb-def-q8w5 (Running) — 1 session
▶ OpenCode (sandbox) — no instances
```

- Green indicator: instance is Running
- Yellow indicator: instance is Pending
- Grey indicator: instance is Terminating or Failed
- Session count badge shows active sessions per instance

Expanding an instance reveals the sessions running on it. Each session row displays a status dot and label matching the session status indicators described above (green for active, yellow for idle, grey for expired) along with the session owner's name. Shared sessions from other users show a people icon. Clicking a session connects to it or reconnects if idle.

```
▼ Claude Code (sandbox)
  ▼ tdsk-sb-abc-x7k9 (Running) — 2 sessions
    ● Session 1 — Active (you)
    ● Session 2 — Idle
  ▸ tdsk-sb-abc-m3p2 (Running) — 1 session
```

#### Instance-Grouped Sessions

Sessions are grouped by the instance they belong to. This makes it clear which pod is hosting each session and helps users target the correct environment when multiple instances of the same sandbox are running concurrently. When you expand a sandbox that has multiple instances, each instance appears as a collapsible group with its own session list, so sessions on different pods are never mixed together.

#### Creating New Instances

Users can start a new instance from the sandbox context menu or when connecting to a sandbox that already has running instances. If multiple instances are available, the UI prompts the user to select which instance to connect to before opening a session.

#### Instance Lifecycle Controls

The instance detail page provides lifecycle controls for managing running instances:

- **Stop** -- Stops the instance and deletes the pod. If other users have active sessions, you must confirm with the force option.
- **Restart** -- Stops and restarts the instance, preserving the session history in the sidebar.
- **Recreate** -- Destroys the instance completely and creates a fresh one from the sandbox configuration. All in-container state is lost.

## Relationship to Admin UI

The Threads App and the Admin Dashboard are distinct applications serving different audiences within the same platform. An administrator uses the Admin Dashboard to create an organization, configure sandboxes with provider keys, and invite team members. Those team members then use the Threads App to launch sandbox sessions and have conversations -- without needing access to the underlying configuration.

| Aspect | Admin Dashboard | Threads App |
|--------|----------------|-------------|
| **Audience** | Developers, administrators, org owners | End users, team members, non-technical users |
| **Purpose** | Configure and manage platform resources | Interact with sandbox sessions and conversations |
| **Key Activities** | Create orgs, configure sandboxes, manage secrets and providers, set up endpoints, manage billing and quotas, invite users | Launch sandbox sessions, browse files, manage ports, view activity history |

Both apps share a common authentication system and communicate with the same backend API.
