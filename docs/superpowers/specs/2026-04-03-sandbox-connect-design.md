# Sandbox Connect: SSH/Connection Layer Design Spec

## Context

Threaded Stack's sandbox infrastructure (K8s pod orchestration, MITM egress proxy, placeholder token secret injection) is fully operational. Users can create sandbox configs and start pods via the admin UI and API, but there is no way for a developer to **connect directly** to a running sandbox. This spec defines an SSH connection layer so developers can `tsa ssh <sandbox-id>` from their terminal and land in a sandbox running Claude Code, Codex, or OpenCode — with secrets securely injected, environment pre-configured, and the full SSH feature set (SCP, SFTP, VS Code Remote) available.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Connection protocol | Real SSH (OpenSSH in containers) | Meet developers where they are — native terminal, IDE support |
| Routing | ProxyCommand via `tsa` CLI | Reuses existing proxy chain, no extra ports/services, negligible backend strain |
| SSH authentication | Auto-generated random password per pod | Simple, stateless, rotates every lifecycle. TDSK auth validates before tunnel opens |
| Agent images | All three: Claude Code, Codex, OpenCode + base | Full vision from day one |
| Session management | Core tracking + idle timeout (in-memory) | Sufficient for initial launch, DB-backed sessions deferred |
| Workspace persistence | Git clone on start | Useful without PVC infrastructure; PVC deferred to TASKS.md |
| Project scoping | Sandboxes as project resources (schema migration) | Consistent with agents/secrets pattern, eliminates brittle context derivation |
| Admin UI | Full dual-level integration (org + project nav) | Mirrors agents/secrets pattern exactly |
| Browser terminal | Deferred to TASKS.md | Focus on native SSH first |

---

## Architecture

### Connection Flow

```
Developer's terminal                        K8s Cluster
┌─────────────┐                           ┌───────────────────────────┐
│ tsa ssh      │──WebSocket/HTTPS──→ Caddy → Proxy → Backend         │
│ <sandbox-id> │                          │           │               │
└──────┬──────┘                           │           │ TCP bridge    │
       │                                  │           ↓               │
  SSH client                              │         Pod:2222          │
  (spawned by tsa)                        │         ┌─────────────┐  │
                                          │         │ OpenSSH     │  │
                                          │         │   ↓         │  │
                                          │         │ AI Tool     │  │
                                          │         │ (Claude/    │  │
                                          │         │  Codex/     │  │
                                          │         │  OpenCode)  │  │
                                          │         └─────────────┘  │
                                          └───────────────────────────┘
```

### `tsa ssh <sandbox-id>` Flow

1. `tsa` authenticates with backend using stored API key
2. `POST /_/sandboxes/:id/connect` → backend validates auth, pod ownership, pod state
3. If pod not running → auto-start pod, wait for Running state
4. Backend returns SSH password + connection details
5. `tsa` spawns SSH client with ProxyCommand:
   ```
   ssh -o ProxyCommand="tsa proxy <sandbox-id>" \
       -o StrictHostKeyChecking=no \
       -o UserKnownHostsFile=/dev/null \
       sandbox@<sandbox-id>
   ```
6. SSH client invokes `tsa proxy <sandbox-id>` for transport
7. `tsa proxy` opens WebSocket to `/_/sandboxes/:id/tunnel`
8. Backend bridges WebSocket ↔ TCP to pod:2222
9. SSH authentication completes (password via SSH_ASKPASS)
10. Developer has a full SSH session inside the sandbox

### VS Code Remote SSH Config
```
Host sandbox-*
  ProxyCommand tsa proxy %h
  User sandbox
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
```

---

## Implementation by Repo

### 1. Domain (`repos/domain/`)

**Files to modify:**
- `repos/domain/src/types/sandbox.types.ts` — Add new config fields and session types

**Changes:**
```typescript
// Extend TKubeSandboxConfig:
type TKubeSandboxConfig = {
  // ... existing fields (image, args, workdir, command, secretIds, etc.)
  sshEnabled?: boolean           // Enable SSH server (default true)
  gitRepo?: string               // Git repo URL to clone on start
  gitBranch?: string             // Branch to clone (default: main)
  idleTimeoutMinutes?: number    // Auto-stop after N minutes idle (default: 30)
}

// New types:
type TSandboxSession = {
  sessionId: string
  podName: string
  sandboxId: string
  userId: string
  orgId: string
  connectedAt: string   // ISO date
  lastActivity: string  // ISO date
}

type TSandboxConnectResponse = {
  password: string
  host: string
  port: number
  command: string       // Full "tsa ssh <id>" command for display
  podName: string
  sandboxId: string
}
```

