# Kubernetes Dynamic Pod Sandbox — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new `ESandboxType.kubernetes` sandbox that provisions real K8s pods as persistent workspaces for AI agent execution, with transparent secret security via iptables + MITM proxy.

**Architecture:** Code lives in `repos/sandbox/src/kube/` (imported by backend). K8s is the runtime source of truth (hydration pattern). DB stores config blueprints only. iptables init container + MITM proxy + NetworkPolicy ensure secrets never enter pods.

**Tech Stack:** `@kubernetes/client-node`, Express 5, Drizzle ORM, React/MUI/Jotai, DevSpace RBAC, `node-http-mitm-proxy`

**Design Document:** `docs/plans/2026-03-07-kubernetes-sandbox-design.md`

---

## Phase 1: Domain Types

### Task 1: Add Kubernetes Sandbox Types to Domain

**Files:**
- Modify: `repos/domain/src/types/sandbox.types.ts`
- Modify: `repos/domain/src/types/index.ts`

**Step 1: Add `kubernetes` to ESandboxType enum and new types**

Add to `repos/domain/src/types/sandbox.types.ts`:

```typescript
// Update enum
export enum ESandboxType {
  local = `local`,
  kubernetes = `kubernetes`,
}

// ISandbox interface — evaluate stays REQUIRED
// KubeSandbox implements it by writing code to a temp file and running via exec
// No changes to the interface itself — just add kubernetes to the enum

// --- New K8s sandbox types ---

export type TPortConfig = {
  protocol: 'http' | 'https'
}

export type TSandboxRuntime = {
  name: string        // 'node', 'python'
  command: string     // 'node', 'python3'
  extension: string   // '.js', '.py'
}

export type TKubeSandboxConfig = {
  image: string
  command?: string[]
  args?: string[]
  workdir?: string
  ports?: Record<string, TPortConfig>
  envVars?: Record<string, string>
  resources?: {
    limits?: { cpu?: string; memory?: string }
    requests?: { cpu?: string; memory?: string }
  }
  secretIds?: string[]
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never'
  imagePullSecret?: string
  runtimes?: TSandboxRuntime[]     // Available code runtimes in this sandbox image
  defaultRuntime?: string          // Matches runtime.name — used by evaluate()
}

export type TPlaceholderMap = Record<string, string>

export enum EContainerState {
  Pending = `Pending`,
  Running = `Running`,
  Succeeded = `Succeeded`,
  Failed = `Failed`,
  Unknown = `Unknown`,
}

export type TContainerMeta = {
  podIp: string
  state: EContainerState
  sandboxId: string
  podName: string
}

export type TRouteEntry = {
  host: string
  port: number
  protocol: 'http' | 'https'
}

export type TRouteMapEntry = {
  meta: TContainerMeta
  ports: Record<string, TRouteEntry>
}

export type TRouteMap = Record<string, TRouteMapEntry>
```

**Step 2: Verify sandbox.types.ts is already exported from types index**

Check `repos/domain/src/types/index.ts` — it should already export sandbox types. If not, add:
```typescript
export * from '@TDM/types/sandbox.types'
```

**Step 3: Run type checks**

Run: `cd repos/domain && pnpm types`
Expected: PASS (no type errors)

**Step 4: Verify LocalSandbox still compiles**

No changes to `ISandbox` interface — `evaluate` stays required. Both `LocalSandbox` and `KubeSandbox` will implement it. Verify:

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

**Step 5: Run existing sandbox tests**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass (57/57)

---

### Task 2: Create Sandbox Domain Model

**Files:**
- Create: `repos/domain/src/models/sandbox.ts`
- Modify: `repos/domain/src/models/index.ts`

**Step 1: Create the Sandbox model class**

Create `repos/domain/src/models/sandbox.ts`:

```typescript
import type { TKubeSandboxConfig } from '@TDM/types'

import { Base } from './base'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  config: TKubeSandboxConfig

  constructor(data: TSandboxData) {
    super()
    Object.assign(this, data)
  }
}
```

**Step 2: Export from models index**

Add to `repos/domain/src/models/index.ts`:

```typescript
export { Sandbox } from './sandbox'
```

**Step 3: Run type checks**

Run: `cd repos/domain && pnpm types`
Expected: PASS

---

## Phase 2: Database Schema & Service

### Task 3: Create Sandboxes Database Schema

**Files:**
- Create: `repos/database/src/schemas/sandboxes.ts`
- Modify: `repos/database/src/schemas/index.ts`

**Step 1: Create the sandboxes table schema**

Create `repos/database/src/schemas/sandboxes.ts`:

```typescript
import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { users } from '@TDB/schemas/users'
import { organizations } from '@TDB/schemas/organizations'
import { text, jsonb, varchar, index, pgTable } from 'drizzle-orm/pg-core'

import type { TKubeSandboxConfig } from '@tdsk/domain'

export const sandboxes = pgTable(
  `sandboxes`,
  {
    ...base,
    name: text(`name`).notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => organizations.id, { onDelete: `cascade` })
      .notNull(),
    userId: varchar(`user_id`, { length: 10 })
      .references(() => users.id, { onDelete: `set null` }),
    config: jsonb(`config`).notNull().$type<TKubeSandboxConfig>(),
  },
  (table) => [
    index(`sandboxes_org_idx`).on(table.orgId),
    index(`sandboxes_org_user_idx`).on(table.orgId, table.userId),
  ]
)

export const sandboxesRelations = relations(sandboxes, ({ one }) => ({
  org: one(organizations, {
    references: [organizations.id],
    fields: [sandboxes.orgId],
  }),
  user: one(users, {
    references: [users.id],
    fields: [sandboxes.userId],
  }),
}))
```

**Step 2: Export from schemas index**

Add to `repos/database/src/schemas/index.ts` (follow existing pattern — add alongside other schema exports):

```typescript
export { sandboxes, sandboxesRelations } from '@TDB/schemas/sandboxes'
```

**Step 3: Run type checks**

Run: `cd repos/database && pnpm types`
Expected: PASS

---

### Task 4: Add activeSandboxes to Quotas Schema

**Files:**
- Modify: `repos/database/src/schemas/quotas.ts`

**Step 1: Add the activeSandboxes field**

Add to the quotas pgTable definition in `repos/database/src/schemas/quotas.ts`, after the existing resource fields:

```typescript
activeSandboxes: integer(`active_sandboxes`).default(0).notNull(),
```

Import `integer` from `drizzle-orm/pg-core` if not already imported.

**Step 2: Run type checks**

Run: `cd repos/database && pnpm types`
Expected: PASS

**Step 3: Run existing database tests**

Run: `cd repos/database && pnpm test`
Expected: All tests pass

---

### Task 5: Create Sandbox Database Service

**Files:**
- Create: `repos/database/src/services/sandbox.ts`
- Modify: `repos/database/src/services/index.ts`

**Step 1: Create the Sandbox DB service**

Create `repos/database/src/services/sandbox.ts`:

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
}
```

**Step 2: Add DB type definitions**

Add to `repos/database/src/types/` (wherever `TDBEndpointSelect` etc. are defined):

```typescript
import type { sandboxes } from '@TDB/schemas/sandboxes'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

export type TDBSandboxSelect = InferSelectModel<typeof sandboxes>
export type TDBSandboxInsert = InferInsertModel<typeof sandboxes>
```

**Step 3: Export from services index**

Add to `repos/database/src/services/index.ts`:

```typescript
export { Sandbox as sandbox } from './sandbox'
```

**Step 4: Run type checks**

Run: `cd repos/database && pnpm types`
Expected: PASS

**Step 5: Run database tests**

Run: `cd repos/database && pnpm test`
Expected: All tests pass

---

## Phase 3: K8s Core — KubeClient & Pod Manifest

### Task 6: Install @kubernetes/client-node dependency

**Files:**
- Modify: `repos/sandbox/package.json`

**Step 1: Add the dependency**

Run: `cd repos/sandbox && pnpm add @kubernetes/client-node`

**Step 2: Verify installation**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 7: Create K8s Sandbox Types

**Files:**
- Create: `repos/sandbox/src/types/kube.types.ts`

**Step 1: Create K8s-specific sandbox types**

Create `repos/sandbox/src/types/kube.types.ts`:

```typescript
import type { V1Pod } from '@kubernetes/client-node'

export type TKubeEventType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'BOOKMARK' | 'ERROR'

export type TKubeEventHandlers = {
  added?: (pod: V1Pod) => void
  modified?: (pod: V1Pod) => void
  deleted?: (pod: V1Pod) => void
  bookmark?: (pod: V1Pod) => void
  error?: (err: any) => void
}

export type TKubeClientConfig = {
  namespace?: string
  inCluster?: boolean
}

export const PodLabelKeys = {
  managed: 'tdsk.app/managed',
  sandboxId: 'tdsk.app/sandbox-id',
  userId: 'tdsk.app/user-id',
  projectId: 'tdsk.app/project-id',
  orgId: 'tdsk.app/org-id',
} as const

export const PodAnnotationKeys = {
  ports: 'tdsk.app/ports',
  placeholders: 'tdsk.app/placeholders',
  subdomain: 'tdsk.app/subdomain',
} as const
```

---

### Task 8: Create KubeClient — K8s API Wrapper

**Files:**
- Create: `repos/sandbox/src/kube/kubeClient.ts`

**Step 1: Implement KubeClient**

Create `repos/sandbox/src/kube/kubeClient.ts` — adapted from conductor's `kubectl.ts`:

```typescript
import type { Readable } from 'stream'
import type { TKubeClientConfig, TKubeEventHandlers } from '@TSB/types/kube.types'
import type { TSandboxResult, TRouteMap } from '@tdsk/domain'

import * as k8s from '@kubernetes/client-node'
import { PodLabelKeys, PodAnnotationKeys } from '@TSB/types/kube.types'
import { EContainerState } from '@tdsk/domain'

const ManagedSelector = `${PodLabelKeys.managed}=true`
const CycleInterval = 10 * 60 * 1000 // 10 minutes — K8s client bug #596 workaround

