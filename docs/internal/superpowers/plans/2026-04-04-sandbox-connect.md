# Sandbox Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an SSH connection layer so developers can `tsa ssh <sandbox-id>` and land in a running sandbox with Claude Code, Codex, or OpenCode — secrets injected, environment pre-configured, full SSH feature set available.

**Architecture:** Real SSH (OpenSSH) runs inside sandbox containers. The `tsa` CLI uses SSH's ProxyCommand to tunnel through the existing proxy chain (Caddy → Proxy → Backend → Pod:2222) via WebSocket. The backend bridges WebSocket frames to TCP. Sandboxes become project-scoped resources matching the agents/secrets dual-level pattern.

**Tech Stack:** OpenSSH, WebSocket (`ws`), K8s Exec API, Express 5, React/MUI/Jotai, Bun CLI

**Spec:** `docs/superpowers/specs/2026-04-03-sandbox-connect-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `deploy/Dockerfile.sandbox-base` | Base sandbox image: Ubuntu + OpenSSH + git + CA cert |
| `deploy/Dockerfile.sandbox-claude` | Base + Claude Code CLI |
| `deploy/Dockerfile.sandbox-codex` | Base + Codex CLI |
| `deploy/Dockerfile.sandbox-opencode` | Base + OpenCode binary |
| `deploy/sandbox-entrypoint.sh` | Shared entrypoint: set SSH password, start sshd, git clone, exec CMD |
| `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` | `POST /_/sandboxes/:id/connect` — auto-start + return SSH creds |
| `repos/backend/src/endpoints/sandboxes/listSessions.ts` | `GET /_/sandboxes/:id/sessions` — active tunnel sessions |
| `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` | WebSocket handler: auth + bridge WS↔TCP to pod:2222 |
| `repos/admin/src/pages/Projects/ProjectSandboxes.tsx` | Project-scoped sandbox list page |
| `repos/admin/src/components/Sandboxes/ConnectModal.tsx` | SSH command copy modal |
| `repos/admin/src/actions/sandboxes/api/startSandbox.ts` | Start sandbox API action |
| `repos/admin/src/actions/sandboxes/api/stopSandbox.ts` | Stop sandbox API action |
| `repos/admin/src/actions/sandboxes/api/connectSandbox.ts` | Connect sandbox API action |
| `repos/admin/src/actions/sandboxes/api/getSandboxStatus.ts` | Get sandbox pod status |
| `repos/admin/src/actions/sandboxes/api/getSandboxSessions.ts` | Get active sessions |
| `repos/repl/src/tasks/ssh.ts` | `tsa ssh <sandbox-id>` — orchestrate SSH connection |
| `repos/repl/src/tasks/proxy.ts` | `tsa proxy <host>` — ProxyCommand binary bridge |
| `repos/repl/src/tasks/sandboxes.ts` | `tsa sandboxes` — list sandbox configs |

### Modified Files
| File | Change |
|------|--------|
| `repos/domain/src/types/sandbox.types.ts` | Add `sshEnabled`, `gitRepo`, `gitBranch`, `idleTimeoutMinutes` to `TKubeSandboxConfig`. New types: `TSandboxSession`, `TSandboxConnectResponse` |
| `repos/domain/src/models/sandbox.ts` | Add `projectId?: string` field |
| `repos/database/src/schemas/sandboxes.ts` | Add `projectId` column, index, update relations |
| `repos/database/src/services/sandbox.ts` | Add `listByProject()`, `listByOrg()` methods |
| `repos/sandbox/src/kube/podManifest.ts` | Add SSH port 2222, `TDSK_SSH_PASSWORD` env, `TDSK_GIT_REPO`/`TDSK_GIT_BRANCH` env, conditional projectId label |
| `repos/backend/src/server/wsServer.ts` | Refactor to multi-path dispatch (support `/ai/ws` + `/_/sandboxes/:id/tunnel`) |
| `repos/backend/src/services/sandboxes/sandbox.ts` | Add password map, session tracking, idle timeout worker, `recoverPassword()` |
| `repos/backend/src/endpoints/sandboxes/sandboxes.ts` | Register new endpoints |
| `repos/backend/src/endpoints/sandboxes/createSandbox.ts` | Accept `projectId` in body |
| `repos/backend/src/endpoints/sandboxes/updateSandbox.ts` | Accept `projectId` in body |
| `repos/backend/src/endpoints/sandboxes/listSandboxes.ts` | Support `projectId` query filter |
| `repos/backend/src/endpoints/sandboxes/startSandbox.ts` | Use sandbox's stored `projectId` as default |
| `repos/admin/src/types/routes.types.ts` | Add `ProjectSandboxes` enum value |
| `repos/admin/src/constants/nav.tsx` | Add Sandboxes to `ProjectSubNav` + `ProjectSubNavGroups` |
| `repos/admin/src/routes/Routes.tsx` | Add project-level sandbox route |
| `repos/admin/src/routes/loaders.ts` | Add `projectSandboxesLoader` |
| `repos/admin/src/state/sandboxes.ts` | (no change needed — JSONB absorbs new fields) |
| `repos/admin/src/state/selectors.ts` | Add `useProjectSandboxes()` selector |
| `repos/admin/src/services/sandboxApi.ts` | Add `start()`, `stop()`, `connect()`, `sessions()`, `status()` methods |
| `repos/admin/src/actions/sandboxes/api/createSandbox.ts` | Accept optional `projectId` |
| `repos/admin/src/pages/Orgs/OrgSandboxes.tsx` | (no change — Sandboxes component handles context) |
| `repos/admin/src/components/Sandboxes/Sandboxes.tsx` | Add `projectId?` prop, context filtering, status column, action buttons |
| `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx` | Add `projectId?` prop, project selector, image presets, SSH/git/timeout fields |
| `repos/repl/src/tasks/index.ts` | Register `ssh`, `proxy`, `sandboxes` tasks |

---

## Task 1: Domain Types — Extend Sandbox Config & Add Session Types

**Files:**
- Modify: `repos/domain/src/types/sandbox.types.ts`
- Modify: `repos/domain/src/models/sandbox.ts`

- [ ] **Step 1: Add new fields to TKubeSandboxConfig and new types**

In `repos/domain/src/types/sandbox.types.ts`, add to the end of the `TKubeSandboxConfig` type (after the `resources` field):

```typescript
  sshEnabled?: boolean
  gitRepo?: string
  gitBranch?: string
  idleTimeoutMinutes?: number
```

Then add these new types after `TRouteMap`:

```typescript
export type TSandboxSession = {
  sessionId: string
  podName: string
  sandboxId: string
  userId: string
  orgId: string
  connectedAt: string
  lastActivity: string
}

export type TSandboxConnectResponse = {
  password: string
  host: string
  port: number
  command: string
  podName: string
  sandboxId: string
}
```

- [ ] **Step 2: Add projectId to Sandbox model**

In `repos/domain/src/models/sandbox.ts`, add `projectId` field:

```typescript
import type { TKubeSandboxConfig } from '@TDM/types'