**Files to modify:**
- `repos/domain/src/models/sandbox.ts` — Add `projectId` field to Sandbox model

```typescript
export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string    // NEW
  config: TKubeSandboxConfig
}
```

---

### 2. Database (`repos/database/`)

**Files to modify:**
- `repos/database/src/schemas/sandboxes.ts` — Add `projectId` column + update relations

```typescript
// Table change:
export const sandboxes = pgTable('sandboxes', {
  ...base,
  name: text('name').notNull(),
  orgId: varchar('org_id', { length: 10 })
    .references(() => orgs.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  projectId: varchar('project_id', { length: 10 })    // NEW
    .references(() => projects.id, { onDelete: 'cascade' }),
  config: jsonb('config').notNull().$type<TKubeSandboxConfig>(),
})

// Add index: sandboxes_project_idx on projectId

// Update sandboxesRelations — add project relation:
project: one(projects, {
  references: [projects.id],
  fields: [sandboxes.projectId],
}),

// Update projectsRelations (in projects schema) — add back-reference:
sandboxes: many(sandboxes),
```

- `repos/database/src/schemas/schemas.ts` — Register new index
- `repos/database/src/services/sandbox.ts` — Add `listByProject()` and `listByOrg()` methods
- `repos/database/src/types/schema.types.ts` — Types auto-derived from schema change

---

### 3. Sandbox (`repos/sandbox/`)

**Files to modify:**
- `repos/sandbox/src/kube/podManifest.ts` — SSH port, password env, git clone support

**Pod manifest changes:**

Add to sandbox container:
- Port 2222 (SSH) in container ports
- `TDSK_SSH_PASSWORD` env var (random password from SandboxService)
- `TDSK_GIT_REPO` env var (if configured)
- `TDSK_GIT_BRANCH` env var (if configured)
- Container command wraps through entrypoint script (starts SSH + AI tool)

**Important**: Git clone happens in the entrypoint script (not an init container) so it runs AFTER the proxy-redirect init container sets up iptables rules. This ensures git auth placeholder tokens (`tdsk_ph_*`) are replaced by the egress proxy.

---

### 4. Docker Images (`deploy/`)

Follows the existing convention where Dockerfiles live at `deploy/Dockerfile.<name>`:

**New files:**
```
deploy/Dockerfile.sandbox-base      # Base image with OpenSSH, git, CA cert
deploy/Dockerfile.sandbox-claude    # Base + Claude Code
deploy/Dockerfile.sandbox-codex     # Base + Codex
deploy/Dockerfile.sandbox-opencode  # Base + OpenCode
deploy/sandbox-entrypoint.sh        # Shared entrypoint script
```

The `tdsk doc build` CLI command resolves Dockerfiles from the `deploy/` directory. New build contexts: `sandbox-base`, `sandbox-claude`, `sandbox-codex`, `sandbox-opencode`.

**Base image (`tdsk-sandbox-base`):**
```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    openssh-server git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user
RUN useradd -m -s /bin/bash sandbox && mkdir -p /run/sshd

# SSH config: password auth, no root login
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config \
    && echo "Port 2222" >> /etc/ssh/sshd_config

# CA cert mount point
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/tdsk-proxy.crt

COPY sandbox-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 2222
WORKDIR /workspace
RUN chown sandbox:sandbox /workspace

ENTRYPOINT ["entrypoint.sh"]
CMD ["sleep", "infinity"]
```

**Entrypoint script (`sandbox-entrypoint.sh`):**
```bash
#!/bin/bash
set -e

# 1. Set SSH password from environment
if [ -n "$TDSK_SSH_PASSWORD" ]; then
  echo "sandbox:$TDSK_SSH_PASSWORD" | chpasswd
fi

# 2. Start SSH server (background)
/usr/sbin/sshd -D -p 2222 &

# 3. Clone git repo if configured (goes through egress proxy for placeholder replacement)
if [ -n "$TDSK_GIT_REPO" ]; then
  BRANCH="${TDSK_GIT_BRANCH:-main}"
  git clone --branch "$BRANCH" "$TDSK_GIT_REPO" /workspace 2>/dev/null || true
  chown -R sandbox:sandbox /workspace
fi

# 4. Execute the container command (AI tool or sleep infinity)
exec "$@"
```