export class KubeClient {
  private coreApi: k8s.CoreV1Api
  private kubeExec: k8s.Exec
  private watcher: k8s.Watch
  private kc: k8s.KubeConfig
  private namespace: string
  private watchAbort: AbortController | null = null
  private cycleTimer: ReturnType<typeof setInterval> | null = null

  routes: TRouteMap = {}

  constructor(config: TKubeClientConfig = {}) {
    this.kc = new k8s.KubeConfig()

    if (config.inCluster !== false) {
      try {
        this.kc.loadFromCluster()
      } catch {
        this.kc.loadFromDefault()
      }
    } else {
      this.kc.loadFromDefault()
    }

    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
    this.kubeExec = new k8s.Exec(this.kc)
    this.watcher = new k8s.Watch(this.kc)
    this.namespace = config.namespace || 'default'
  }

  // --- Pod CRUD ---

  async createPod(manifest: k8s.V1Pod): Promise<k8s.V1Pod> {
    const resp = await this.coreApi.createNamespacedPod({
      namespace: this.namespace,
      body: manifest,
    })
    return resp
  }

  async getPod(name: string): Promise<k8s.V1Pod> {
    return await this.coreApi.readNamespacedPod({
      name,
      namespace: this.namespace,
    })
  }

  async listPods(labelSelector?: string): Promise<k8s.V1Pod[]> {
    const resp = await this.coreApi.listNamespacedPod({
      namespace: this.namespace,
      labelSelector: labelSelector || ManagedSelector,
    })
    return resp.items
  }

  async deletePod(name: string, gracePeriod?: number): Promise<void> {
    await this.coreApi.deleteNamespacedPod({
      name,
      namespace: this.namespace,
      gracePeriodSeconds: gracePeriod,
    })
  }

  // --- Shell Operations ---

  async runInPod(
    podName: string,
    command: string[],
    stdin?: Readable
  ): Promise<TSandboxResult> {
    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      const ws = this.kubeExec.exec(
        this.namespace,
        podName,
        'sandbox',
        command,
        process.stdout, // We'll capture via callbacks instead
        process.stderr,
        stdin || null,
        false, // tty
      )

      // TODO: Replace with proper stream capture via WebSocket handlers
      // This is a placeholder — the actual implementation needs to capture
      // stdout/stderr from the WebSocket connection
      ws.then((conn) => {
        // Handle WebSocket messages for stdout/stderr capture
        // Implementation depends on @kubernetes/client-node version
        resolve({
          success: true,
          output: stdout,
          error: stderr || undefined,
          exitCode: 0,
        })
      }).catch((err) => {
        resolve({
          success: false,
          output: stdout,
          error: err.message,
          exitCode: 1,
        })
      })
    })
  }

  // --- Watch ---

  async watch(events: TKubeEventHandlers): Promise<void> {
    const path = `/api/v1/namespaces/${this.namespace}/pods`
    this.watchAbort = new AbortController()

    await this.watcher.watch(
      path,
      { labelSelector: ManagedSelector },
      (type: string, pod: k8s.V1Pod) => {
        const handler = type.toLowerCase() as keyof TKubeEventHandlers
        events[handler]?.(pod)
      },
      (err?: any) => {
        if (err) events.error?.(err)
      }
    )
  }

  cycleListen(events: TKubeEventHandlers, intervalMs = CycleInterval): void {
    const restart = async () => {
      this.stopWatch()
      await this.watch(events)
    }

    restart()
    this.cycleTimer = setInterval(restart, intervalMs)
  }

  stopWatch(): void {
    this.watchAbort?.abort()
    this.watchAbort = null
  }

  cleanup(): void {
    this.stopWatch()
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer)
      this.cycleTimer = null
    }
  }

  // --- Hydration ---

  async hydrate(): Promise<TRouteMap> {
    const pods = await this.listPods()
    this.routes = {}

    for (const pod of pods) {
      if (this.shouldHydrate(pod)) {
        this.hydrateSingle(pod)
      } else if (this.shouldRemove(pod)) {
        const name = pod.metadata?.name
        if (name) {
          try { await this.deletePod(name) } catch { /* already gone */ }
        }
      }
    }

    return this.routes
  }

  hydrateSingle(pod: k8s.V1Pod): void {
    const labels = pod.metadata?.labels || {}
    const annotations = pod.metadata?.annotations || {}
    const subdomain = annotations[PodAnnotationKeys.subdomain]
    const podIp = pod.status?.podIP

    if (!subdomain || !podIp) return

    const portsRaw = annotations[PodAnnotationKeys.ports]
    const ports: Record<string, { protocol: 'http' | 'https' }> = portsRaw
      ? JSON.parse(portsRaw)
      : {}

    const phase = pod.status?.phase as EContainerState || EContainerState.Unknown

    const portEntries: Record<string, { host: string; port: number; protocol: 'http' | 'https' }> = {}
    for (const [port, cfg] of Object.entries(ports)) {
      portEntries[port] = {
        host: podIp,
        port: Number(port),
        protocol: cfg.protocol || 'http',
      }
    }

    this.routes[subdomain] = {
      meta: {
        podIp,
        state: phase,
        sandboxId: labels[PodLabelKeys.sandboxId] || '',
        podName: pod.metadata?.name || '',
      },
      ports: portEntries,
    }
  }

  removeFromCache(pod: k8s.V1Pod): void {
    const subdomain = pod.metadata?.annotations?.[PodAnnotationKeys.subdomain]
    if (subdomain && this.routes[subdomain]) {
      delete this.routes[subdomain]
    }
  }

  private shouldHydrate(pod: k8s.V1Pod): boolean {
    const phase = pod.status?.phase
    return phase === 'Running' || phase === 'Pending'
  }

  private shouldRemove(pod: k8s.V1Pod): boolean {
    const phase = pod.status?.phase
    return phase === 'Failed' || phase === 'Succeeded'
  }
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS (may need alias config for `@TSB/`)

---

### Task 9: Create Pod Manifest Builder

**Files:**
- Create: `repos/sandbox/src/kube/podManifest.ts`

**Step 1: Implement pod manifest builder**

Create `repos/sandbox/src/kube/podManifest.ts` — adapted from conductor's `pod/` directory:

```typescript
import type { V1Pod, V1Container, V1EnvVar } from '@kubernetes/client-node'
import type { TKubeSandboxConfig, TPlaceholderMap } from '@tdsk/domain'
import type { Sandbox } from '@tdsk/domain'

import { PodLabelKeys, PodAnnotationKeys } from '@TSB/types/kube.types'

type TBuildOpts = {
  sandbox: Sandbox
  userId: string
  projectId: string
  orgId: string
  placeholders: TPlaceholderMap
  namespace?: string
  caCertSecretName?: string
}

const DefaultWorkdir = '/workspace'
const CACertSecretName = 'tdsk-proxy-ca'
const BackendService = 'tdsk-backend'
const BackendPort = '5885'

/**
 * Generate a unique pod name from sandbox ID
 */
export const buildPodName = (sandboxId: string): string => {
  const slug = sandboxId.slice(0, 8)
  const rand = Math.random().toString(36).slice(2, 6)
  return `tdsk-sb-${slug}-${rand}`
}

/**
 * Generate the subdomain slug from sandbox ID
 */
export const buildSubdomain = (sandboxId: string): string => {
  return `sb-${sandboxId.slice(0, 8)}`
}

/**
 * Build a complete K8s pod manifest for a sandbox
 */
export const buildPodManifest = (opts: TBuildOpts): V1Pod => {
  const {
    sandbox,
    userId,
    projectId,
    orgId,
    placeholders,
    caCertSecretName = CACertSecretName,
  } = opts

  const config = sandbox.config
  const podName = buildPodName(sandbox.id)
  const subdomain = buildSubdomain(sandbox.id)

  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: buildMeta({ podName, subdomain, sandbox, userId, projectId, orgId, placeholders, config }),
    spec: {
      restartPolicy: 'Never',
      automountServiceAccountToken: false,
      initContainers: [buildInitContainer()],
      containers: [buildSandboxContainer(config, caCertSecretName)],
      volumes: [
        {
          name: 'proxy-ca-cert',
          secret: { secretName: caCertSecretName },
        },
      ],
    },
  }
}

function buildMeta(opts: {
  podName: string
  subdomain: string
  sandbox: Sandbox
  userId: string
  projectId: string
  orgId: string
  placeholders: TPlaceholderMap
  config: TKubeSandboxConfig
}) {
  return {
    name: opts.podName,
    labels: {
      [PodLabelKeys.managed]: 'true',
      [PodLabelKeys.sandboxId]: opts.sandbox.id,
      [PodLabelKeys.userId]: opts.userId,
      [PodLabelKeys.projectId]: opts.projectId,
      [PodLabelKeys.orgId]: opts.orgId,
    },
    annotations: {
      [PodAnnotationKeys.subdomain]: opts.subdomain,
      [PodAnnotationKeys.ports]: JSON.stringify(opts.config.ports || {}),
      [PodAnnotationKeys.placeholders]: JSON.stringify(opts.placeholders),
    },
  }
}

function buildInitContainer(): any {
  return {
    name: 'proxy-redirect',
    image: 'alpine',
    securityContext: {
      capabilities: {
        add: ['NET_ADMIN'],
      },
    },
    command: [
      'sh',
      '-c',
      [
        'apk add --no-cache iptables',
        `iptables -t nat -A OUTPUT -p tcp --dport 80 -j DNAT --to-destination ${BackendService}:${BackendPort}`,
        `iptables -t nat -A OUTPUT -p tcp --dport 443 -j DNAT --to-destination ${BackendService}:${BackendPort}`,
      ].join(' && '),
    ],
  }
}

function buildSandboxContainer(config: TKubeSandboxConfig, caCertSecret: string): V1Container {
  const container: V1Container = {
    name: 'sandbox',
    image: config.image,
    workingDir: config.workdir || DefaultWorkdir,
    env: buildEnvVars(config.envVars),
    ports: buildPorts(config.ports),
    resources: config.resources || {},
    securityContext: {
      allowPrivilegeEscalation: false,
      privileged: false,
    },
    volumeMounts: [
      {
        name: 'proxy-ca-cert',
        mountPath: '/usr/local/share/ca-certificates/tdsk-proxy.crt',
        subPath: 'ca.crt',
      },
    ],
    lifecycle: {
      postStart: {
        exec: {
          command: ['update-ca-certificates'],
        },
      },
    },
  }

  if (config.command) container.command = config.command
  if (config.args) container.args = config.args
  if (config.imagePullPolicy) container.imagePullPolicy = config.imagePullPolicy

  return container
}

function buildEnvVars(envVars?: Record<string, string>): V1EnvVar[] {
  if (!envVars) return []
  return Object.entries(envVars).map(([name, value]) => ({ name, value }))
}

function buildPorts(ports?: Record<string, { protocol: string }>): any[] {
  if (!ports) return []
  return Object.entries(ports).map(([port]) => ({
    containerPort: Number(port),
    protocol: 'TCP',
  }))
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

## Phase 4: K8s Lifecycle — Events, Routes, Hydration

### Task 10: Create K8s Event Watcher

**Files:**
- Create: `repos/sandbox/src/kube/kubeEvents.ts`

**Step 1: Implement event watcher with cycle listening**

Create `repos/sandbox/src/kube/kubeEvents.ts`:

```typescript
import type { V1Pod } from '@kubernetes/client-node'
import type { KubeClient } from '@TSB/kube/kubeClient'