import { Base } from './base'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string
  config: TKubeSandboxConfig

  constructor(data: TSandboxData) {
    super()
    Object.assign(this, data)
  }
}
```

- [ ] **Step 3: Verify exports**

Ensure `TSandboxSession` and `TSandboxConnectResponse` are exported from the domain package's barrel file. Check `repos/domain/src/types/index.ts` and add them if missing.

- [ ] **Step 4: Run type check**

Run: `cd repos/domain && pnpm types`
Expected: PASS — no type errors

- [ ] **Step 5: Run domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All existing tests pass

---

## Task 2: Database Schema — Add projectId Column & Relations

**Files:**
- Modify: `repos/database/src/schemas/sandboxes.ts`
- Modify: `repos/database/src/services/sandbox.ts`

- [ ] **Step 1: Add projectId column and index**

Replace `repos/database/src/schemas/sandboxes.ts` with:

```typescript
import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { text, jsonb, uuid, varchar, index, pgTable } from 'drizzle-orm/pg-core'

import type { TKubeSandboxConfig } from '@tdsk/domain'

export const sandboxes = pgTable(
  `sandboxes`,
  {
    ...base,
    name: text(`name`).notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `set null` }),
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` }),
    config: jsonb(`config`).notNull().$type<TKubeSandboxConfig>(),
  },
  (table) => [
    index(`sandboxes_org_idx`).on(table.orgId),
    index(`sandboxes_org_user_idx`).on(table.orgId, table.userId),
    index(`sandboxes_project_idx`).on(table.projectId),
  ]
)

export const sandboxesRelations = relations(sandboxes, ({ one }) => ({
  org: one(orgs, {
    references: [orgs.id],
    fields: [sandboxes.orgId],
  }),
  user: one(users, {
    references: [users.id],
    fields: [sandboxes.userId],
  }),
  project: one(projects, {
    references: [projects.id],
    fields: [sandboxes.projectId],
  }),
}))
```

- [ ] **Step 2: Add back-reference in projects schema**

Find `repos/database/src/schemas/projects.ts` and add `sandboxes` to `projectsRelations`:

```typescript
import { sandboxes } from '@TDB/schemas/sandboxes'
// In projectsRelations:
sandboxes: many(sandboxes),
```

- [ ] **Step 3: Add listByProject and listByOrg to sandbox service**

In `repos/database/src/services/sandbox.ts`:

```typescript
import type { TServiceOpts, TDBSandboxSelect, TDBSandboxInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { Sandbox as SandboxModel } from '@tdsk/domain'

export class Sandbox extends Base<
  typeof sandboxes,
  TDBSandboxSelect,
  TDBSandboxInsert,
  SandboxModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxes })
  }

  model = (data: TDBSandboxSelect) => {
    return new SandboxModel(data)
  }

  async listByOrg(orgId: string) {
    return this.list({ where: { orgId } })
  }

  async listByProject(projectId: string) {
    return this.list({ where: { projectId } })
  }
}
```

- [ ] **Step 4: Run type check**

Run: `cd repos/database && pnpm types`
Expected: PASS

- [ ] **Step 5: Run database tests**

Run: `cd repos/database && pnpm test`
Expected: All existing tests pass

> **Note**: The schema change requires `pnpm push` from `repos/database/` to apply to the live DB. This is interactive and must be run manually by the user.

---

## Task 3: Docker Images — Base + Agent Images

**Files:**
- Create: `deploy/sandbox-entrypoint.sh`
- Create: `deploy/Dockerfile.sandbox-base`
- Create: `deploy/Dockerfile.sandbox-claude`
- Create: `deploy/Dockerfile.sandbox-codex`
- Create: `deploy/Dockerfile.sandbox-opencode`

- [ ] **Step 1: Create shared entrypoint script**

Create `deploy/sandbox-entrypoint.sh`:

```bash
#!/bin/bash
set -e

# 1. Set SSH password from environment
if [ -n "$TDSK_SSH_PASSWORD" ]; then
  echo "sandbox:$TDSK_SSH_PASSWORD" | chpasswd
fi

# 2. Start SSH server (background, non-forking with -D removed so it backgrounds)
/usr/sbin/sshd -p 2222 -e
# sshd without -D runs as daemon

# 3. Clone git repo if configured (goes through egress proxy for placeholder replacement)
if [ -n "$TDSK_GIT_REPO" ]; then
  BRANCH="${TDSK_GIT_BRANCH:-main}"
  su sandbox -c "git clone --branch '$BRANCH' '$TDSK_GIT_REPO' /workspace" 2>/dev/null || true
fi

# 4. Execute the container command (AI tool or sleep infinity)
exec "$@"
```

- [ ] **Step 2: Create base Dockerfile**

Create `deploy/Dockerfile.sandbox-base`:

```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    openssh-server git curl ca-certificates sudo \
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user with home directory
RUN useradd -m -s /bin/bash sandbox \
    && mkdir -p /run/sshd /workspace \
    && chown sandbox:sandbox /workspace

# SSH config: password auth on port 2222, no root login
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config \
    && sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config \
    && echo "Port 2222" >> /etc/ssh/sshd_config

# Generate host keys at build time so sshd starts without delay
RUN ssh-keygen -A

# CA cert mount point for MITM proxy trust
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/tdsk-proxy.crt

COPY sandbox-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 2222
WORKDIR /workspace

ENTRYPOINT ["entrypoint.sh"]
CMD ["sleep", "infinity"]
```

- [ ] **Step 3: Create Claude Code image**

Create `deploy/Dockerfile.sandbox-claude`:

```dockerfile
FROM tdsk-sandbox-base

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 4: Create Codex image**

Create `deploy/Dockerfile.sandbox-codex`:

```dockerfile
FROM tdsk-sandbox-base

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @openai/codex \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 5: Create OpenCode image**

Create `deploy/Dockerfile.sandbox-opencode`:

```dockerfile
FROM tdsk-sandbox-base

RUN curl -fsSL https://github.com/opencode-ai/opencode/releases/latest/download/opencode-linux-amd64 \
    -o /usr/local/bin/opencode \
    && chmod +x /usr/local/bin/opencode
```

- [ ] **Step 6: Build base image**

Run: `cd repos/cli && pnpm cli doc build sandbox-base`
Expected: Image builds successfully

- [ ] **Step 7: Build agent images**

Run: `cd repos/cli && pnpm cli doc build sandbox-claude && pnpm cli doc build sandbox-codex && pnpm cli doc build sandbox-opencode`
Expected: All three images build successfully

---

## Task 4: Sandbox Pod Manifest — SSH Port, Password Env, Conditional Labels

**Files:**
- Modify: `repos/sandbox/src/kube/podManifest.ts`

- [ ] **Step 1: Update buildMeta to handle optional projectId**

In `repos/sandbox/src/kube/podManifest.ts`, replace the `buildMeta` function:

```typescript
const buildMeta = (opts: TBuildPodMeta) => {
  const labels: Record<string, string> = {
    [PodLabelKeys.managed]: `true`,
    [PodLabelKeys.orgId]: sanitizeLabel(opts.orgId),
    [PodLabelKeys.userId]: sanitizeLabel(opts.userId),
    [PodLabelKeys.sandboxId]: sanitizeLabel(opts.sandbox.id),
  }

  if (opts.projectId) {
    labels[PodLabelKeys.projectId] = sanitizeLabel(opts.projectId)
  }

  return {
    name: opts.podName,
    labels,
    annotations: {
      [PodAnnotationKeys.subdomain]: opts.subdomain,
      [PodAnnotationKeys.ports]: JSON.stringify(opts.config.ports || {}),
      [PodAnnotationKeys.placeholders]: JSON.stringify(opts.placeholders),
    },
  }
}
```

- [ ] **Step 2: Update buildSandboxContainer to add SSH port and env vars**

Replace the `buildSandboxContainer` function:

```typescript
const buildSandboxContainer = (
  config: TKubeSandboxConfig,
  extraEnv?: Record<string, string>
): V1Container => {
  const env: V1EnvVar[] = [
    { name: `NODE_EXTRA_CA_CERTS`, value: CACertMountPath },
    ...buildEnvVars(config.envVars),
    ...buildEnvVars(extraEnv),
  ]

  const ports = buildPorts(config.ports)
  // Always add SSH port if sshEnabled is not explicitly false
  if (config.sshEnabled !== false) {
    const hasSSHPort = ports.some((p) => p.containerPort === 2222)
    if (!hasSSHPort) {
      ports.push({ protocol: `TCP`, containerPort: 2222 })
    }
  }

  const container: V1Container = {
    name: `sandbox`,
    image: config.image,
    ports,
    env,
    workingDir: config.workdir || DefaultWorkdir,
    resources: config.resources || {},
    securityContext: {
      privileged: false,
      allowPrivilegeEscalation: false,
    },
    volumeMounts: [
      {
        subPath: `tls.crt`,
        name: VolumeMountName,
        mountPath: CACertMountPath,
      },
    ],
  }

  if (config.args) container.args = config.args
  container.command = config.command || [`sleep`, `infinity`]
  if (config.imagePullPolicy) container.imagePullPolicy = config.imagePullPolicy

  return container
}
```

- [ ] **Step 3: Update buildPodManifest to pass extraEnv**

Update the `buildPodManifest` function to accept and forward extra env vars:

```typescript
export const buildPodManifest = (opts: TBuildPodOpts): V1Pod => {
  const { orgId, userId, sandbox, projectId, egressOpts, placeholders, extraEnv } = opts

  const config = sandbox.config
  const podName = buildPodName(sandbox.id)
  const subdomain = podName.replace(`tdsk-`, ``)

  return {
    kind: `Pod`,
    apiVersion: `v1`,
    metadata: buildMeta({
      orgId,
      config,
      userId,
      sandbox,
      podName,
      subdomain,
      projectId,
      placeholders,
    }),
    spec: {
      restartPolicy: `Never`,
      automountServiceAccountToken: false,
      containers: [buildSandboxContainer(config, extraEnv)],
      initContainers: [buildInitContainer(egressOpts)],
      volumes: [
        {
          name: VolumeMountName,
          secret: { secretName: egressOpts.certSecretName },
        },
      ],
    },
  }
}
```

- [ ] **Step 4: Update TBuildPodOpts type**

In the types file for sandbox (`repos/sandbox/src/types/`), update `TBuildPodOpts` to make `projectId` optional and add `extraEnv`. **Do NOT remove any existing fields** (e.g., `namespace`):

```typescript
// In TBuildPodOpts, change projectId from required to optional, add extraEnv:
  projectId?: string    // was: projectId: string
  extraEnv?: Record<string, string>  // NEW
```

Also update `TBuildPodMeta` to make `projectId` optional (it receives the value from `TBuildPodOpts`):

```typescript
// In TBuildPodMeta, change projectId from required to optional:
  projectId?: string    // was: projectId: string
```

- [ ] **Step 5: Run type check and tests**

Run: `cd repos/sandbox && pnpm types && pnpm test`
Expected: PASS

---

## Task 5: Backend — Refactor WebSocket Server for Multi-Path Dispatch

**Files:**
- Modify: `repos/backend/src/server/wsServer.ts`

- [ ] **Step 1: Rewrite wsServer.ts for multi-path dispatch**

Replace `repos/backend/src/server/wsServer.ts`:

```typescript
import type WebSocket from 'ws'
import type { IncomingMessage } from 'http'
import type { Socket } from 'net'
import type { TApp } from '@TBE/types'

import { WebSocketServer } from 'ws'
import { logger } from '@TBE/utils/logger'
import { onWSConnect } from '@TBE/endpoints/ai/onWSConnect'
import { onTunnelConnect } from '@TBE/endpoints/sandboxes/onTunnelConnect'

type TWsHandler = (ws: WebSocket, req: IncomingMessage, app: TApp) => Promise<void>

const SANDBOX_TUNNEL_PATTERN = /^\/_\/sandboxes\/([^/]+)\/tunnel$/

/**
 * Creates a WebSocket server with path-based dispatch.
 * Uses `noServer: true` — the HTTP server's `upgrade` event is handled manually
 * so we can filter by path and route to the correct handler.
 */
export const createWSServer = (app: TApp) => {
  const wss = new WebSocketServer({ noServer: true })

  const staticRoutes = new Map<string, TWsHandler>()
  staticRoutes.set(`/ai/ws`, onWSConnect)

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = new URL(req.url || ``, `http://localhost`).pathname

    // Static route match
    const staticHandler = staticRoutes.get(pathname)
    if (staticHandler) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        staticHandler(ws, req, app).catch((err) => {
          logger.error(`WS connect error on ${pathname}`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    // Dynamic route: sandbox tunnel
    const tunnelMatch = pathname.match(SANDBOX_TUNNEL_PATTERN)
    if (tunnelMatch) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        onTunnelConnect(ws, req, app).catch((err) => {
          logger.error(`WS tunnel error`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    socket.destroy()
  }

  logger.info(`WebSocket server ready (multi-path dispatch)`)

  return { wss, onUpgrade }
}
```

- [ ] **Step 2: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: Will fail because `onTunnelConnect` doesn't exist yet. That's OK — it's created in Task 7.

---

## Task 6: Backend — SandboxService Password, Session & Idle Timeout

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandbox.ts`

- [ ] **Step 1: Add password management, session tracking, and idle timeout to SandboxService**

Add these imports and types at the top of `repos/backend/src/services/sandboxes/sandbox.ts`:

```typescript
import type { TSandboxSession } from '@tdsk/domain'
```

Then add these members to the `SandboxService` class (after the `static proxyMap` line):

```typescript
  private passwords = new Map<string, string>()
  private sessions = new Map<string, TSandboxSession[]>()
  private podActivity = new Map<string, number>()
  private idleTimer: ReturnType<typeof setInterval> | null = null
```

- [ ] **Step 2: Update startPod to generate SSH password**

Replace the existing `startPod` method:

```typescript
  async startPod(opts: TStartPodOpts): Promise<string> {
    const { orgId, userId, sandboxId, projectId, egressOpts } = opts

    const { data: sandbox, error } = await this.db.services.sandbox.get(sandboxId)
    if (error || !sandbox) throw new Error(`Sandbox config not found: ${sandboxId}`)
    if (!sandbox.config?.image)
      throw new Exception(400, `Sandbox config is missing required "image" field`)

    const placeholders: TPlaceholderMap = {}
    if (sandbox.config.secretIds) {
      for (const secretId of sandbox.config.secretIds) {
        const token = `${PhTokenPrefix}${nanoid(16)}`
        placeholders[token] = secretId
      }
    }

    const sshPassword = nanoid(24)
    const extraEnv: Record<string, string> = {
      TDSK_SSH_PASSWORD: sshPassword,
    }
    if (sandbox.config.gitRepo) {
      extraEnv.TDSK_GIT_REPO = sandbox.config.gitRepo
      if (sandbox.config.gitBranch) extraEnv.TDSK_GIT_BRANCH = sandbox.config.gitBranch
    }

    const manifest = buildPodManifest({
      orgId,
      userId,
      sandbox,
      projectId,
      egressOpts,
      placeholders,
      extraEnv,
    })

    const pod = await this.kube.createPod(manifest)
    const podName = pod.metadata?.name
    if (!podName)
      throw new Error(`Pod created but metadata.name is missing for sandbox ${sandboxId}`)

    this.passwords.set(podName, sshPassword)
    this.podActivity.set(podName, Date.now())

    return podName
  }
```

- [ ] **Step 3: Make TStartPodOpts.projectId optional**

At the top of the file, update:

```typescript
type TStartPodOpts = {
  orgId: string
  userId: string
  sandboxId: string
  projectId?: string
  egressOpts: TPodEgressOpts
}
```

- [ ] **Step 4: Add password and session management methods**

Add these methods to the `SandboxService` class:

```typescript
  getPassword(podName: string): string | undefined {
    return this.passwords.get(podName)
  }

  async recoverPassword(podName: string): Promise<string | undefined> {
    const cached = this.passwords.get(podName)
    if (cached) return cached

    try {
      const result = await this.kube.runInPod(podName, [`printenv`, `TDSK_SSH_PASSWORD`])
      if (result.success && result.output) {
        const password = result.output.trim()
        this.passwords.set(podName, password)
        return password
      }
    } catch (err) {
      logger.warn(`[Sandbox] Failed to recover password for ${podName}:`, (err as Error).message)
    }
  }

  addSession(podName: string, session: TSandboxSession): void {
    const list = this.sessions.get(podName) || []
    list.push(session)
    this.sessions.set(podName, list)
    this.podActivity.set(podName, Date.now())
  }

  removeSession(podName: string, sessionId: string): void {
    const list = this.sessions.get(podName) || []
    this.sessions.set(podName, list.filter((s) => s.sessionId !== sessionId))
    this.podActivity.set(podName, Date.now())
  }

  getSessions(podName: string): TSandboxSession[] {
    return this.sessions.get(podName) || []
  }

  updateActivity(podName: string): void {
    this.podActivity.set(podName, Date.now())
  }

  async findRunningPod(sandboxId: string, orgId: string): Promise<string | undefined> {
    const pods = await this.listPods({ orgId, state: EContainerState.Running })
    const match = pods.find(
      (p) => p.metadata?.labels?.[PodLabelKeys.sandboxId] === sandboxId
    )
    return match?.metadata?.name
  }

  cleanupPod(podName: string): void {
    this.passwords.delete(podName)
    this.sessions.delete(podName)
    this.podActivity.delete(podName)
  }
```

- [ ] **Step 5: Add idle timeout worker**

Add a `startIdleTimeout` method and call it from `initKube`:

```typescript
  startIdleTimeout(): void {
    if (this.idleTimer) return

    this.idleTimer = setInterval(async () => {
      for (const [podName, lastActivity] of this.podActivity) {
        const sessions = this.getSessions(podName)
        if (sessions.length > 0) continue

        // Look up the sandbox config to get per-sandbox timeout
        let timeoutMinutes = 30
        try {
          const pod = await this.kube.getPod(podName)
          const sandboxId = pod.metadata?.labels?.[PodLabelKeys.sandboxId]
          if (sandboxId) {
            const { data: sb } = await this.db.services.sandbox.get(sandboxId)
            if (sb?.config?.idleTimeoutMinutes) timeoutMinutes = sb.config.idleTimeoutMinutes
          }
        } catch {}

        const idleMs = Date.now() - lastActivity
        const timeoutMs = timeoutMinutes * 60 * 1000

        if (idleMs > timeoutMs) {
          logger.info(`[Sandbox] Stopping idle pod: ${podName} (idle ${Math.round(idleMs / 60000)}m)`)
          try {
            await this.stopPod(podName)
          } catch (err) {
            logger.warn(`[Sandbox] Failed to stop idle pod ${podName}:`, (err as Error).message)
          }
          this.cleanupPod(podName)
        }
      }
    }, 60_000)
  }
```

In `initKube`, after creating the `SandboxService` instance, add:

```typescript
sandbox.startIdleTimeout()
```

- [ ] **Step 6: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: Existing tests pass (new methods aren't tested yet — integration tests cover them)

---

## Task 7: Backend — WebSocket Tunnel Handler

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`

- [ ] **Step 1: Create the tunnel handler**

Create `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts`:

```typescript
import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'

import net from 'net'
import { URL } from 'url'
import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { hashKey } from '@tdsk/domain'
import { PodLabelKeys } from '@tdsk/sandbox'

const BACKPRESSURE_THRESHOLD = 64 * 1024

/**
 * Handle WebSocket tunnel connections for SSH access to sandbox pods.
 *
 * Auth: API key in Authorization header (validated here, not by Express middleware).
 * Path: /_/sandboxes/:id/tunnel
 * Protocol: Binary WebSocket frames bridged to TCP on pod:2222.
 */
export const onTunnelConnect = async (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): Promise<void> => {
  const { db, sandbox: sbService, kube } = app.locals

  // 1. Extract sandbox ID from URL
  const pathname = new URL(req.url || ``, `http://localhost`).pathname
  const match = pathname.match(/^\/_\/sandboxes\/([^/]+)\/tunnel$/)
  if (!match) {
    ws.close(4000, `Invalid tunnel path`)
    return
  }
  const sandboxId = match[1]

  // 2. Authenticate via API key
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith(`Bearer `)) {
    ws.close(4001, `Authorization required`)
    return
  }

  const token = authHeader.slice(7)
  const keyHash = hashKey(token)
  const { data: apiKey, error: keyErr } = await db.services.apiKey.getByHash(keyHash)
  if (keyErr || !apiKey || !apiKey.isValid()) {
    ws.close(4001, `Invalid or expired API key`)
    return
  }

  const orgId = apiKey.orgId
  const userId = apiKey.userId
  if (!orgId || !userId) {
    ws.close(4001, `API key missing org or user scope`)
    return
  }

  // 3. Find running pod for this sandbox
  if (!sbService || !kube) {
    ws.close(4003, `Sandbox service not available`)
    return
  }

  const podName = await sbService.findRunningPod(sandboxId, orgId)
  if (!podName) {
    ws.close(4004, `No running pod for sandbox ${sandboxId}`)
    return
  }

  // 4. Validate pod ownership
  try {
    await sbService.validatePodOwnership(podName, orgId)
  } catch {
    ws.close(4003, `Pod access denied`)
    return
  }

  // 5. Look up pod IP
  const pod = await kube.getPod(podName)
  const podIp = pod.status?.podIP
  if (!podIp) {
    ws.close(4004, `Pod has no IP address`)
    return
  }

  // 6. Open TCP connection to pod SSH port
  const tcp = net.createConnection({ host: podIp, port: 2222 })

  const sessionId = nanoid(12)
  let closed = false

  const cleanup = () => {
    if (closed) return
    closed = true
    sbService.removeSession(podName, sessionId)
    tcp.destroy()
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close()
    }
  }

  // Register session
  sbService.addSession(podName, {
    sessionId,
    podName,
    sandboxId,
    userId,
    orgId,
    connectedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  })

  // 7. Bridge WebSocket ↔ TCP
  tcp.on(`connect`, () => {
    logger.info(`[Tunnel] Connected to pod ${podName}:2222 (session ${sessionId})`)
  })

  tcp.on(`data`, (chunk: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(chunk)
      // TCP-to-WS backpressure
      if (ws.bufferedAmount > BACKPRESSURE_THRESHOLD) {
        tcp.pause()
        const drain = () => {
          if (ws.bufferedAmount <= BACKPRESSURE_THRESHOLD) {
            tcp.resume()
          } else {
            setTimeout(drain, 10)
          }
        }
        setTimeout(drain, 10)
      }
    }
  })

  ws.on(`message`, (data: Buffer) => {
    if (!tcp.destroyed) {
      const ok = tcp.write(data)
      if (!ok) {
        ws.pause?.()
        tcp.once(`drain`, () => ws.resume?.())
      }
    }
    sbService.updateActivity(podName)
  })

  tcp.on(`error`, (err) => {
    logger.error(`[Tunnel] TCP error for ${podName}:`, err.message)
    cleanup()
  })

  tcp.on(`close`, () => {
    logger.info(`[Tunnel] TCP closed for ${podName} (session ${sessionId})`)
    cleanup()
  })

  ws.on(`close`, () => {
    logger.info(`[Tunnel] WebSocket closed for ${podName} (session ${sessionId})`)
    cleanup()
  })

  ws.on(`error`, (err) => {
    logger.error(`[Tunnel] WebSocket error for ${podName}:`, err.message)
    cleanup()
  })

  // 8. Keepalive pings (every 30s) to prevent Caddy idle timeout
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping()
    } else {
      clearInterval(pingInterval)
    }
  }, 30_000)

  ws.on(`close`, () => clearInterval(pingInterval))
}
```

- [ ] **Step 2: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS — wsServer.ts imports onTunnelConnect which now exists

---

## Task 8: Backend — Connect Endpoint & List Sessions

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/connectSandbox.ts`
- Create: `repos/backend/src/endpoints/sandboxes/listSessions.ts`