**Claude Code image (`tdsk-sandbox-claude`):**
```dockerfile
FROM tdsk-sandbox-base
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @anthropic-ai/claude-code
```

**Codex image (`tdsk-sandbox-codex`):**
```dockerfile
FROM tdsk-sandbox-base
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @openai/codex
```

**OpenCode image (`tdsk-sandbox-opencode`):**
```dockerfile
FROM tdsk-sandbox-base
RUN curl -fsSL https://github.com/opencode-ai/opencode/releases/latest/download/opencode-linux-amd64 \
    -o /usr/local/bin/opencode \
    && chmod +x /usr/local/bin/opencode
```

---

### 5. Backend (`repos/backend/`)

**New files:**
- `repos/backend/src/endpoints/sandboxes/connectSandbox.ts`
- `repos/backend/src/endpoints/sandboxes/listSessions.ts`
- `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` — WebSocket tunnel handler

**Files to modify:**
- `repos/backend/src/endpoints/sandboxes/sandboxes.ts` — Register new REST endpoints
- `repos/backend/src/endpoints/sandboxes/createSandbox.ts` — Accept projectId
- `repos/backend/src/endpoints/sandboxes/updateSandbox.ts` — Accept projectId
- `repos/backend/src/endpoints/sandboxes/listSandboxes.ts` — Support projectId filter
- `repos/backend/src/endpoints/sandboxes/startSandbox.ts` — Use sandbox's stored projectId; make body projectId a fallback
- `repos/backend/src/server/wsServer.ts` — Support multiple WebSocket paths
- `repos/backend/src/services/sandboxes/sandbox.ts` — Password mgmt, session tracking, idle timeout

#### WebSocket Architecture Change (`wsServer.ts`)

**Critical**: The current `wsServer.ts` hardcodes a single WebSocket path (`/ai/ws`) and destroys connections to any other path. This must be refactored to support a path-based dispatch system.

```typescript
// Current (single path):
if (pathname !== WS_PATH) { socket.destroy(); return }

// New (multi-path dispatch):
type TWsHandler = (ws: WebSocket, req: IncomingMessage, app: TApp) => Promise<void>

const wsRoutes = new Map<string, TWsHandler>()
wsRoutes.set('/ai/ws', onWSConnect)
// Dynamic registration for sandbox tunnels:
// Pattern: /_/sandboxes/:id/tunnel

const onUpgrade = (req, socket, head) => {
  const pathname = new URL(req.url || '', 'http://localhost').pathname

  // Check static routes first
  if (wsRoutes.has(pathname)) {
    wss.handleUpgrade(req, socket, head, (ws) => wsRoutes.get(pathname)!(ws, req, app))
    return
  }

  // Check dynamic route patterns (sandbox tunnel)
  const tunnelMatch = pathname.match(/^\/_\/sandboxes\/([^/]+)\/tunnel$/)
  if (tunnelMatch) {
    wss.handleUpgrade(req, socket, head, (ws) => onTunnelConnect(ws, req, app))
    return
  }

  socket.destroy()
}
```

#### WebSocket Tunnel Auth

The proxy's `onUpgrade` handler forwards upgrade requests to the backend WITHOUT running Express auth middleware. The tunnel handler must validate auth directly from the raw HTTP upgrade request:

```typescript
// onTunnelConnect.ts
async function onTunnelConnect(ws: WebSocket, req: IncomingMessage, app: TApp) {
  // 1. Extract API key from Authorization header (req.headers.authorization)
  // 2. Validate API key hash against DB (same logic as proxy's setupApiKeyAuth)
  // 3. Extract sandboxId from URL path
  // 4. Validate pod ownership (orgId from API key scope)
  // 5. Look up pod IP from route map or K8s API
  // 6. Open TCP connection to podIP:2222
  // 7. Bridge: ws.on('message') → tcp.write(), tcp.on('data') → ws.send()
  // 8. Register session in SandboxService
  // 9. On close (either side) → clean up session + close other side
}
```