/**
 * Set up K8s pod event watching with cycle listening
 * Adapted from conductor's watch pattern
 *
 * Cycle listening restarts the watch every 10 min to work around
 * K8s client library bug #596 (watch connections go stale)
 */
export const setupKubeWatcher = (client: KubeClient) => {
  const handlers = {
    added: (pod: V1Pod) => {
      client.hydrateSingle(pod)
    },
    modified: (pod: V1Pod) => {
      client.hydrateSingle(pod)
    },
    deleted: (pod: V1Pod) => {
      client.removeFromCache(pod)
    },
    bookmark: (_pod: V1Pod) => {
      // Keep-alive, no action
    },
    error: (err: any) => {
      console.error('[KubeEvents] Watch error:', err)
    },
  }

  client.cycleListen(handlers)
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 11: Create Route/URL Generation Utilities

**Files:**
- Create: `repos/sandbox/src/kube/kubeRoutes.ts`

**Step 1: Implement route URL generation**

Create `repos/sandbox/src/kube/kubeRoutes.ts`:

```typescript
import { buildSubdomain } from '@TSB/kube/podManifest'

const SandboxDomain = 'sandbox.threadedstack.app'

/**
 * Build the full URL for a sandbox port
 * Format: {port}.{sandboxSlug}.sandbox.threadedstack.app
 */
export const buildSandboxUrl = (
  sandboxId: string,
  port: string | number,
  protocol: 'http' | 'https' = 'http'
): string => {
  const subdomain = buildSubdomain(sandboxId)
  return `${protocol}://${port}.${subdomain}.${SandboxDomain}`
}

/**
 * Parse a sandbox subdomain hostname into its components
 * Input: "3000.sb-a1b2c3d4.sandbox.threadedstack.app"
 * Returns: { port: "3000", subdomain: "sb-a1b2c3d4" } or null
 */
export const parseSandboxHost = (
  hostname: string
): { port: string; subdomain: string } | null => {
  const parts = hostname.split('.')

  // Expect: {port}.{subdomain}.sandbox.threadedstack.app
  if (parts.length < 4) return null

  const port = parts[0]
  const subdomain = parts[1]

  if (!subdomain?.startsWith('sb-')) return null
  if (!/^\d+$/.test(port)) return null

  return { port, subdomain }
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 12: Create Dynamic Proxy Utility

**Files:**
- Create: `repos/sandbox/src/kube/kubeProxy.ts`

**Step 1: Implement dynamic proxy creator**

Create `repos/sandbox/src/kube/kubeProxy.ts`:

```typescript
import type { TRouteMap } from '@tdsk/domain'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { parseSandboxHost } from '@TSB/kube/kubeRoutes'

/**
 * Create a proxy handler that routes sandbox subdomain requests
 * to the correct pod IP and port based on the in-memory route map
 */
export const createSandboxProxyHandler = (routes: TRouteMap) => {
  return (req: any, res: any, next: any) => {
    const host = req.hostname || req.headers.host
    if (!host) return next()

    const parsed = parseSandboxHost(host)
    if (!parsed) return next()

    const { port, subdomain } = parsed
    const route = routes[subdomain]

    if (!route) {
      res.status(404).json({ error: 'Sandbox not found' })
      return
    }

    const portEntry = route.ports[port]
    if (!portEntry) {
      res.status(404).json({ error: `Port ${port} not exposed on this sandbox` })
      return
    }

    const target = `${portEntry.protocol}://${portEntry.host}:${portEntry.port}`

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true, // WebSocket support
    })

    proxy(req, res, next)
  }
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS (may need `http-proxy-middleware` installed: `cd repos/sandbox && pnpm add http-proxy-middleware`)

---

## Phase 5: KubeSandbox & Provider

### Task 13: Create KubeSandbox (ISandbox Implementation)

**Files:**
- Create: `repos/sandbox/src/kube/kubeSandbox.ts`

**Step 1: Implement KubeSandbox**

Create `repos/sandbox/src/kube/kubeSandbox.ts`:

```typescript
import type {
  ISandbox,
  TSandboxResult,
  TSandboxEvalResult,
  TSandboxEvalOpts,
  TSandboxRuntime,
} from '@tdsk/domain'
import type { KubeClient } from '@TSB/kube/kubeClient'

import { nanoid } from 'nanoid'

const DefaultRuntime: TSandboxRuntime = {
  name: 'node',
  command: 'node',
  extension: '.js',
}

/**
 * KubeSandbox — ISandbox implementation using K8s API
 * All file/shell operations run via K8s pod commands
 *
 * evaluate() writes code to a temp file and runs it with the configured
 * runtime (node, python, etc.). Returns stdout as output, result is undefined.
 */
export class KubeSandbox implements ISandbox {
  private client: KubeClient
  private podName: string
  private runtimes: TSandboxRuntime[]
  private defaultRuntime: string

  constructor(
    client: KubeClient,
    podName: string,
    runtimes?: TSandboxRuntime[],
    defaultRuntime?: string
  ) {
    this.client = client
    this.podName = podName
    this.runtimes = runtimes || [DefaultRuntime]
    this.defaultRuntime = defaultRuntime || this.runtimes[0]?.name || 'node'
  }

  async exec(command: string, args: string[] = []): Promise<TSandboxResult> {
    const fullCmd = args.length > 0
      ? ['sh', '-c', `${command} ${args.join(' ')}`]
      : ['sh', '-c', command]

    return await this.client.runInPod(this.podName, fullCmd)
  }

  async readFile(path: string): Promise<string> {
    const result = await this.client.runInPod(this.podName, ['cat', path])
    if (!result.success) throw new Error(result.error || `Failed to read file: ${path}`)
    return result.output
  }

  async writeFile(path: string, content: string): Promise<void> {
    const escaped = content.replace(/'/g, `'\\''`)
    const result = await this.client.runInPod(
      this.podName,
      ['sh', '-c', `printf '%s' '${escaped}' > ${path}`]
    )
    if (!result.success) throw new Error(result.error || `Failed to write file: ${path}`)
  }

  async listDir(path: string): Promise<string[]> {
    const result = await this.client.runInPod(this.podName, ['ls', '-1a', path])
    if (!result.success) throw new Error(result.error || `Failed to list dir: ${path}`)

    const entries = result.output.split('\n').filter(Boolean).filter(e => e !== '.' && e !== '..')
    const detailed: string[] = []

    for (const entry of entries) {
      const entryPath = path.endsWith('/') ? `${path}${entry}` : `${path}/${entry}`
      const testResult = await this.client.runInPod(
        this.podName,
        ['test', '-d', entryPath]
      )
      detailed.push(testResult.success ? `[DIR] ${entry}` : entry)
    }

    return detailed
  }

  async deleteFile(path: string): Promise<void> {
    const result = await this.client.runInPod(this.podName, ['rm', '-rf', path])
    if (!result.success) throw new Error(result.error || `Failed to delete: ${path}`)
  }

  async mkdir(path: string): Promise<void> {
    const result = await this.client.runInPod(this.podName, ['mkdir', '-p', path])
    if (!result.success) throw new Error(result.error || `Failed to create dir: ${path}`)
  }

  async fileExists(path: string): Promise<boolean> {
    const result = await this.client.runInPod(this.podName, ['test', '-e', path])
    return result.success
  }

  /**
   * Evaluate code by writing to a temp file and running with the configured runtime.
   *
   * 1. If opts.modules provided, write each to /tmp as a file
   * 2. Write the main code to /tmp/<random>.<ext>
   * 3. Run with the runtime command (e.g. `node /tmp/abc.js`)
   * 4. Return { output: stdout, result: undefined }
   *
   * The `result` field is undefined — K8s sandbox captures output via stdout only.
   * Callers that need structured return values should print JSON to stdout.
   */
  async evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult> {
    const runtimeName = (opts as any)?.runtime || this.defaultRuntime
    const runtime = this.runtimes.find(r => r.name === runtimeName)
    if (!runtime) {
      throw new Error(`Runtime "${runtimeName}" not available. Available: ${this.runtimes.map(r => r.name).join(', ')}`)
    }

    const fileId = nanoid(8)
    const tmpDir = `/tmp/tdsk-eval-${fileId}`
    await this.mkdir(tmpDir)

    // Write module files if provided
    if (opts?.modules) {
      for (const [name, moduleCode] of Object.entries(opts.modules)) {
        const modulePath = `${tmpDir}/${name}${runtime.extension}`
        await this.writeFile(modulePath, moduleCode)
      }
    }

    // Write main code file
    const mainFile = `${tmpDir}/main${runtime.extension}`
    await this.writeFile(mainFile, code)

    // Run with the runtime
    const timeoutFlag = opts?.timeout
      ? `timeout ${Math.ceil(opts.timeout / 1000)} `
      : ''
    const result = await this.exec(`${timeoutFlag}${runtime.command} ${mainFile}`)

    // Cleanup temp files
    await this.exec(`rm -rf ${tmpDir}`)

    return {
      output: result.output || '',
      result: undefined,
    }
  }

  async reset(): Promise<void> {
    await this.client.runInPod(
      this.podName,
      ['sh', '-c', 'rm -rf /workspace/* /tmp/*']
    )
  }

  async close(): Promise<void> {
    // Disconnect only — does NOT delete pod (persistent workspace)
    // Pod lifecycle managed separately by SandboxService
  }
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 14: Create KubeSandboxProvider

