# Session Sharing

## What is Session Sharing

Session sharing allows multiple terminals and browsers to connect to the same PTY session inside a sandbox pod in real-time. When one user types a command, every connected client sees the output immediately. This works across the TSA CLI and the Threads web app -- a developer can start a session from their terminal and a colleague can join from their browser.

Each sandbox session is backed by a persistent server-side SSH connection to the pod. The server manages a set of WebSocket "attachments" per session. When data arrives from the PTY, the server fans it out to every attached WebSocket. When any client sends input, it is forwarded to the shared SSH stream. The result is a fully synchronized terminal experience, similar to `tmux` or `screen` but managed by the platform.

Key characteristics:

- **Multi-client**: Any number of WebSocket clients can attach to a single PTY session simultaneously.
- **Cross-surface**: CLI users (`tsa`) and browser users (Threads app) can share the same session.
- **Visibility-controlled**: Sessions are private by default. The session owner toggles visibility to allow others to join.
- **Non-destructive disconnect**: Closing a client detaches from the session without killing the PTY. Other clients continue uninterrupted.
- **Buffered reconnect**: On reconnect, the server replays the PTY buffer so the client sees the full terminal state.


## Session Visibility

Every session has a visibility setting that controls who can connect.

| Visibility | Default | Who Can Connect |
|------------|---------|-----------------|
| `private` | Yes | Only the session owner (the user who created it) |
| `public` | No | Any org member with `exec` permission on the `sandbox` resource |

Only the session owner can change visibility. Other attached users cannot toggle it.

### Toggling Visibility

**Threads UI**: Click the **Share** button in the session command bar. The button toggles between "Share" (make public) and "Shared" (currently public, click to make private). The button is only visible to the session owner.

**TSA CLI**: Use the `tsa sessions share` and `tsa sessions unshare` subcommands:

```bash
# Make a session public
tsa sessions share <session-id>

# Make a session private again
tsa sessions unshare <session-id>
```

If a session ID is not provided, the CLI will auto-resolve it: if only one session exists for the sandbox, it selects it automatically; if multiple sessions exist, an interactive picker is displayed.

When visibility changes, the server broadcasts a `visibility` message to all attached clients and a `sessions-updated` event to every client connected to the sandbox, so the Threads sidebar and session lists update in real-time.


## Connecting to Sessions

### TSA CLI

**Reconnect to your own session**: When you run `tsa sandbox <sandbox-id>` (or `tsa run <sandbox-id>`), the CLI checks for existing sessions on that sandbox. If it finds one, it prompts you to reconnect:

```
Found 1 existing session(s). Reconnect to a1b2c3d4e5f6? (Y/n/new)
```

- Press Enter or type `y` to reconnect.
- Type `n` to create a new session.
- Type `new` to create a new session.

To skip the prompt entirely and always create a new session:

```bash
tsa sandbox <sandbox-id> --new
```

**Join a shared session by ID**: Use the `sessions connect` subcommand:

```bash
tsa sessions connect <session-id>
```

The CLI auto-resolves which sandbox the session belongs to. If the session is public and you have sandbox exec permission, you are attached. If the session is private and you are not the owner, the server rejects the connection.

**List sessions**: View active sessions for a sandbox:

```bash
tsa sessions list <sandbox-id>
```

This prints each session's ID, owner, visibility, and connection time.

### Threads UI

**Reconnect to your own session**: Click a session in the sidebar. Sessions are grouped under their sandbox and categorized as Active (green dot), Idle (yellow dot -- server-side session alive but no client attached), or Expired (grey dot). Clicking an Idle session triggers a reconnect and replays the PTY buffer.

**Join a shared session**: Shared sessions from other users appear in the sidebar with a people icon and the label "Shared". Click the session to join. If you lack sandbox exec permission, the session appears dimmed with a "View only" label and is not clickable.


## Detaching Without Killing

Detaching closes your local connection while leaving the server-side PTY alive. Other attached clients continue working normally.

### TSA CLI

**Session menu (recommended)**: Press `Ctrl+]` to open a reverse-video status bar at the bottom of the terminal:

```
 Session -- (d) Detach  (esc) Cancel
```

Press `d` to detach. Press `Esc` or any other key to dismiss the menu and return to the session.