Auth passes through the proxy chain as normal HTTP headers. The proxy forwards the `Authorization` header to the backend. The backend's tunnel handler reads it from `req.headers.authorization` on the raw upgrade request, validates the API key hash against the DB, and extracts user identity. This mirrors the AI WebSocket auth pattern but uses API keys instead of session tokens.

#### New Endpoint: `connectSandbox`

```
POST /_/sandboxes/:id/connect
```
- Validates: auth, org membership, pod ownership (if running)
- Finds current pod for this sandbox by querying K8s with label selector `tdsk.app/sandbox-id=<id>`
- If no running pod → calls `startPod()` using sandbox's stored `projectId`, polls until Running
- If multiple pods found → uses the most recent Running pod
- Returns: `TSandboxConnectResponse` with password, host, port, command
- Password retrieved from in-memory map (set during `startPod()`)
- **Recovery**: If backend restarted and password is lost but pod is running, read `TDSK_SSH_PASSWORD` from the pod via `KubeClient.runInPod()` (`printenv TDSK_SSH_PASSWORD`) and re-cache it

#### New Endpoint: `listSessions`

```
GET /_/sandboxes/:id/sessions
```
- Returns: `TSandboxSession[]` for the sandbox's active pod

#### SandboxService Changes

**`TStartPodOpts.projectId` becomes optional:**
```typescript
type TStartPodOpts = {
  orgId: string
  userId: string
  sandboxId: string
  projectId?: string  // Now optional — may be undefined for org-only sandboxes
  egressOpts: TPodEgressOpts
}
```
When `projectId` is undefined, the pod label `tdsk.app/project-id` is omitted (not set to empty string). The `buildPodManifest()` function must handle this by conditionally including the label.

**Password management:**
```typescript
private passwords = new Map<string, string>()

async startPod(opts): Promise<string> {
  // ... existing logic ...
  const sshPassword = nanoid(24)
  // Add TDSK_SSH_PASSWORD to sandbox container env vars in manifest
  this.passwords.set(podName, sshPassword)
  return podName
}

getPassword(podName: string): string | undefined {
  return this.passwords.get(podName)
}

// Recovery after backend restart:
async recoverPassword(podName: string): Promise<string | undefined> {
  const result = await this.kube.runInPod(podName, ['printenv', 'TDSK_SSH_PASSWORD'])
  if (result.success && result.output) {
    const password = result.output.trim()
    this.passwords.set(podName, password)
    return password
  }
}
```

**Session tracking (in-memory):**
```typescript
private sessions = new Map<string, TSandboxSession[]>()

addSession(podName: string, session: TSandboxSession): void
removeSession(podName: string, sessionId: string): void
getSessions(podName: string): TSandboxSession[]
updateActivity(podName: string, sessionId: string): void
```

**Idle timeout worker:**
```typescript
// Started during initKube()
// Interval: every 60 seconds
// For each tracked pod (from passwords map + kube watch state):
//   - If no active sessions AND (now - lastActivity) > idleTimeoutMinutes:
//     - Stop the pod
//     - Clean up password + sessions
```

**WebSocket tunnel: binary framing + backpressure:**
- All WebSocket messages use binary frames (opcode 0x02)
- Buffer size: 64 KB chunks (matches typical SSH window size)
- Backpressure: pause TCP socket when WebSocket bufferedAmount exceeds threshold, resume when drained
- Caddy timeout: SSH sessions can last hours. The WebSocket connection must send periodic pings (every 30s) to prevent Caddy from closing idle connections. The tunnel handler sends WebSocket ping frames; the client (`tsa proxy`) responds with pong automatically (handled by WS library)

---

### 6. Admin UI (`repos/admin/`)

#### Route Changes

**Files to modify:**
- `repos/admin/src/types/routes.types.ts` — Add `ProjectSandboxes` enum value (new: `ERoutePath.ProjectSandboxes = "/orgs/:orgId/projects/:projectId/sandboxes"`)
- `repos/admin/src/routes/Routes.tsx` — Add project-level sandbox route under the project scope + loader