**Files:**
- Create: `repos/sandbox/src/kube/kubeSandboxProvider.ts`

**Step 1: Implement provider**

Create `repos/sandbox/src/kube/kubeSandboxProvider.ts`:

```typescript
import type { ISandbox, ISandboxProvider, TSandboxConfig, TSandboxRuntime } from '@tdsk/domain'

import { ESandboxType } from '@tdsk/domain'
import { KubeSandbox } from '@TSB/kube/kubeSandbox'
import { KubeClient } from '@TSB/kube/kubeClient'

type TKubeProviderOpts = {
  podName?: string
  namespace?: string
  runtimes?: TSandboxRuntime[]
  defaultRuntime?: string
}

/**
 * Kubernetes sandbox provider — creates sandbox instances backed by K8s pods
 * Pods are persistent workspaces managed separately (auto-start on agent interaction)
 * This provider connects to an existing running pod
 */
export class KubeSandboxProvider implements ISandboxProvider {
  readonly type = ESandboxType.kubernetes

  async create(config: TSandboxConfig): Promise<ISandbox> {
    const kubeConfig = config.options as TKubeProviderOpts | undefined

    if (!kubeConfig?.podName) {
      throw new Error('KubeSandboxProvider.create requires options.podName — pods are created via SandboxService')
    }

    const client = new KubeClient({
      namespace: kubeConfig.namespace,
    })

    return new KubeSandbox(
      client,
      kubeConfig.podName,
      kubeConfig.runtimes,
      kubeConfig.defaultRuntime
    )
  }
}
```

**Step 2: Run type checks**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 15: Register Kubernetes Provider in Factory

**Files:**
- Modify: `repos/sandbox/src/sandbox.ts`

**Step 1: Add kubernetes provider to the Map**

Update `repos/sandbox/src/sandbox.ts`:

```typescript
import type { ISandboxProvider, TSandboxType } from '@tdsk/domain'

import { ESandboxType } from '@tdsk/domain'
import { LocalSandboxProvider } from '@TSB/local/local'
import { KubeSandboxProvider } from '@TSB/kube/kubeSandboxProvider'

const providers = new Map<TSandboxType, () => ISandboxProvider>([
  [ESandboxType.local, () => new LocalSandboxProvider()],
  [ESandboxType.kubernetes, () => new KubeSandboxProvider()],
])

export const createSandboxProvider = (type: TSandboxType): ISandboxProvider => {
  const factory = providers.get(type)
  if (!factory) throw new Error(`Unknown sandbox provider: ${type}`)

  return factory()
}
```

**Step 2: Run type checks and tests**

Run: `cd repos/sandbox && pnpm types && pnpm test`
Expected: All pass (57/57 tests, 0 type errors)

---

## Phase 6: Backend API — Config Routes

### Task 16: Create Sandbox Config CRUD Endpoints

**Files:**
- Create: `repos/backend/src/endpoints/templates/sandboxes/sandboxes.ts`
- Create: `repos/backend/src/endpoints/templates/sandboxes/createSandbox.ts`
- Create: `repos/backend/src/endpoints/templates/sandboxes/listSandboxes.ts`
- Create: `repos/backend/src/endpoints/templates/sandboxes/getSandbox.ts`
- Create: `repos/backend/src/endpoints/templates/sandboxes/updateSandbox.ts`
- Create: `repos/backend/src/endpoints/templates/sandboxes/deleteSandbox.ts`
- Modify: `repos/backend/src/endpoints/templates/templates.ts` (or parent)

**Step 1: Create the sandbox config group endpoint**

Create `repos/backend/src/endpoints/templates/sandboxes/sandboxes.ts`:

```typescript
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getSandbox } from './getSandbox'
import { listSandboxes } from './listSandboxes'
import { createSandbox } from './createSandbox'
import { updateSandbox } from './updateSandbox'
import { deleteSandbox } from './deleteSandbox'

export const sandboxes: TEndpointConfig = {
  path: `/sandboxes`,
  method: EPMethod.Use,
  endpoints: {
    getSandbox,
    listSandboxes,
    createSandbox,
    updateSandbox,
    deleteSandbox,
  },
}
```

**Step 2: Create handler — POST / (create config)**

Create `repos/backend/src/endpoints/templates/sandboxes/createSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Sandbox, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const createSandbox: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, config } = req.body
    const orgId = req.params.orgId || req.body.orgId

    if (!name) throw new Exception(400, 'Sandbox name is required')
    if (!config?.image) throw new Exception(400, 'Sandbox config.image is required')
    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.create, EPermResource.endpoint, { orgId })

    const sandboxData = new Sandbox({
      name,
      orgId,
      userId: req.body.userId || undefined,
      config,
    })

    const { data, error } = await db.services.sandbox.create(sandboxData)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
```

**Step 3: Create handler — GET / (list configs)**

Create `repos/backend/src/endpoints/templates/sandboxes/listSandboxes.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const listSandboxes: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.params.orgId || req.query.orgId as string

    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.read, EPermResource.endpoint, { orgId })

    const { data, error } = await db.services.sandbox.list({
      where: { orgId },
    })
    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
```

**Step 4: Create handler — GET /:id**

Create `repos/backend/src/endpoints/templates/sandboxes/getSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const getSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const orgId = req.params.orgId || req.query.orgId as string

    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.read, EPermResource.endpoint, { orgId })

    const { data, error } = await db.services.sandbox.get(id)
    if (error) throw new Exception(404, error.message)

    res.json({ data })
  },
}
```

**Step 5: Create handler — PUT /:id**

Create `repos/backend/src/endpoints/templates/sandboxes/updateSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const updateSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.update, EPermResource.endpoint, { orgId })

    const { data, error } = await db.services.sandbox.update({
      id,
      ...req.body,
    })
    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
```

**Step 6: Create handler — DELETE /:id**

Create `repos/backend/src/endpoints/templates/sandboxes/deleteSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const deleteSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.delete, EPermResource.endpoint, { orgId })

    const { data, error } = await db.services.sandbox.delete(id)
    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
```

**Step 7: Register in templates parent endpoint**

Add the sandboxes group to `repos/backend/src/endpoints/templates/templates.ts`:

```typescript
import { sandboxes } from './sandboxes/sandboxes'

// Add sandboxes to the templates endpoint config
export const templates: TEndpointConfig = {
  path: `/templates`,
  method: EPMethod.Use,
  endpoints: {
    // ... existing template endpoints ...
    sandboxes,
  },
}
```

**Step 8: Run type checks and tests**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: PASS

---

## Phase 7: Backend API — Runtime Routes

### Task 17: Create SandboxService (Orchestration Layer)

**Files:**
- Create: `repos/backend/src/services/sandboxes/sandboxService.ts`

**Step 1: Implement SandboxService**

Create `repos/backend/src/services/sandboxes/sandboxService.ts`:

```typescript
import type { ISandbox, TPlaceholderMap } from '@tdsk/domain'
import type { KubeClient } from '@tdsk/sandbox/kube/kubeClient'

import { nanoid } from 'nanoid'
import { KubeSandbox } from '@tdsk/sandbox/kube/kubeSandbox'
import { buildPodManifest } from '@tdsk/sandbox/kube/podManifest'
import { EContainerState } from '@tdsk/domain'

type TStartPodOpts = {
  sandboxId: string
  userId: string
  projectId: string
  orgId: string
}

/**
 * SandboxService orchestrates between DB config records and K8s pod operations
 */
export class SandboxService {
  private kubeClient: KubeClient
  private db: any // Database service reference

  constructor(kubeClient: KubeClient, db: any) {
    this.kubeClient = kubeClient
    this.db = db
  }

  /**
   * Start a pod from a sandbox config
   */
  async startPod(opts: TStartPodOpts): Promise<string> {
    const { sandboxId, userId, projectId, orgId } = opts

    // 1. Load config from DB
    const { data: sandbox, error } = await this.db.services.sandbox.get(sandboxId)
    if (error || !sandbox) throw new Error(`Sandbox config not found: ${sandboxId}`)

    // 2. Generate placeholder tokens for secretIds
    const placeholders: TPlaceholderMap = {}
    if (sandbox.config.secretIds) {
      for (const secretId of sandbox.config.secretIds) {
        const token = `tdsk_ph_${nanoid(16)}`
        placeholders[token] = secretId
      }
    }

    // 3. Build pod manifest
    const manifest = buildPodManifest({
      sandbox,
      userId,
      projectId,
      orgId,
      placeholders,
    })

    // 4. Create pod via K8s API
    const pod = await this.kubeClient.createPod(manifest)
    const podName = pod.metadata?.name || ''

    // 5. Route maps updated automatically via watch events

    return podName
  }

  /**
   * Stop a pod (delete it from K8s)
   */
  async stopPod(podName: string): Promise<void> {
    await this.kubeClient.deletePod(podName, 30)
  }

  /**
   * Get pod state from K8s
   */
  async getPodState(podName: string): Promise<EContainerState> {
    try {
      const pod = await this.kubeClient.getPod(podName)
      return (pod.status?.phase as EContainerState) || EContainerState.Unknown
    } catch {
      return EContainerState.Unknown
    }
  }

  /**
   * Get an ISandbox instance connected to an existing running pod
   * Used by AgentRunner for tool bridging
   */
  async getSandbox(podName: string): Promise<ISandbox> {
    // Verify pod is running
    const state = await this.getPodState(podName)
    if (state !== EContainerState.Running) {
      throw new Error(`Pod ${podName} is not running (state: ${state})`)
    }

    return new KubeSandbox(this.kubeClient, podName)
  }

  /**
   * List running pods for a given filter
   */
  async listRunningPods(filter: { orgId?: string; userId?: string; projectId?: string } = {}) {
    const labels = ['tdsk.app/managed=true']
    if (filter.orgId) labels.push(`tdsk.app/org-id=${filter.orgId}`)
    if (filter.userId) labels.push(`tdsk.app/user-id=${filter.userId}`)
    if (filter.projectId) labels.push(`tdsk.app/project-id=${filter.projectId}`)

    return await this.kubeClient.listPods(labels.join(','))
  }
}
```