- [ ] **Step 1: Create connectSandbox endpoint**

Create `repos/backend/src/endpoints/sandboxes/connectSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EContainerState, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

const MAX_WAIT_MS = 120_000
const POLL_INTERVAL_MS = 2_000

export const connectSandbox: TEndpointConfig = {
  path: `/:id/connect`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db, config } = req.app.locals

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (sb) => ({ orgId: sb.orgId })
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    // Find or start a pod
    let podName = await sb.findRunningPod(id, sandbox.orgId)

    if (!podName) {
      // Auto-start the pod
      podName = await sb.startPod({
        sandboxId: id,
        orgId: sandbox.orgId,
        userId: req.user!.id,
        projectId: sandbox.projectId,
        egressOpts: config.egress,
      })

      // Poll until Running
      const start = Date.now()
      let state = EContainerState.Pending
      while (state !== EContainerState.Running && Date.now() - start < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
        state = await sb.getPodState(podName)
        if (state === EContainerState.Failed) {
          throw new Exception(500, `Pod failed to start`)
        }
      }

      if (state !== EContainerState.Running) {
        throw new Exception(504, `Pod did not reach Running state within timeout`)
      }
    }

    // Get or recover password
    let password = sb.getPassword(podName)
    if (!password) {
      password = await sb.recoverPassword(podName)
    }
    if (!password) {
      throw new Exception(500, `Could not retrieve SSH password for pod`)
    }

    res.status(200).json({
      data: {
        password,
        podName,
        sandboxId: id,
        host: podName,
        port: 2222,
        command: `tsa ssh ${id}`,
      },
    })
  },
}
```

- [ ] **Step 2: Create listSessions endpoint**

Create `repos/backend/src/endpoints/sandboxes/listSessions.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const listSessions: TEndpointConfig = {
  path: `/:id/sessions`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.read,
      EPermResource.sandbox,
      `Sandbox`,
      (sb) => ({ orgId: sb.orgId })
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    const podName = await sb.findRunningPod(id, sandbox.orgId)
    const sessions = podName ? sb.getSessions(podName) : []

    res.status(200).json({ data: sessions })
  },
}
```

- [ ] **Step 3: Register new endpoints in sandboxes router**

In `repos/backend/src/endpoints/sandboxes/sandboxes.ts`, add imports and register:

```typescript
import { connectSandbox } from '@TBE/endpoints/sandboxes/connectSandbox'
import { listSessions } from '@TBE/endpoints/sandboxes/listSessions'
```

Add to the `endpoints` object:

```typescript
  endpoints: {
    getSandbox,
    stopSandbox,
    startSandbox,
    listSandboxes,
    execInSandbox,
    createSandbox,
    updateSandbox,
    deleteSandbox,
    getSandboxStatus,
    connectSandbox,
    listSessions,
  },
```

- [ ] **Step 4: Run backend type check and tests**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: PASS

---

## Task 9: Backend — Update Existing Endpoints for projectId

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/createSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/updateSandbox.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/listSandboxes.ts`
- Modify: `repos/backend/src/endpoints/sandboxes/startSandbox.ts`

- [ ] **Step 1: Update createSandbox to accept projectId**

In `repos/backend/src/endpoints/sandboxes/createSandbox.ts`, add `projectId` to the destructured body and pass it to the Sandbox constructor:

```typescript
    const { name, config, projectId } = req.body
    // ...
    const sandboxData = new Sandbox({
      name,
      orgId,
      config,
      projectId,
      userId: req.user?.id,
    })
```

- [ ] **Step 2: Update updateSandbox to accept projectId**

In `repos/backend/src/endpoints/sandboxes/updateSandbox.ts`, add `projectId` to the destructured body and the update call:

```typescript
    const { name, config, projectId } = req.body
    const { data, error } = await db.services.sandbox.update({
      id,
      ...(name !== undefined && { name }),
      ...(config !== undefined && { config }),
      ...(projectId !== undefined && { projectId }),
    })
```

- [ ] **Step 3: Update listSandboxes to support projectId filter**

In `repos/backend/src/endpoints/sandboxes/listSandboxes.ts`, add project filtering:

```typescript
    const projectId = req.query.projectId as string | undefined

    const where: Record<string, any> = { orgId }
    if (projectId) where.projectId = projectId

    const { data, error } = await db.services.sandbox.list({
      limit,
      offset,
      where,
    })