New route (under `/orgs/:orgId/projects/:projectId/`):
```typescript
{
  path: ERoutePath.Sandboxes,        // 'sandboxes'
  loader: projectSandboxesLoader,
  Component: () => <SuspensePage Component={ProjectSandboxes} />,
}
```

#### Navigation Changes

**Files to modify:**
- `repos/admin/src/constants/nav.tsx` — Add Sandboxes to ProjectSubNav + ProjectSubNavGroups

```typescript
// Add to ProjectSubNav record:
Sandboxes: { to: buildRoute(ERoutePath.ProjectSandboxes), Icon: <DrawingBoxIcon /> }

// Add to ProjectSubNavGroups, Development group:
items: [ProjectSubNav.Endpoints, ProjectSubNav.Functions, ProjectSubNav.Agents, ProjectSubNav.Sandboxes]
```

Org nav already has Sandboxes in the Resources group — no changes needed there.

#### New Pages

**New file: `repos/admin/src/pages/Projects/ProjectSandboxes.tsx`**
- Props: `orgId`, `projectId` from route params
- Data: `useProjectSandboxes()` selector — filters sandboxes where `projectId` matches
- Uses shared `Sandboxes` component with `orgId` + `projectId`
- Delete semantics: "Remove from project" (mirrors ProjectAgents pattern)

**Modified: `repos/admin/src/pages/Orgs/OrgSandboxes.tsx`**
- Shows all org sandboxes (including project-assigned ones)
- New "Project" column shows assigned project name
- Delete semantics: hard delete (mirrors OrgAgents pattern)

#### Shared Component Updates

**Modified: `repos/admin/src/components/Sandboxes/Sandboxes.tsx`**
- Accept `projectId?` prop
- Add context awareness (mirrors Secrets component pattern):
  ```typescript
  const isProjectContext = !!projectId
  const isOrgContext = !!orgId && !projectId

  const contextFilteredSandboxes = sandboxesArray.filter((sb) => {
    if (isProjectContext) return sb.projectId === projectId
    if (isOrgContext) return sb.orgId === orgId
    return false
  })
  ```
- New columns: Status (Running/Stopped/Pending with colored indicator), Project (org-level only)
- New action buttons: Start / Stop / Connect (opens ConnectModal)
- Status polling: periodic `getSandboxStatus()` for running pods

**Modified: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`**
- Accept `projectId?` prop
- When `projectId` provided (project context) → sandbox created with that projectId
- When no `projectId` (org context) → show project selector dropdown
- New form sections:
  - **Project selector** (org-level only) — dropdown to assign project
  - **Image presets** — quick-select buttons (Claude Code / Codex / OpenCode) that auto-fill image field
  - **SSH** accordion — enabled toggle (default on)
  - **Git Repository** accordion — repo URL + branch fields
  - **Idle Timeout** — number input (minutes, default 30)

**New: `repos/admin/src/components/Sandboxes/ConnectModal.tsx`**
- Shows SSH command to copy (`tsa ssh <sandbox-id>`)
- Shows pod status, uptime, active session count
- Actions: Disconnect All, Stop Sandbox

#### State Changes

**Modified: `repos/admin/src/state/sandboxes.ts` + `repos/admin/src/state/selectors.ts`**
- Add `useProjectSandboxes()` selector — filters by active projectId
- Existing `useSandboxes()` continues to work for org-level

**Modified: `repos/admin/src/routes/loaders.ts`**
- Add `projectSandboxesLoader` — fetches sandboxes for project scope if not cached

#### API Actions

**New files:**
- `repos/admin/src/actions/sandboxes/api/startSandbox.ts`
- `repos/admin/src/actions/sandboxes/api/stopSandbox.ts`
- `repos/admin/src/actions/sandboxes/api/connectSandbox.ts`
- `repos/admin/src/actions/sandboxes/api/getSandboxSessions.ts`
- `repos/admin/src/actions/sandboxes/api/getSandboxStatus.ts`

**Modified:**
- `repos/admin/src/actions/sandboxes/api/createSandbox.ts` — accept optional `projectId`
- `repos/admin/src/actions/sandboxes/api/updateSandbox.ts` — accept optional `projectId`

**Modified: `repos/admin/src/services/sandboxApi.ts`**
- Add `connect()`, `start()`, `stop()`, `sessions()`, `status()` methods

---

### 7. REPL CLI (`repos/repl/`)

**New files:**
- `repos/repl/src/tasks/ssh.ts` — `tsa ssh <sandbox-id>` command
- `repos/repl/src/tasks/proxy.ts` — `tsa proxy <host> [port]` ProxyCommand bridge
- `repos/repl/src/tasks/sandboxes.ts` — `tsa sandboxes` list command

#### `tsa ssh <sandbox-id>`

```
1. Validate stored auth (API key from ~/.config/tdsk/repl-auth.json)
2. Call POST /_/sandboxes/:id/connect
   - If pod not running, backend auto-starts it
   - Returns { password, podName, command }