**Step 2: Run type checks**

Run: `cd repos/backend && pnpm types`
Expected: PASS

---

### Task 18: Create Sandbox Instance Runtime Endpoints

**Files:**
- Create: `repos/backend/src/endpoints/sandboxes/sandboxes.ts`
- Create: `repos/backend/src/endpoints/sandboxes/startSandbox.ts`
- Create: `repos/backend/src/endpoints/sandboxes/stopSandbox.ts`
- Create: `repos/backend/src/endpoints/sandboxes/listRunningSandboxes.ts`
- Create: `repos/backend/src/endpoints/sandboxes/getSandboxStatus.ts`
- Create: `repos/backend/src/endpoints/sandboxes/execInSandbox.ts`
- Modify: `repos/backend/src/endpoints/index.ts`

**Step 1: Create the sandbox runtime group endpoint**

Create `repos/backend/src/endpoints/sandboxes/sandboxes.ts`:

```typescript
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { startSandbox } from './startSandbox'
import { stopSandbox } from './stopSandbox'
import { listRunningSandboxes } from './listRunningSandboxes'
import { getSandboxStatus } from './getSandboxStatus'
import { execInSandbox } from './execInSandbox'

export const sandboxes: TEndpointConfig = {
  path: `/sandboxes`,
  method: EPMethod.Use,
  endpoints: {
    startSandbox,
    stopSandbox,
    listRunningSandboxes,
    getSandboxStatus,
    execInSandbox,
  },
}
```

**Step 2: Create handler — POST / (start pod from config)**

Create `repos/backend/src/endpoints/sandboxes/startSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const startSandbox: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { sandboxId, projectId, orgId, userId } = req.body

    if (!sandboxId) throw new Exception(400, 'sandboxId is required')
    if (!projectId) throw new Exception(400, 'projectId is required')
    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.create, EPermResource.endpoint, { orgId })

    const sandboxService = req.app.locals.sandboxService
    const podName = await sandboxService.startPod({
      sandboxId,
      projectId,
      orgId,
      userId: userId || req.user?.id,
    })

    res.status(201).json({ data: { podName } })
  },
}
```

**Step 3: Create handler — DELETE /:podName (stop pod)**

Create `repos/backend/src/endpoints/sandboxes/stopSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const stopSandbox: TEndpointConfig = {
  path: `/:podName`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { podName } = req.params
    const orgId = req.params.orgId || req.query.orgId as string

    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.delete, EPermResource.endpoint, { orgId })

    const sandboxService = req.app.locals.sandboxService
    await sandboxService.stopPod(podName)

    res.json({ data: { success: true } })
  },
}
```

**Step 4: Create handler — GET / (list running sandboxes)**

Create `repos/backend/src/endpoints/sandboxes/listRunningSandboxes.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const listRunningSandboxes: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const orgId = req.params.orgId || req.query.orgId as string
    const userId = req.query.userId as string
    const projectId = req.query.projectId as string

    if (!orgId) throw new Exception(400, 'orgId is required')

    await checkPermission(req, EPermAction.read, EPermResource.endpoint, { orgId })

    const sandboxService = req.app.locals.sandboxService
    const pods = await sandboxService.listRunningPods({
      orgId,
      userId,
      projectId,
    })

    const data = pods.map((pod: any) => ({
      podName: pod.metadata?.name,
      status: pod.status?.phase,
      podIp: pod.status?.podIP,
      labels: pod.metadata?.labels,
      startTime: pod.status?.startTime,
    }))

    res.json({ data })
  },
}
```

**Step 5: Create handler — GET /:podName/status**

Create `repos/backend/src/endpoints/sandboxes/getSandboxStatus.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

export const getSandboxStatus: TEndpointConfig = {
  path: `/:podName/status`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { podName } = req.params
    const sandboxService = req.app.locals.sandboxService
    const state = await sandboxService.getPodState(podName)

    res.json({ data: { podName, state } })
  },
}
```

**Step 6: Create handler — POST /:podName/exec**

Create `repos/backend/src/endpoints/sandboxes/execInSandbox.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

export const execInSandbox: TEndpointConfig = {
  path: `/:podName/exec`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { podName } = req.params
    const { command, args } = req.body

    if (!command) throw new Exception(400, 'command is required')

    const sandboxService = req.app.locals.sandboxService
    const sandbox = await sandboxService.getSandbox(podName)
    const result = await sandbox.exec(command, args)

    res.json({ data: result })
  },
}
```

**Step 7: Register sandboxes in backend endpoints index**

Add to `repos/backend/src/endpoints/index.ts`:

```typescript
import { sandboxes } from './sandboxes/sandboxes'

export const endpoints = {
  // ... existing endpoints ...
  sandboxes,
}
```

**Step 8: Run type checks and tests**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: PASS

---

## Phase 8: Dynamic Proxy Middleware

### Task 19: Create Sandbox Proxy Middleware for Backend

**Files:**
- Create: `repos/backend/src/middleware/sandboxProxy.ts`

**Step 1: Implement subdomain proxy middleware**

Create `repos/backend/src/middleware/sandboxProxy.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express'

import { createProxyMiddleware } from 'http-proxy-middleware'
import { parseSandboxHost } from '@tdsk/sandbox/kube/kubeRoutes'

/**
 * Middleware that intercepts sandbox subdomain requests and proxies
 * them to the correct pod IP/port based on the in-memory route map
 *
 * Request flow: Caddy (wildcard TLS) → Proxy (auth) → Backend (this middleware)
 *   → Parse hostname: extract port + subdomain
 *   → Lookup in-memory route map: subdomain → podIP
 *   → Forward to podIP:port
 */
export const setupSandboxProxy = (app: any) => {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.hostname || req.headers.host?.split(':')[0]
    if (!host) return next()

    const parsed = parseSandboxHost(host)
    if (!parsed) return next()

    const { port, subdomain } = parsed
    const routes = app.locals.kubeClient?.routes

    if (!routes) return next()

    const route = routes[subdomain]
    if (!route) {
      res.status(404).json({ error: 'Sandbox not found' })
      return
    }

    const portEntry = route.ports[port]
    if (!portEntry) {
      res.status(404).json({ error: `Port ${port} not exposed on this sandbox` })
      return
    }

    const target = `${portEntry.protocol}://${portEntry.host}:${portEntry.port}`

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
    })

    proxy(req, res, next)
  })
}
```

**Step 2: Run type checks**

Run: `cd repos/backend && pnpm types`
Expected: PASS

---

## Phase 9: Secret Security — MITM Egress Proxy

### Task 20: Create Egress MITM Proxy Service

**Files:**
- Create: `repos/backend/src/services/sandboxEgress/egressProxy.ts`

**Step 1: Install node-http-mitm-proxy**

Run: `cd repos/backend && pnpm add http-mitm-proxy`

**Step 2: Implement egress proxy**

Create `repos/backend/src/services/sandboxEgress/egressProxy.ts`:

```typescript
import type { TRouteMap, TPlaceholderMap } from '@tdsk/domain'

import { Proxy } from 'http-mitm-proxy'

type TEgressProxyOpts = {
  port: number
  routes: TRouteMap
  resolveSecret: (secretId: string) => Promise<string | null>
  caCertPath: string
  caKeyPath: string
}

/**
 * Transparent egress proxy for sandbox pods
 *
 * All outbound HTTP/HTTPS traffic from sandbox pods is redirected here
 * via iptables rules in the init container.
 *
 * For HTTPS: terminates TLS using self-signed CA, inspects headers,
 * replaces placeholder tokens with real secret values, re-encrypts
 * and forwards to the real destination.
 *
 * For HTTP: inspects and replaces placeholder tokens directly.
 */
export class EgressProxy {
  private proxy: Proxy
  private routes: TRouteMap
  private resolveSecret: (secretId: string) => Promise<string | null>

  constructor(opts: TEgressProxyOpts) {
    this.routes = opts.routes
    this.resolveSecret = opts.resolveSecret

    this.proxy = new Proxy()
    this.proxy.use(Proxy.wildcard)

    // Configure CA cert for MITM TLS termination
    this.proxy.onCertificateRequired = (hostname, callback) => {
      return callback(null, {
        keyFile: opts.caKeyPath,
        certFile: opts.caCertPath,
      })
    }

    // Intercept requests — replace placeholder tokens with real secrets
    this.proxy.onRequest((ctx, callback) => {
      this.handleRequest(ctx)
        .then(() => callback())
        .catch((err) => {
          console.error('[EgressProxy] Request handling error:', err)
          callback()
        })
    })
  }