**SSH-style escape**: Type `~.` immediately after pressing Enter (the tilde must follow a newline). This matches the familiar OpenSSH disconnect sequence.

After detaching, the CLI prints a confirmation:

```
Detached from session a1b2c3d4e5f6
```

### Threads UI

**Session owner**: Click the **Disconnect** button in the session command bar. This closes the WebSocket connection and navigates back to the sandbox page. The session remains alive on the server.

**Non-owner (joined a shared session)**: Click the **Leave** button. This closes your WebSocket attachment. The session owner and other participants continue unaffected.


## 5-Minute TTL

When the last client disconnects from a session, the server starts a 5-minute TTL timer. During this window:

1. The PTY buffer is saved to the database (associated with the session's thread record) so that reconnecting clients receive the full terminal state.
2. The PTY and SSH connection remain active -- any background processes in the pod continue running.
3. The session appears as "Idle" in the Threads sidebar and in `tsa sessions list`.

If a client reconnects within the 5-minute window, the TTL timer is cancelled and the session resumes normally. The reconnecting client receives the buffered PTY output, restoring the full terminal display.

If no one reconnects within 5 minutes, the session is fully cleaned up: the SSH stream is closed, the ring buffer is released, and the session is removed from the server's in-memory session map. A `sessions-updated` broadcast notifies all clients connected to that sandbox.

The pod itself is not affected by session cleanup. The pod has its own idle timeout (configurable per sandbox, default 30 minutes) that only triggers when there are zero sessions of any kind and no activity.


## Real-Time Session Updates

The server broadcasts `sessions-updated` messages to all WebSocket clients connected to a sandbox whenever a session lifecycle event occurs:

- A new session is created
- A session is destroyed (TTL expiry or SSH stream close)
- A client attaches to or detaches from a session
- A session's visibility changes

The broadcast payload includes the full list of sessions for that sandbox, with each session's ID, owner, visibility, connection time, and whether it has an active shell session. The Threads sidebar consumes these events to keep the session list current without polling.

Additional per-session events are sent to clients attached to a specific session:

| Event | Sent When | Recipients |
|-------|-----------|------------|
| `user-joined` | A new client attaches to a public session | All other clients on that session |
| `user-left` | A client detaches from a public session | All remaining clients on that session |
| `visibility` | The owner toggles session visibility | All clients on that session |
| `sandbox-stopping` | The sandbox pod is being stopped | All clients on all sessions for that sandbox |

In the TSA CLI, `user-joined` and `user-left` events print a status line to stderr (e.g., "User abc12345 joined"). In the Threads UI, the sidebar updates automatically.


## Walkthrough

This example demonstrates the full session sharing flow between two users.

### 1. User A starts a sandbox session from the Threads UI

User A navigates to a sandbox in the Threads app and clicks to start a session. The server creates a new PTY, allocates a session ID, and streams terminal output to User A's browser. The session is private by default.

### 2. User A shares the session

User A clicks the **Share** button in the session command bar. The button changes to **Shared** (filled style) to confirm. The server sets the session visibility to `public` and broadcasts a `sessions-updated` event.

### 3. User B discovers the shared session

User B runs the following from their terminal:

```bash
tsa sessions list <sandbox-id>
```

The output shows User A's session with visibility `public`:

```
Sessions for sandbox sb_xxx (1 active)

  ID               Owner                Visibility Connected
  ────────────────── ──────────────────── ────────── ────────────────────
  a1b2c3d4e5f678   user_abc123...       public     2026-05-02T14:30:00Z
```

### 4. User B joins the session

```bash
tsa sessions connect a1b2c3d4e5f678
```

User B's terminal displays the same output as User A's browser. User A sees a "User [id] joined" notification. Both users now share the same PTY -- any input from either side is visible to both.

### 5. User B detaches

User B presses `Ctrl+]` then `d`. The terminal prints:

```
Detached from session a1b2c3d4e5
```

User A's session continues uninterrupted. User A sees a "User [id] left" notification.

### 6. User B rejoins

User B can reconnect at any time with the same command:

```bash
tsa sessions connect a1b2c3d4e5f678
```

The PTY buffer is replayed, restoring the full terminal state. User A is notified again.