```

- [ ] **Step 4: Update startSandbox to use sandbox's stored projectId**

In `repos/backend/src/endpoints/sandboxes/startSandbox.ts`, change the `projectId` source:

```typescript
    // Use body projectId as override, fall back to sandbox's stored projectId
    const projectId = req.body.projectId || sandbox.projectId

    const podName = await sb.startPod({
      projectId,
      sandboxId: id,
      orgId: sandbox.orgId,
      userId: req.user!.id,
      egressOpts: config.egress,
    })
```

Remove the `if (!projectId) throw` line — projectId is now optional.

- [ ] **Step 5: Run backend type check and tests**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: PASS

---

## Task 10: Admin UI — Routes, Navigation & Project Sandboxes Page

**Files:**
- Modify: `repos/admin/src/types/routes.types.ts`
- Modify: `repos/admin/src/constants/nav.tsx`
- Modify: `repos/admin/src/routes/Routes.tsx`
- Modify: `repos/admin/src/routes/loaders.ts`
- Create: `repos/admin/src/pages/Projects/ProjectSandboxes.tsx`

- [ ] **Step 1: Add ProjectSandboxes route enum**

In `repos/admin/src/types/routes.types.ts`, add after the `OrgSandboxes` line:

```typescript
  ProjectSandboxes = `/orgs/:orgId/projects/:projectId/sandboxes`,
```

- [ ] **Step 2: Add Sandboxes to project navigation**

In `repos/admin/src/constants/nav.tsx`, add to `ProjectSubNav` (after `Agents`):

```typescript
  Sandboxes: {
    text: `Sandboxes`,
    to: buildRoute(ERoutePath.ProjectSandboxes),
    Icon: <DrawingBoxIcon />,
    visible: hasOrgAndProject,
  },
```

Add to `ProjectSubNavGroups` Development group:

```typescript
  {
    label: `Development`,
    items: [ProjectSubNav.Endpoints, ProjectSubNav.Functions, ProjectSubNav.Agents, ProjectSubNav.Sandboxes],
  },
```

- [ ] **Step 3: Add projectSandboxesLoader**

In `repos/admin/src/routes/loaders.ts`, add:

```typescript
export const projectSandboxesLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, projectId } = params
  if (!orgId) throw new Response('Organization ID required', { status: 400 })
  if (!projectId) throw new Response('Project ID required', { status: 400 })

  if (!getSandboxes()) await safeFetch(() => fetchSandboxes({ orgId }))
  return null
}
```

- [ ] **Step 4: Add project sandbox route**

In `repos/admin/src/routes/Routes.tsx`, inside the `ERoutePath.ProjectId` children array, add after the Agents route:

```typescript
    {
      path: ERoutePath.Sandboxes,
      loader: projectSandboxesLoader,
      Component: () => <SuspensePage Component={ProjectSandboxes} />,
    },
```

Add the import at the top:

```typescript
import { ProjectSandboxes } from '@TAF/pages/Projects/ProjectSandboxes'
import { projectSandboxesLoader } from '@TAF/routes/loaders'
```

- [ ] **Step 5: Create ProjectSandboxes page**

Create `repos/admin/src/pages/Projects/ProjectSandboxes.tsx`:

```typescript
import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { Sandboxes } from '@TAF/components/Sandboxes/Sandboxes'

export type TProjectSandboxes = {}

export const ProjectSandboxes = (props: TProjectSandboxes) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  return (
    <Page className='tdsk-project-sandboxes-page'>
      <Sandboxes orgId={orgId} projectId={projectId} />
    </Page>
  )
}

export default ProjectSandboxes
```

- [ ] **Step 6: Add useProjectSandboxes selector**

In `repos/admin/src/state/selectors.ts` (or wherever `useSandboxes` is defined), add:

```typescript
export const useProjectSandboxes = () => {
  const [sandboxes] = useSandboxes()
  const [projectId] = useActiveProjectId()
  return useMemo(() => {
    if (!sandboxes || !projectId) return {}
    return Object.fromEntries(
      Object.entries(sandboxes).filter(([, sb]) => sb.projectId === projectId)
    )
  }, [sandboxes, projectId])
}
```

- [ ] **Step 7: Run admin type check**

Run: `cd repos/admin && pnpm types`
Expected: PASS (or minor issues from Sandboxes component changes needed in next task)

---

## Task 11: Admin UI — SandboxApi Service Lifecycle Methods

**Files:**
- Modify: `repos/admin/src/services/sandboxApi.ts`

- [ ] **Step 1: Add lifecycle methods to SandboxApi**

In `repos/admin/src/services/sandboxApi.ts`, add these methods:

```typescript
  async start(orgId: string, id: string, data?: { projectId?: string }): Promise<TApiRes<{ podName: string }>> {
    const resp = await this.api.post<{ podName: string }>({
      data,
      path: `${this.#path(orgId)}/${id}/start`,
    })
    resp.error && (await this._onError(resp.error, `Failed to start sandbox`))
    return resp
  }

  async stop(orgId: string, id: string, podName: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      data: { podName },
      path: `${this.#path(orgId)}/${id}/stop`,
    })
    resp.error && (await this._onError(resp.error, `Failed to stop sandbox`))
    return resp
  }

  async connect(orgId: string, id: string): Promise<TApiRes<TSandboxConnectResponse>> {
    const resp = await this.api.post<TSandboxConnectResponse>({
      path: `${this.#path(orgId)}/${id}/connect`,
    })
    resp.error && (await this._onError(resp.error, `Failed to connect to sandbox`))
    return resp
  }

  async status(orgId: string, id: string, podName: string): Promise<TApiRes<{ podName: string; state: string }>> {
    const resp = await this.api.get<{ podName: string; state: string }>({
      path: `${this.#path(orgId)}/${id}/status?podName=${podName}`,
    })
    resp.error && (await this._onError(resp.error, `Failed to get sandbox status`))
    return resp
  }

  async sessions(orgId: string, id: string): Promise<TApiRes<TSandboxSession[]>> {
    const resp = await this.api.get<TSandboxSession[]>({
      path: `${this.#path(orgId)}/${id}/sessions`,
    })
    resp.error && (await this._onError(resp.error, `Failed to get sandbox sessions`))
    return resp
  }
```

---

## Task 12: Admin UI — Sandboxes Component Context Awareness & Actions

**Files:**
- Modify: `repos/admin/src/components/Sandboxes/Sandboxes.tsx`
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`
- Create: `repos/admin/src/components/Sandboxes/ConnectModal.tsx`
- Create: `repos/admin/src/actions/sandboxes/api/startSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/api/stopSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/api/connectSandbox.ts`

This task modifies existing React components with substantial UI changes. The implementation agent should:

- [ ] **Step 1: Read the existing Sandboxes.tsx and SandboxDrawer.tsx completely**
- [ ] **Step 2: Update Sandboxes.tsx to accept `projectId?` prop and add context filtering**