  private async handleRequest(ctx: any): Promise<void> {
    // Find which sandbox this request came from (by source IP)
    const sourceIp = ctx.clientToProxyRequest?.socket?.remoteAddress
    const placeholders = this.findPlaceholders(sourceIp)

    if (!placeholders) return

    // Scan and replace Authorization header
    const authHeader = ctx.proxyToServerRequestOptions?.headers?.['authorization']
    if (authHeader) {
      const replaced = await this.replaceTokens(authHeader, placeholders)
      if (replaced !== authHeader) {
        ctx.proxyToServerRequestOptions.headers['authorization'] = replaced
      }
    }

    // Scan and replace other headers that may contain placeholders
    const headers = ctx.proxyToServerRequestOptions?.headers || {}
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string' && value.includes('tdsk_ph_')) {
        headers[key] = await this.replaceTokens(value, placeholders)
      }
    }
  }

  private findPlaceholders(sourceIp?: string): TPlaceholderMap | null {
    if (!sourceIp) return null

    // Look up route by pod IP to find placeholders in annotations
    for (const route of Object.values(this.routes)) {
      if (route.meta.podIp === sourceIp) {
        // Placeholders stored in pod annotations during hydration
        // TODO: Extend route map to include placeholders from annotations
        return null
      }
    }
    return null
  }

  private async replaceTokens(
    value: string,
    placeholders: TPlaceholderMap
  ): Promise<string> {
    let result = value
    for (const [token, secretId] of Object.entries(placeholders)) {
      if (result.includes(token)) {
        const secret = await this.resolveSecret(secretId)
        if (secret) {
          result = result.replace(token, secret)
        }
      }
    }
    return result
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.proxy.listen({ port }, () => {
        console.log(`[EgressProxy] Listening on port ${port}`)
        resolve()
      })
    })
  }

  stop(): void {
    this.proxy.close()
  }
}
```

**Step 3: Run type checks**

Run: `cd repos/backend && pnpm types`
Expected: PASS

---

## Phase 10: Deployment — RBAC, NetworkPolicy, Caddy

### Task 21: Add ServiceAccount & RBAC to DevSpace

**Files:**
- Modify: `deploy/devspace.yaml`

**Step 1: Add customServiceAccount to backend deployment**

In `deploy/devspace.yaml`, find the tdsk-backend deployment section and add:

```yaml
serviceAccountName: tdsk-backend-sa
customServiceAccount:
  name: tdsk-backend-sa
  binding:
    name: tdsk-sandbox-manager-binding
  role:
    name: tdsk-sandbox-manager
    resources:
      - pods
      - pods/exec
    verbs:
      - create
      - delete
      - get
      - list
      - watch
```

**Step 2: Verify with dry-run**

Run: `tdsk dev render`
Expected: Renders without errors, includes ServiceAccount and Role manifests

---

### Task 22: Create NetworkPolicy for Sandbox Pods

**Files:**
- Create: `deploy/templates/networkpolicy.yaml`

**Step 1: Create the NetworkPolicy manifest**

Create `deploy/templates/networkpolicy.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sandbox-egress-policy
spec:
  podSelector:
    matchLabels:
      tdsk.app/managed: "true"
  policyTypes:
    - Egress
  egress:
    # Allow traffic to backend only (for MITM proxy)
    - to:
        - podSelector:
            matchLabels:
              app: tdsk-backend
      ports:
        - port: 5885
    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
```

**Step 2: Verify the manifest is valid**

Run: `kubectl apply --dry-run=client -f deploy/templates/networkpolicy.yaml`
Expected: `networkpolicy.networking.k8s.io/sandbox-egress-policy created (dry run)`

---

### Task 23: Add Wildcard Subdomain to Caddyfile

**Files:**
- Modify: `deploy/Caddyfile`

**Step 1: Add sandbox subdomain block**

Add a new server block to `deploy/Caddyfile` for sandbox subdomains. Place it before the catch-all block:

```caddy
*.sandbox.{$TDSK_HOST:threadedstack.app} {
    tls internal {
        on_demand
    }
    import app_logic
}
```

For local development, add to the local block:

```caddy
*.sandbox.local.threadedstack.app {
    tls internal {
        lifetime 365d
    }
    import app_logic
}
```

**Step 2: Verify Caddy config**

Run: `tdsk dev render` and verify the Caddyfile section renders correctly.

---

## Phase 11: Admin UI

### Task 24: Create Sandbox Config API Service

**Files:**
- Create: `repos/admin/src/services/sandboxApi.ts`

**Step 1: Implement SandboxApi service class**

Create `repos/admin/src/services/sandboxApi.ts`:

```typescript
import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Sandbox } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

export class SandboxApi extends BaseApi {
  #path(orgId: string) {
    return `/templates/sandboxes`
  }

  cache: TApiCacheKeys = {
    all: () => ['/sandboxes'] as const,
    list: () => [...this.cache.all(), 'list'] as const,
    detail: (id: string) => [...this.cache.all(), 'detail', id] as const,
  }

  async list(orgId: string): Promise<TApiRes<Sandbox[]>> {
    const resp = await this.api.get<Sandbox[]>({
      path: this.#path(orgId),
      data: { orgId },
      queryKey: this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, 'Failed to load sandbox configs'))

    return {
      ...resp,
      data: resp.data?.map?.((s) => new Sandbox(s)) || [],
    }
  }

  async get(orgId: string, id: string): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.get<Sandbox>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, 'Failed to load sandbox config'))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }

  async create(orgId: string, data: Partial<Sandbox>): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.post<Sandbox>({
      data: { ...data, orgId },
      path: this.#path(orgId),
    })

    resp.error && (await this._onError(resp.error, 'Failed to create sandbox config'))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }

  async update(orgId: string, id: string, data: Partial<Sandbox>): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.put<Sandbox>({
      data,
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, 'Failed to update sandbox config'))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }

  async remove(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}`,
      data: { orgId },
    })

    resp.error && (await this._onError(resp.error, 'Failed to delete sandbox config'))

    return resp
  }
}

export const sandboxApi = new SandboxApi()
```

**Step 2: Run type checks**

Run: `cd repos/admin && pnpm types`
Expected: PASS

---

### Task 25: Create Sandbox Actions (Jotai State Management)

**Files:**
- Create: `repos/admin/src/actions/sandboxes/api/fetchSandboxes.ts`
- Create: `repos/admin/src/actions/sandboxes/api/createSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/api/updateSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/api/deleteSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/local/setSandboxes.ts`
- Create: `repos/admin/src/actions/sandboxes/local/upsertSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/local/removeSandbox.ts`
- Create: `repos/admin/src/actions/sandboxes/index.ts`

**Step 1: Create local state actions**

Follow the existing apiKeys pattern. Create local state setters that update Jotai atoms:

`repos/admin/src/actions/sandboxes/local/setSandboxes.ts`:
```typescript
import type { Sandbox } from '@tdsk/domain'
import { getDefaultStore } from 'jotai'
import { sandboxConfigsAtom } from '@TAF/state/atoms'

export const setSandboxes = (sandboxes: Sandbox[]) => {
  const store = getDefaultStore()
  const map: Record<string, Sandbox> = {}
  for (const s of sandboxes) {
    map[s.id] = s
  }
  store.set(sandboxConfigsAtom, map)
}
```

`repos/admin/src/actions/sandboxes/local/upsertSandbox.ts`:
```typescript
import type { Sandbox } from '@tdsk/domain'
import { getDefaultStore } from 'jotai'
import { sandboxConfigsAtom } from '@TAF/state/atoms'

export const upsertSandbox = (sandbox: Sandbox) => {
  const store = getDefaultStore()
  const current = store.get(sandboxConfigsAtom)
  store.set(sandboxConfigsAtom, { ...current, [sandbox.id]: sandbox })
}
```

`repos/admin/src/actions/sandboxes/local/removeSandbox.ts`:
```typescript
import { getDefaultStore } from 'jotai'
import { sandboxConfigsAtom } from '@TAF/state/atoms'

export const removeSandbox = (id: string) => {
  const store = getDefaultStore()
  const current = store.get(sandboxConfigsAtom)
  const { [id]: _, ...rest } = current
  store.set(sandboxConfigsAtom, rest)
}
```

**Step 2: Create API actions**

`repos/admin/src/actions/sandboxes/api/fetchSandboxes.ts`:
```typescript
import { sandboxApi } from '@TAF/services/sandboxApi'
import { setSandboxes } from '@TAF/actions/sandboxes/local/setSandboxes'

export const fetchSandboxes = async (orgId: string) => {
  const resp = await sandboxApi.list(orgId)
  if (resp.error) return { error: resp.error }

  resp.data && setSandboxes(resp.data)
  return resp
}
```

`repos/admin/src/actions/sandboxes/api/createSandbox.ts`:
```typescript
import type { Sandbox } from '@tdsk/domain'
import { sandboxApi } from '@TAF/services/sandboxApi'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export const createSandbox = async (orgId: string, data: Partial<Sandbox>) => {
  const resp = await sandboxApi.create(orgId, data)
  if (resp.error) return { error: resp.error }

  resp.data && upsertSandbox(resp.data)
  return resp
}
```

`repos/admin/src/actions/sandboxes/api/updateSandbox.ts`:
```typescript
import type { Sandbox } from '@tdsk/domain'
import { sandboxApi } from '@TAF/services/sandboxApi'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export const updateSandbox = async (orgId: string, id: string, data: Partial<Sandbox>) => {
  const resp = await sandboxApi.update(orgId, id, data)
  if (resp.error) return { error: resp.error }

  resp.data && upsertSandbox(resp.data)
  return resp
}
```

`repos/admin/src/actions/sandboxes/api/deleteSandbox.ts`:
```typescript
import { sandboxApi } from '@TAF/services/sandboxApi'
import { removeSandbox } from '@TAF/actions/sandboxes/local/removeSandbox'

export const deleteSandbox = async (orgId: string, id: string) => {
  const resp = await sandboxApi.remove(orgId, id)
  if (resp.error) return { error: resp.error }

  removeSandbox(id)
  return resp
}
```

**Step 3: Create barrel export**

`repos/admin/src/actions/sandboxes/index.ts`:
```typescript
export { fetchSandboxes } from './api/fetchSandboxes'
export { createSandbox } from './api/createSandbox'
export { updateSandbox } from './api/updateSandbox'
export { deleteSandbox } from './api/deleteSandbox'
export { setSandboxes } from './local/setSandboxes'
export { upsertSandbox } from './local/upsertSandbox'
export { removeSandbox } from './local/removeSandbox'
```