3. Create temp SSH_ASKPASS script:
   #!/bin/bash
   echo "<password>"
4. Spawn SSH process:
   SSH_ASKPASS=<temp-script> SSH_ASKPASS_REQUIRE=force \
   ssh -o ProxyCommand="tsa proxy <sandbox-id>" \
       -o StrictHostKeyChecking=no \
       -o UserKnownHostsFile=/dev/null \
       sandbox@<sandbox-id>
5. Wait for SSH to exit
6. Clean up temp SSH_ASKPASS script
```

Output:
```
$ tsa ssh sb_abc123
Connecting to sandbox "my-claude-env"...
Pod starting... ✓
SSH session ready.

sandbox@tdsk-sb-myclau-x7f2:~/workspace$
```

#### `tsa proxy <host> [port]`

This is the ProxyCommand transport — called by the SSH client, not by the user directly. Because it handles raw binary stream bridging (stdin/stdout ↔ WebSocket), it must bypass the normal REPL task framework (which is text-based, Ink/React TUI).

**Implementation approach**: The `proxy` command is registered as a task but its `action` function directly works with `process.stdin`/`process.stdout` in raw binary mode (no Ink rendering). This is similar to how the `chat` command handles interactive I/O differently from list commands.

```
1. Set process.stdin to raw mode (no line buffering, no echo)
2. Extract sandbox-id from host argument
3. Read stored auth credentials
4. Open WebSocket (binary mode) to /_/sandboxes/:id/tunnel
   - Pass API key in Authorization header
5. Bridge:
   - process.stdin.on('data') → ws.send(chunk) [binary frames]
   - ws.on('message') → process.stdout.write(chunk) [raw bytes]
6. On stdin end → close WebSocket
7. On WebSocket close → process.exit()
```

**SSH_ASKPASS security**: The temp script file containing the SSH password is:
- Created with mode 0700 (owner-only execute)
- Cleaned up in a `finally` block and via `process.on('SIGINT')` / `process.on('SIGTERM')` signal handlers
- Deleted immediately after SSH process exits

#### `tsa sandboxes [--org <orgId>]`

```
1. GET /_/sandboxes/ → list sandbox configs
2. Display table:
   Name          | Image                    | Project     | Status
   my-claude-env | tdsk-sandbox-claude      | my-project  | Running
   codex-env     | tdsk-sandbox-codex       | —           | Stopped