Add context awareness (mirror the Secrets component pattern):
```typescript
type TSandboxes = { orgId: string; projectId?: string }
// ...
const isProjectContext = !!projectId
const isOrgContext = !!orgId && !projectId

const contextFiltered = sandboxesArray.filter((sb) => {
  if (isProjectContext) return sb.projectId === projectId
  if (isOrgContext) return sb.orgId === orgId
  return false
})
```

Add action buttons (Start/Stop/Connect) to the actions column. Add a Status column showing Running/Stopped with colored Chip. Add a Project column (org-level only).

- [ ] **Step 3: Create API action files**

Create `repos/admin/src/actions/sandboxes/api/startSandbox.ts`:
```typescript
import { sandboxApi } from '@TAF/services'

export const startSandbox = async (opts: { orgId: string; sandboxId: string; projectId?: string }) => {
  const { orgId, sandboxId, projectId } = opts
  return sandboxApi.start(orgId, sandboxId, projectId ? { projectId } : undefined)
}
```

Create `repos/admin/src/actions/sandboxes/api/stopSandbox.ts`:
```typescript
import { sandboxApi } from '@TAF/services'

export const stopSandbox = async (opts: { orgId: string; sandboxId: string; podName: string }) => {
  return sandboxApi.stop(opts.orgId, opts.sandboxId, opts.podName)
}
```

Create `repos/admin/src/actions/sandboxes/api/connectSandbox.ts`:
```typescript
import { sandboxApi } from '@TAF/services'

export const connectSandbox = async (opts: { orgId: string; sandboxId: string }) => {
  return sandboxApi.connect(opts.orgId, opts.sandboxId)
}
```

- [ ] **Step 4: Create ConnectModal**

Create `repos/admin/src/components/Sandboxes/ConnectModal.tsx` — a MUI Dialog showing:
- SSH command: `tsa ssh <sandbox-id>` with copy button
- Pod status and uptime
- Active session count
- Stop Sandbox button

- [ ] **Step 5: Update SandboxDrawer to accept projectId and add new form fields**

Add `projectId?` prop. When in project context, set it on create. Add form sections for: image presets (Claude Code/Codex/OpenCode buttons), SSH toggle, Git repo URL + branch, idle timeout minutes.

- [ ] **Step 6: Update createSandbox action to pass projectId**

In `repos/admin/src/actions/sandboxes/api/createSandbox.ts`, add projectId support:
```typescript
export type TCreateSandboxOpts = {
  orgId: string
  projectId?: string
  data: Partial<Sandbox>
}

export const createSandbox = async (opts: TCreateSandboxOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await sandboxApi.create(orgId, { ...data, projectId })
  // ...
}
```

- [ ] **Step 7: Create remaining admin API action files**

Create `repos/admin/src/actions/sandboxes/api/getSandboxStatus.ts`:
```typescript
import { sandboxApi } from '@TAF/services'

export const getSandboxStatus = async (opts: { orgId: string; sandboxId: string; podName: string }) => {
  return sandboxApi.status(opts.orgId, opts.sandboxId, opts.podName)
}
```

Create `repos/admin/src/actions/sandboxes/api/getSandboxSessions.ts`:
```typescript
import { sandboxApi } from '@TAF/services'

export const getSandboxSessions = async (opts: { orgId: string; sandboxId: string }) => {
  return sandboxApi.sessions(opts.orgId, opts.sandboxId)
}
```

Update `repos/admin/src/actions/sandboxes/api/updateSandbox.ts` to accept `projectId`:
```typescript
// Add projectId to the data spread:
const resp = await sandboxApi.update(orgId, id, { ...data, projectId })
```

- [ ] **Step 8: Run admin build**

Run: `cd repos/admin && pnpm build`
Expected: Build succeeds

> **Note for implementation agent**: Task 12 Steps 2, 4, and 5 require reading existing component code (`Sandboxes.tsx`, `SandboxDrawer.tsx`) before writing changes. Load the `tdsk-admin` skill (`/.claude/skills/tdsk-admin/SKILL.md`) for full component patterns. The ConnectModal should include the VS Code Remote SSH config snippet from the spec (lines 66-72) as a copyable section below the `tsa ssh` command.

---

## Task 13: REPL CLI — sandboxes, proxy, and ssh Commands

**Files:**
- Create: `repos/repl/src/tasks/sandboxes.ts`
- Create: `repos/repl/src/tasks/proxy.ts`
- Create: `repos/repl/src/tasks/ssh.ts`
- Modify: `repos/repl/src/tasks/index.ts`
- Modify: `repos/repl/src/services/api.ts`

- [ ] **Step 1: Add sandbox API methods to ApiClient**

In `repos/repl/src/services/api.ts`, add:

```typescript
  async listSandboxes(orgId: string): Promise<any[]> {
    return this.#requestWithRetry<any[]>(`/orgs/${orgId}/sandboxes`)
  }

  async connectSandbox(orgId: string, sandboxId: string): Promise<any> {
    return this.#postRequest<any>(`/orgs/${orgId}/sandboxes/${sandboxId}/connect`, {})
  }
```

- [ ] **Step 2: Create sandboxes task**

Create `repos/repl/src/tasks/sandboxes.ts`:

```typescript
import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const sandboxes: TTask = {
  name: `sandboxes`,
  alias: [`sandbox`, `sb`],
  description: `List sandbox configurations`,
  example: `tsa sandboxes [--org <id>]`,
  options: {
    org: {
      type: `str`,
      example: `--org org_xxx`,
      description: `Organization ID`,
    },
  },
  action: requireAuth(async ({ params, auth }) => {
    const client = new ApiClient(auth)

    try {
      let orgId = params.org as string | undefined
      if (!orgId) {
        const orgs = await client.listOrgs()
        if (orgs.length === 1) {
          orgId = orgs[0].id
        } else {
          process.stdout.write(`\n${themed(`bold`, `Organizations:`)}\n`)
          for (const org of orgs) {
            process.stdout.write(`  ${themed(`muted`, org.id)} ${org.name}\n`)
          }
          process.stdout.write(
            `\n${themed(`muted`, `Use --org <id> to list sandboxes for a specific org`)}\n\n`
          )
          return
        }
      }

      const list = await client.listSandboxes(orgId)

      if (!list.length) {
        process.stdout.write(`${themed(`muted`, `No sandboxes found`)}\n`)
        return
      }

      process.stdout.write(`\n${themed(`bold`, `Sandboxes:`)}\n`)
      const nameW = 20
      const imageW = 30
      process.stdout.write(
        `  ${`Name`.padEnd(nameW)} ${`Image`.padEnd(imageW)} ID\n`
      )
      process.stdout.write(`  ${`─`.repeat(nameW)} ${`─`.repeat(imageW)} ${'─'.repeat(12)}\n`)
      for (const sb of list) {
        const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
        const image = (sb.config?.image || `-`).slice(0, imageW).padEnd(imageW)
        process.stdout.write(`  ${name} ${themed(`muted`, image)} ${themed(`muted`, sb.id)}\n`)
      }
      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list sandboxes`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }
  }),
}
```

- [ ] **Step 3: Create proxy task (ProxyCommand binary bridge)**

Create `repos/repl/src/tasks/proxy.ts`:

```typescript
import type { TTask } from '@TRL/types'