**Step 4: Add Jotai atom**

Add to the appropriate atoms file (e.g., `repos/admin/src/state/atoms.ts` or wherever org-level atoms are defined):

```typescript
import type { Sandbox } from '@tdsk/domain'
import { atom } from 'jotai'

export const sandboxConfigsAtom = atom<Record<string, Sandbox>>({})
export const activeSandboxConfigIdAtom = atom<string | undefined>(undefined)
```

**Step 5: Run type checks**

Run: `cd repos/admin && pnpm types`
Expected: PASS

---

### Task 26: Create Org Sandboxes Page

**Files:**
- Create: `repos/admin/src/pages/Orgs/OrgSandboxes.tsx`
- Modify: `repos/admin/src/routes/Routes.tsx`

**Step 1: Create the page component**

Create `repos/admin/src/pages/Orgs/OrgSandboxes.tsx` following the `OrgApiKeys.tsx` pattern:

```typescript
import type { Sandbox } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { Page } from '@TAF/pages/Page/Page'
import { useEffect, useState, useMemo } from 'react'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Box, Typography, Chip } from '@mui/material'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ConfirmDelete, IconButton } from '@tdsk/components'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { fetchSandboxes, deleteSandbox } from '@TAF/actions/sandboxes'
import { useAtomValue } from 'jotai'
import { sandboxConfigsAtom } from '@TAF/state/atoms'

import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Dns as SandboxIcon,
} from '@mui/icons-material'

export const OrgSandboxes = () => {
  const [orgId] = useActiveOrgId()
  const sandboxConfigs = useAtomValue(sandboxConfigsAtom)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<Sandbox | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!orgId) return
      setLoading(true)
      const result = await fetchSandboxes(orgId)
      result.error && setError(result.error as Error)
      setLoading(false)
    }
    load()
  }, [orgId])

  const sandboxes = useMemo(() => {
    return Object.values(sandboxConfigs)
  }, [sandboxConfigs])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sandboxes
    const q = searchQuery.toLowerCase()
    return sandboxes.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.config?.image?.toLowerCase().includes(q)
    )
  }, [sandboxes, searchQuery])

  const onDeleteClick = (sandbox: Sandbox) => {
    setSelected(sandbox)
    setDeleteOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selected || !orgId) return
    setLoading(true)
    const result = await deleteSandbox(orgId, selected.id)
    result.error && setError(result.error as Error)
    setDeleteOpen(false)
    setSelected(null)
    setLoading(false)
  }

  const columns: TDataTableColumn<Sandbox>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (s) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SandboxIcon sx={{ color: 'text.secondary' }} />
          <Typography variant='body2' fontWeight='medium'>
            {s.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'scope',
      label: 'Scope',
      render: (s) => (
        <Chip
          label={s.userId ? 'User Preset' : 'Org-wide'}
          size='small'
          color={s.userId ? 'info' : 'default'}
          variant='outlined'
        />
      ),
    },
    {
      id: 'image',
      label: 'Image',
      render: (s) => (
        <Typography variant='body2' fontFamily='monospace' color='text.secondary'>
          {s.config?.image}
        </Typography>
      ),
    },
    {
      id: 'ports',
      label: 'Ports',
      render: (s) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {Object.keys(s.config?.ports || {}).map((port) => (
            <Chip key={port} label={port} size='small' variant='outlined' />
          ))}
        </Box>
      ),
    },
    {
      id: 'resources',
      label: 'Resources',
      render: (s) => (
        <Typography variant='body2' color='text.secondary'>
          {s.config?.resources?.limits?.cpu || '-'} / {s.config?.resources?.limits?.memory || '-'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (s) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <ActionIconButton tooltip='Edit' icon={<EditIcon />} size='small' onClick={() => {}} />
          <ActionIconButton
            tooltip='Delete'
            icon={<DeleteIcon />}
            size='small'
            color='error'
            onClick={(e) => { e.stopPropagation(); onDeleteClick(s) }}
          />
        </Box>
      ),
    },
  ]

  return (
    <Page className='tdsk-org-sandboxes-page'>
      <PageLayout
        title='Sandbox Configs'
        countLabel='config'
        count={sandboxes.length}
        error={error?.message}
        loading={loading}
        query={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder='Search sandbox configs...'
        searchCount={filtered.length}
        onAction={sandboxes.length > 0 && (() => setCreateOpen(true))}
        actionLabel={sandboxes.length > 0 && 'Create Config'}
        setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      >
        {sandboxes.length === 0 && (
          <EmptyState
            message='No sandbox configs yet. Create your first sandbox configuration.'
            actionLabel='Create Config'
            actionIcon={<AddIcon />}
            onAction={() => setCreateOpen(true)}
          />
        )}

        {sandboxes.length > 0 && filtered.length === 0 && (
          <EmptyState message='No configs match your search.' />
        )}

        {filtered.length > 0 && (
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(s) => s.id}
          />
        )}

        {deleteOpen && (
          <ConfirmDelete
            onCancel={() => { setDeleteOpen(false); setSelected(null) }}
            onConfirm={onDeleteConfirm}
            itemName={selected?.name}
            text={`Are you sure you want to delete "${selected?.name}"? This cannot be undone.`}
          />
        )}
      </PageLayout>
    </Page>
  )
}

export default OrgSandboxes
```

**Step 2: Register the route**

Add to `repos/admin/src/routes/Routes.tsx` under the org routes:

```typescript
{
  path: 'sandboxes',
  lazy: () => import('@TAF/pages/Orgs/OrgSandboxes'),
}
```

**Step 3: Run type checks**

Run: `cd repos/admin && pnpm types`
Expected: PASS

---

## Phase 12: AgentRunner Integration

### Task 27: Integrate K8s Sandbox with AgentRunner

**Files:**
- Modify: `repos/backend/src/services/` (AgentRunner or agent execution service)

**Step 1: Find the AgentRunner service**

Load the `tdsk-agent` skill and locate the AgentRunner code. The integration point is where sandbox tools are created — add a conditional path for kubernetes sandboxes:

```typescript
// When sandbox provider is 'kubernetes':
if (config.provider === 'kubernetes') {
  // Connect to existing persistent pod (auto-started on agent interaction)
  sandbox = await sandboxService.getSandbox(podName)
} else {
  // Existing local sandbox flow
  const provider = createSandboxProvider(config.provider)
  sandbox = await provider.create(config)
}
```

**Step 2: Add auto-start logic**

When a user begins agent interaction and a K8s sandbox is configured:
1. Check if pod exists for (userId, projectId, sandboxId)
2. If no pod: call `sandboxService.startPod()`
3. If pod exists but not running: restart
4. If running: reuse

**Step 3: Run type checks and tests**

Run: `cd repos/backend && pnpm types && pnpm test`
Expected: PASS

---

## Phase 13: Backend Initialization

### Task 28: Initialize K8s Services on Backend Startup

**Files:**
- Modify: `repos/backend/src/middleware/` (server setup)

**Step 1: Add KubeClient initialization**

In the backend server startup sequence (likely `setupDatabase.ts` or a new `setupSandbox.ts` middleware):

```typescript
import { KubeClient } from '@tdsk/sandbox/kube/kubeClient'
import { setupKubeWatcher } from '@tdsk/sandbox/kube/kubeEvents'
import { SandboxService } from '@TBE/services/sandboxes/sandboxService'

export const setupSandbox = async (app: Express) => {
  const kubeClient = new KubeClient()

  // Hydrate route maps from existing K8s pods
  await kubeClient.hydrate()

  // Start watching for pod events
  setupKubeWatcher(kubeClient)

  // Create SandboxService and attach to app
  const sandboxService = new SandboxService(kubeClient, app.locals.db)

  app.locals.kubeClient = kubeClient
  app.locals.sandboxService = sandboxService
}
```

**Step 2: Call setupSandbox in server initialization**

Add the call to the backend server startup sequence (after database is initialized).

**Step 3: Run type checks**

Run: `cd repos/backend && pnpm types`
Expected: PASS

---

## Phase 14: Testing

### Task 29: Write Unit Tests for Pod Manifest Builder

**Files:**
- Create: `repos/sandbox/src/kube/podManifest.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { buildPodManifest, buildPodName, buildSubdomain } from './podManifest'
import { Sandbox } from '@tdsk/domain'

describe('podManifest', () => {
  describe('buildPodName', () => {
    it('should generate a pod name with tdsk-sb prefix', () => {
      const name = buildPodName('abc12345xy')
      expect(name).toMatch(/^tdsk-sb-abc12345-[a-z0-9]{4}$/)
    })
  })

  describe('buildSubdomain', () => {
    it('should generate sb- prefixed subdomain from sandbox ID', () => {
      expect(buildSubdomain('abc12345xy')).toBe('sb-abc12345')
    })
  })

  describe('buildPodManifest', () => {
    it('should build a valid pod manifest', () => {
      const sandbox = new Sandbox({
        id: 'test123456',
        name: 'Test Sandbox',
        orgId: 'org1',
        config: {
          image: 'node:20',
          ports: { '3000': { protocol: 'http' } },
          envVars: { NODE_ENV: 'development' },
          resources: {
            limits: { cpu: '500m', memory: '512Mi' },
          },
        },
      })

      const manifest = buildPodManifest({
        sandbox,
        userId: 'user1',
        projectId: 'proj1',
        orgId: 'org1',
        placeholders: { tdsk_ph_abc123: 'secret-1' },
      })

      expect(manifest.apiVersion).toBe('v1')
      expect(manifest.kind).toBe('Pod')
      expect(manifest.metadata?.labels?.['tdsk.app/managed']).toBe('true')
      expect(manifest.metadata?.labels?.['tdsk.app/sandbox-id']).toBe('test123456')
      expect(manifest.spec?.initContainers).toHaveLength(1)
      expect(manifest.spec?.containers).toHaveLength(1)
      expect(manifest.spec?.containers?.[0]?.image).toBe('node:20')
      expect(manifest.spec?.volumes).toHaveLength(1)
    })

    it('should include iptables init container', () => {
      const sandbox = new Sandbox({
        id: 'test123456',
        name: 'Test',
        orgId: 'org1',
        config: { image: 'node:20' },
      })

      const manifest = buildPodManifest({
        sandbox,
        userId: 'u1',
        projectId: 'p1',
        orgId: 'org1',
        placeholders: {},
      })

      const init = manifest.spec?.initContainers?.[0]
      expect(init?.name).toBe('proxy-redirect')
      expect(init?.securityContext?.capabilities?.add).toContain('NET_ADMIN')
    })

    it('should store placeholders in annotations', () => {
      const sandbox = new Sandbox({
        id: 'test123456',
        name: 'Test',
        orgId: 'org1',
        config: { image: 'node:20', secretIds: ['s1'] },
      })

      const placeholders = { tdsk_ph_token1: 's1' }
      const manifest = buildPodManifest({
        sandbox,
        userId: 'u1',
        projectId: 'p1',
        orgId: 'org1',
        placeholders,
      })

      const ann = manifest.metadata?.annotations?.['tdsk.app/placeholders']
      expect(JSON.parse(ann!)).toEqual(placeholders)
    })
  })
})
```