```

---

## Security Considerations

1. **Double authentication** — TDSK auth (API key) validated at proxy level before tunnel opens. SSH auth (password) validates inside the container. Both must pass.
2. **Password lifecycle** — Generated randomly per pod lifecycle (nanoid(24)), stored only in backend memory + pod env var. Never persisted to database. Destroyed when pod stops. Recovery after backend restart via `runInPod('printenv TDSK_SSH_PASSWORD')`.
3. **Pod ownership** — `validatePodOwnership()` enforced on connect, tunnel, and session endpoints.
4. **No lateral movement** — iptables rules redirect outbound traffic on ports 80/443 through egress proxy. SSH access doesn't bypass secret injection or traffic interception. Note: port 2222 (SSH) is NOT redirected by iptables — this is intentional as it's the inbound SSH port, not outbound.
5. **SSH host key rotation** — Host keys regenerate every pod lifecycle. `StrictHostKeyChecking=no` is acceptable because the tunnel itself is authenticated and encrypted (HTTPS/WSS to backend).
6. **Git clone auth** — Git repos cloned inside the entrypoint (after iptables setup), so placeholder tokens in git URLs are replaced by the egress proxy. Raw credentials never visible.
7. **No K8s API access** — `automountServiceAccountToken: false` remains enforced. Sandbox containers cannot interact with the K8s control plane.
8. **Container runs as root initially** — The entrypoint needs root to run `chpasswd` (set SSH password) and start `sshd`. The `sshd` process drops to `sandbox` user for SSH sessions. This is a deliberate trade-off: `allowPrivilegeEscalation: false` remains enforced, and the `sandbox` user cannot escalate. The container does NOT set `runAsNonRoot: true`.
9. **K8s NetworkPolicy** — Consider adding a NetworkPolicy restricting ingress to port 2222 on sandbox pods to only the backend pod's IP range. This prevents other pods in the namespace from SSH-ing into sandboxes directly. This is a defense-in-depth measure (the SSH password is the primary gate).
10. **Tunnel WebSocket auth** — The proxy's `onUpgrade` handler does NOT run Express auth middleware. The backend's tunnel handler validates auth directly from `req.headers.authorization` on the raw upgrade request, using the same API key hash validation logic as the proxy.

---

## Cross-Repo Change Summary

| Repo | Changes |
|------|---------|
| **domain** | Extend `TKubeSandboxConfig` (sshEnabled, gitRepo, gitBranch, idleTimeoutMinutes). New types: `TSandboxSession`, `TSandboxConnectResponse`. Add `projectId` to Sandbox model. |
| **database** | Add `projectId` column to sandboxes table. Update relations (sandboxesRelations, projectsRelations). New index. Add `listByProject()` / `listByOrg()` methods. |
| **sandbox** | Update `podManifest.ts`: SSH port 2222, `TDSK_SSH_PASSWORD` env, `TDSK_GIT_REPO`/`TDSK_GIT_BRANCH` env. Handle optional projectId in labels. |
| **backend** | New endpoints: `connectSandbox`, `listSessions`, `onTunnelConnect` (WebSocket). Refactor `wsServer.ts` for multi-path dispatch. SandboxService: password mgmt, session tracking, idle timeout worker. Update existing endpoints for projectId. |
| **admin** | New route `ProjectSandboxes`. Add Sandboxes to project nav. New `ProjectSandboxes` page. Update `Sandboxes` component (context awareness, status, actions). Update `SandboxDrawer` (projectId, presets, SSH, git, timeout). New `ConnectModal`. State selectors. API actions. |
| **repl** | New commands: `ssh`, `proxy`, `sandboxes`. Binary I/O for proxy command. |
| **deploy** | New Dockerfiles: `sandbox-base`, `sandbox-claude`, `sandbox-codex`, `sandbox-opencode`. Shared entrypoint script. |

---

## Deferred Items (TASKS.md)

1. **WebSocket browser terminal** — xterm.js in admin UI for in-browser terminal access
2. **Persistent volume claims** — PVC support so workspace data survives pod restarts
3. **Concurrent session limits** — Tie to subscription tier quotas (max sandboxes per org/user)
4. **Sandbox quota tracking** — Add sandboxes as a tracked resource type in quotas system
5. **Dedicated SSH gateway** — If backend TCP bridging becomes a bottleneck at scale, extract to a dedicated SSH gateway service
6. **SSH certificate auth** — Replace password auth with CA-signed SSH certificates for stronger security

---

## Implementation Order

Work should proceed in dependency order:

1. **Domain types** — New config fields, session types, model update (no dependencies)
2. **Database schema** — Add `projectId` column, new index, update relations + service (depends on domain)
3. **Docker images** — Base image + 3 agent images + entrypoint script (independent)
4. **Sandbox pod manifest** — SSH port, password env, optional projectId label (depends on domain types)
5. **Backend endpoints** — connect, tunnel (WebSocket), sessions, update existing endpoints (depends on domain + database + sandbox)
6. **Backend session/idle** — Session tracking, idle timeout worker (depends on backend endpoints)
7. **Admin UI** — Routes, nav, pages, components, actions (depends on backend endpoints)
8. **REPL CLI** — `ssh`, `proxy`, `sandboxes` commands (depends on backend endpoints)
9. **Integration tests** — End-to-end validation (depends on everything above)

Steps 1-4 can run in parallel. Steps 5-6 are sequential. Steps 7-8 can run in parallel after step 6. Step 9 is last.