import WebSocket from 'ws'

/**
 * ProxyCommand transport for SSH tunneling.
 * Called by SSH client, NOT by user directly.
 * Bridges stdin/stdout ↔ WebSocket binary frames to backend tunnel endpoint.
 */
export const proxy: TTask = {
  name: `proxy`,
  alias: [],
  description: `SSH ProxyCommand transport (internal)`,
  example: `tsa proxy <sandbox-id>`,
  options: {},
  action: async ({ auth, options }) => {
    const sandboxId = options?.[0]
    if (!sandboxId) {
      process.stderr.write(`Usage: tsa proxy <sandbox-id>\n`)
      process.exit(1)
    }

    const creds = auth.creds()
    if (!creds) {
      process.stderr.write(`Not logged in. Run "tsa login" first.\n`)
      process.exit(1)
    }

    // Build WebSocket URL from proxy URL
    const wsUrl = creds.proxyUrl
      .replace(/^https:/, `wss:`)
      .replace(/^http:/, `ws:`)

    const tunnelUrl = `${wsUrl}/_/sandboxes/${sandboxId}/tunnel`

    const ws = new WebSocket(tunnelUrl, {
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
      },
      rejectUnauthorized: !creds.insecure,
    })

    ws.binaryType = `nodebuffer`

    ws.on(`open`, () => {
      // Bridge stdin → WebSocket
      process.stdin.on(`data`, (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk)
        }
      })

      process.stdin.on(`end`, () => {
        ws.close()
      })

      // Bridge WebSocket → stdout
      ws.on(`message`, (data: Buffer) => {
        process.stdout.write(data)
      })
    })

    ws.on(`close`, (code, reason) => {
      if (code !== 1000 && code !== 1005) {
        process.stderr.write(`Tunnel closed: ${code} ${reason?.toString() || ``}\n`)
      }
      process.exit(0)
    })

    ws.on(`error`, (err) => {
      process.stderr.write(`Tunnel error: ${err.message}\n`)
      process.exit(1)
    })

    // Keep process alive
    process.stdin.resume()
  },
}
```

- [ ] **Step 4: Create ssh task**

Create `repos/repl/src/tasks/ssh.ts`:

```typescript
import type { TTask } from '@TRL/types'

import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, chmodSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox-id> [--org <id>]`,
  options: {
    org: {
      type: `str`,
      example: `--org org_xxx`,
      description: `Organization ID`,
    },
  },
  action: requireAuth(async ({ params, auth, options }) => {
    const sandboxId = options?.[0]
    if (!sandboxId) {
      process.stdout.write(
        `${themed('warning', `Usage: tsa ssh <sandbox-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)
    let orgId = params.org as string | undefined

    if (!orgId) {
      const orgs = await client.listOrgs()
      if (orgs.length === 1) {
        orgId = orgs[0].id
      } else {
        process.stdout.write(
          `${themed('warning', `Multiple orgs found. Use --org <id> to specify.`)}\n`
        )
        process.exit(1)
      }
    }

    process.stdout.write(`${themed('muted', `Connecting to sandbox "${sandboxId}"...`)}\n`)

    // Call connect endpoint (auto-starts pod if needed)
    let connectResp: any
    try {
      connectResp = await client.connectSandbox(orgId, sandboxId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to connect`
      process.stdout.write(`${themed('error', `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    const { password } = connectResp
    if (!password) {
      process.stdout.write(`${themed('error', `Error: No password returned from server`)}\n`)
      process.exit(1)
    }

    process.stdout.write(`${themed('muted', `SSH session ready.`)}\n`)

    // Create temp SSH_ASKPASS script
    const askpassPath = join(tmpdir(), `.tdsk-askpass-${Date.now()}`)
    writeFileSync(askpassPath, `#!/bin/bash\necho "${password}"\n`)
    chmodSync(askpassPath, 0o700)

    const cleanup = () => {
      try { unlinkSync(askpassPath) } catch {}
    }

    process.on(`SIGINT`, cleanup)
    process.on(`SIGTERM`, cleanup)

    // Resolve path to `tsa` binary for ProxyCommand
    const tsaBin = process.argv[0] || `tsa`
    const tsaScript = process.argv[1] || ``

    // Build ProxyCommand — handles both `bun run cli.ts` and compiled binary
    const proxyCmd = tsaScript
      ? `${tsaBin} ${tsaScript} proxy ${sandboxId}`
      : `${tsaBin} proxy ${sandboxId}`

    try {
      const sshProc = spawn(`ssh`, [
        `-o`, `ProxyCommand=${proxyCmd}`,
        `-o`, `StrictHostKeyChecking=no`,
        `-o`, `UserKnownHostsFile=/dev/null`,
        `-o`, `LogLevel=ERROR`,
        `sandbox@${sandboxId}`,
      ], {
        stdio: `inherit`,
        env: {
          ...process.env,
          SSH_ASKPASS: askpassPath,
          SSH_ASKPASS_REQUIRE: `force`,
          DISPLAY: `:0`,
        },
      })

      await new Promise<void>((resolve) => {
        sshProc.on(`close`, () => resolve())
        sshProc.on(`error`, (err) => {
          process.stderr.write(`SSH error: ${err.message}\n`)
          resolve()
        })
      })
    } finally {
      cleanup()
    }
  }),
}
```

- [ ] **Step 5: Register new tasks**

In `repos/repl/src/tasks/index.ts`:

```typescript
import type { TTasks } from '@TRL/types'

import { ssh } from './ssh'
import { login } from './login'
import { logout } from './logout'
import { proxy } from './proxy'
import { status } from './status'
import { agents } from './agents'
import { threads } from './threads'
import { chat } from './chat'
import { help } from './help'
import { sandboxes } from './sandboxes'

export const tasks: TTasks = {
  ssh,
  chat,
  help,
  login,
  logout,
  proxy,
  status,
  agents,
  threads,
  sandboxes,
}
```

- [ ] **Step 6: Run REPL type check and tests**

Run: `cd repos/repl && pnpm types && pnpm test`
Expected: PASS

---

## Task 14: Full Build Verification

- [ ] **Step 1: Run full type check across all repos**

Run: `pnpm types` (from repo root)
Expected: All repos pass

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test` (from repo root)
Expected: All existing tests pass

- [ ] **Step 3: Build backend and admin**

Run: `pnpm --filter @tdsk/backend build && pnpm --filter @tdsk/admin build`
Expected: Both build successfully

---

## Deferred Items (add to TASKS.md)

- **WebSocket browser terminal** — xterm.js in admin UI for in-browser terminal access to sandboxes
- **Persistent volume claims** — PVC support so workspace data survives pod restarts
- **Concurrent session limits** — Tie to subscription tier quotas (max sandboxes per org/user)
- **Sandbox quota tracking** — Add sandboxes as a tracked resource type in quotas system
- **Dedicated SSH gateway** — Extract SSH tunneling to a dedicated K8s service if backend strain becomes an issue
- **SSH certificate auth** — Replace password auth with CA-signed SSH certificates
- **K8s NetworkPolicy** — Restrict ingress to port 2222 on sandbox pods to backend pod IP range only