**Step 2: Run tests**

Run: `cd repos/sandbox && pnpm test`
Expected: New tests pass alongside existing 57 tests

---

### Task 30: Write Unit Tests for Route Utilities

**Files:**
- Create: `repos/sandbox/src/kube/kubeRoutes.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { buildSandboxUrl, parseSandboxHost } from './kubeRoutes'

describe('kubeRoutes', () => {
  describe('buildSandboxUrl', () => {
    it('should build URL with port and subdomain', () => {
      const url = buildSandboxUrl('abc12345xy', '3000')
      expect(url).toBe('http://3000.sb-abc12345.sandbox.threadedstack.app')
    })

    it('should support https protocol', () => {
      const url = buildSandboxUrl('abc12345xy', 8080, 'https')
      expect(url).toBe('https://8080.sb-abc12345.sandbox.threadedstack.app')
    })
  })

  describe('parseSandboxHost', () => {
    it('should parse valid sandbox hostname', () => {
      const result = parseSandboxHost('3000.sb-a1b2c3d4.sandbox.threadedstack.app')
      expect(result).toEqual({ port: '3000', subdomain: 'sb-a1b2c3d4' })
    })

    it('should return null for non-sandbox hostname', () => {
      expect(parseSandboxHost('threadedstack.app')).toBeNull()
      expect(parseSandboxHost('local.threadedstack.app')).toBeNull()
    })

    it('should return null for hostname without sb- prefix', () => {
      expect(parseSandboxHost('3000.nope.sandbox.threadedstack.app')).toBeNull()
    })

    it('should return null for non-numeric port', () => {
      expect(parseSandboxHost('abc.sb-test1234.sandbox.threadedstack.app')).toBeNull()
    })
  })
})
```

**Step 2: Run tests**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass

---

### Task 31: Write Unit Tests for KubeSandbox

**Files:**
- Create: `repos/sandbox/src/kube/kubeSandbox.test.ts`

**Step 1: Write tests with mocked KubeClient**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KubeSandbox } from './kubeSandbox'

const mockClient = {
  runInPod: vi.fn(),
}

describe('KubeSandbox', () => {
  let sandbox: KubeSandbox

  beforeEach(() => {
    vi.clearAllMocks()
    sandbox = new KubeSandbox(mockClient as any, 'test-pod')
  })

  it('should run commands via K8s API', async () => {
    mockClient.runInPod.mockResolvedValue({
      success: true,
      output: 'hello',
      exitCode: 0,
    })

    const result = await sandbox.exec('echo hello')
    expect(result.success).toBe(true)
    expect(result.output).toBe('hello')
    expect(mockClient.runInPod).toHaveBeenCalledWith(
      'test-pod',
      ['sh', '-c', 'echo hello']
    )
  })

  it('should read files via cat', async () => {
    mockClient.runInPod.mockResolvedValue({
      success: true,
      output: 'file contents',
      exitCode: 0,
    })

    const result = await sandbox.readFile('/workspace/test.txt')
    expect(result).toBe('file contents')
    expect(mockClient.runInPod).toHaveBeenCalledWith('test-pod', ['cat', '/workspace/test.txt'])
  })

  it('should check file existence via test -e', async () => {
    mockClient.runInPod.mockResolvedValue({ success: true, exitCode: 0, output: '' })

    const exists = await sandbox.fileExists('/workspace/test.txt')
    expect(exists).toBe(true)
  })

  it('should return false for non-existent files', async () => {
    mockClient.runInPod.mockResolvedValue({ success: false, exitCode: 1, output: '' })

    const exists = await sandbox.fileExists('/workspace/nope.txt')
    expect(exists).toBe(false)
  })

  it('should create directories via mkdir -p', async () => {
    mockClient.runInPod.mockResolvedValue({ success: true, exitCode: 0, output: '' })

    await sandbox.mkdir('/workspace/src/lib')
    expect(mockClient.runInPod).toHaveBeenCalledWith('test-pod', ['mkdir', '-p', '/workspace/src/lib'])
  })

  it('should delete files via rm -rf', async () => {
    mockClient.runInPod.mockResolvedValue({ success: true, exitCode: 0, output: '' })

    await sandbox.deleteFile('/workspace/old.txt')
    expect(mockClient.runInPod).toHaveBeenCalledWith('test-pod', ['rm', '-rf', '/workspace/old.txt'])
  })

  it('should evaluate code by writing to temp file and running with runtime', async () => {
    // mkdir for temp dir
    mockClient.runInPod.mockResolvedValueOnce({ success: true, exitCode: 0, output: '' })
    // writeFile for main code
    mockClient.runInPod.mockResolvedValueOnce({ success: true, exitCode: 0, output: '' })
    // exec the runtime command
    mockClient.runInPod.mockResolvedValueOnce({ success: true, exitCode: 0, output: 'hello world\n' })
    // cleanup rm -rf
    mockClient.runInPod.mockResolvedValueOnce({ success: true, exitCode: 0, output: '' })

    const result = await sandbox.evaluate('console.log("hello world")')
    expect(result.output).toBe('hello world\n')
    expect(result.result).toBeUndefined()
  })

  it('should throw if runtime is not available', async () => {
    await expect(
      sandbox.evaluate('print("hi")', { runtime: 'ruby' } as any)
    ).rejects.toThrow('Runtime "ruby" not available')
  })

  it('should not delete pod on close', async () => {
    await sandbox.close()
    // No calls to deletePod — persistent workspace
    expect(mockClient.runInPod).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run tests**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass

---

### Task 32: Integration Tests (Requires K8s)

**Files:**
- Create: `repos/integration/src/tier1/sandbox-config-crud.test.ts`

**Step 1: Write API integration tests for sandbox config CRUD**

Follow the existing integration test pattern:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadEnvs } from '../utils/loadEnvs'

const env = loadEnvs()

describe('Sandbox Config CRUD', () => {
  let sandboxId: string

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.testApiKey}`,
  }

  it('should create a sandbox config', async () => {
    const resp = await fetch(`${env.baseUrl}/_/templates/sandboxes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Node Sandbox',
        orgId: env.testOrgId,
        config: {
          image: 'node:20',
          ports: { '3000': { protocol: 'http' } },
          workdir: '/workspace',
        },
      }),
    })

    expect(resp.status).toBe(201)
    const { data } = await resp.json()
    expect(data.name).toBe('Test Node Sandbox')
    expect(data.config.image).toBe('node:20')
    sandboxId = data.id
  })

  it('should list sandbox configs', async () => {
    const resp = await fetch(
      `${env.baseUrl}/_/templates/sandboxes?orgId=${env.testOrgId}`,
      { headers }
    )

    expect(resp.status).toBe(200)
    const { data } = await resp.json()
    expect(data.length).toBeGreaterThanOrEqual(1)
  })

  it('should get sandbox config by ID', async () => {
    const resp = await fetch(
      `${env.baseUrl}/_/templates/sandboxes/${sandboxId}?orgId=${env.testOrgId}`,
      { headers }
    )

    expect(resp.status).toBe(200)
    const { data } = await resp.json()
    expect(data.id).toBe(sandboxId)
  })

  it('should update sandbox config', async () => {
    const resp = await fetch(`${env.baseUrl}/_/templates/sandboxes/${sandboxId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        orgId: env.testOrgId,
        name: 'Updated Node Sandbox',
      }),
    })

    expect(resp.status).toBe(200)
    const { data } = await resp.json()
    expect(data.name).toBe('Updated Node Sandbox')
  })

  it('should delete sandbox config', async () => {
    const resp = await fetch(`${env.baseUrl}/_/templates/sandboxes/${sandboxId}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ orgId: env.testOrgId }),
    })

    expect(resp.status).toBe(200)
  })
})
```

**Step 2: Run integration tests**

Run: `cd repos/integration && pnpm test`
Expected: Sandbox CRUD tests pass (requires K8s services running)

---

## Verification Checklist

After all tasks are complete:

1. **Type checks pass across all repos:**
   ```bash
   cd repos/domain && pnpm types
   cd repos/database && pnpm types
   cd repos/sandbox && pnpm types
   cd repos/backend && pnpm types
   cd repos/admin && pnpm types
   ```

2. **Unit tests pass:**
   ```bash
   cd repos/sandbox && pnpm test    # 57+ tests
   cd repos/backend && pnpm test
   cd repos/admin && pnpm test
   ```

3. **Integration tests pass (requires K8s):**
   ```bash
   cd repos/integration && pnpm test
   ```

4. **K8s deployment works:**
   ```bash
   tdsk dev start --clean
   # Verify ServiceAccount and Role created
   # Verify NetworkPolicy applied
   # Verify Caddy handles sandbox subdomains
   ```

5. **E2E flow works:**
   - Create sandbox config via API or Admin UI
   - Start sandbox pod via API
   - Run commands via API
   - Access sandbox web services via subdomain
   - Stop sandbox pod
