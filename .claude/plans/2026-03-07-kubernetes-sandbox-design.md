# Kubernetes Dynamic Pod Sandbox System — Design

## Overview

Build a new sandbox type (`ESandboxType.kubernetes`) that provisions real Kubernetes pods as persistent workspaces for AI agent execution. Unlike the existing local sandbox (in-memory virtual FS + just-bash + V8 isolate), this provides a full VM container with real filesystem, shell, network, and process management.

The system adapts patterns from the conductor reference implementation (`.temp/conductor/`) into the ThreadedStack codebase while adding secret security, database-backed configuration, and admin UI.

## Core Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pod lifecycle | Persistent workspaces | Pods survive between agent runs; agent reconnects. Cleaned up by idle timeout or manual deletion. |
| Backend communication | K8s exec API | Native streaming (WebSocket/SPDY) for stdin/stdout/stderr. No sidecar needed. Works with any image. |
| URL routing | Subdomain-based | `{port}.{sandboxId}.sandbox.threadedstack.app` — clean URLs, apps work at root path. |
| Sandbox ownership | Org-scoped configs, user-scoped pods | Config blueprints belong to org (shared). Running pods keyed by (userId, projectId, sandboxId). |
| Runtime state | K8s labels/annotations + in-memory hydration | No runtime state in DB. K8s is source of truth. Hydration rebuilds route maps on startup. |
| Config storage | `sandboxes` DB table | Stores configuration blueprints only (image, ports, resources, etc.). |
| Secret security | iptables init container + MITM proxy + NetworkPolicy | Fully transparent interception. Sandbox code has zero knowledge. Secrets never enter the pod. |
| ISandbox.evaluate | Required — implemented via write-file + exec | KubeSandbox writes code to temp file, runs with configured runtime (node, python). Returns stdout as output, result is undefined. |
| Storage | Ephemeral (v1) | emptyDir. PersistentVolumeClaim planned for later. |
| Docker images | Both pre-built and custom | Base images as defaults, users can specify custom images + private registry pull secrets. |
| Quotas | New `activeSandboxes` field | Enforced at pod creation, scales with subscription tier. |
| Auto-start | On agent interaction | Sandbox starts automatically when user interacts with agent via REPL/API/Chat. Admin UI has debug Start/Stop. |

---

## Architecture

### Component Distribution

```
repos/sandbox/src/
├── kube/kubeSandbox.ts                  — ISandbox implementation (file ops and shell via K8s API)
├── kube/kubeSandboxProvider.ts          — ISandboxProvider (create/configure sandboxes)
├── kube/kubeClient.ts                   — K8s API wrapper (pod CRUD, shell, watch) — adapted from conductor's kubectl.ts
├── kube/podManifest.ts                  — Pod manifest builders — adapted from conductor's pod/ directory
├── kube/kubeEvents.ts                   — K8s event watcher (ADDED/MODIFIED/DELETED + cycle listening)
├── kube/kubeProxy.ts                    — Dynamic proxy creation — adapted from conductor's proxy/
├── kube/kubeRoutes.ts                   — Route/URL generation (subdomain generation, route tables)
└── types/kube.types.ts                    — All K8s sandbox types

repos/domain/src/
├── types/sandbox.types.ts          — Add ESandboxType.kubernetes, TKubeSandboxConfig, make evaluate optional
├── models/sandbox.ts               — Sandbox model class
└── models/index.ts                 — Export new model

repos/database/src/
├── schemas/sandboxes.ts            — New 'sandboxes' table
├── services/sandbox.ts             — Sandbox DB service (CRUD)
└── schemas/quotas.ts               — Add activeSandboxes field

repos/backend/src/
├── routes/sandboxes/               — CRUD API routes (/_/templates/sandboxes/*, /_/sandboxes/*)
├── services/sandboxes/             — SandboxService (DB + K8s orchestration bridge)
├── services/sandboxEgress/         — MITM egress proxy (transparent HTTPS forward proxy)
└── middleware/sandboxProxy.ts      — Dynamic subdomain proxy middleware

repos/proxy/src/
└── (minimal changes)               — Forward sandbox subdomain requests to backend

repos/admin/src/
├── components/Sandboxes/           — Sandbox config UI (image, ports, envs, resources)
├── pages/Orgs/OrgSandboxes.tsx     — Org-level sandbox config management
└── pages/Projects/ProjectSandboxes — Project-level sandbox instance management

deploy/
├── devspace.yaml                   — ServiceAccount + RBAC via customServiceAccount
├── templates/networkpolicy.yaml    — Egress rules for sandbox pods
└── Caddyfile                       — Wildcard subdomain config for *.sandbox.*
```

### Request Flows

**Agent Tool Execution:**
```
Agent Tool Call (shell/readFile/writeFile)
  → Backend AgentRunner
    → KubeSandbox methods
      → K8s API (WebSocket streams)
        → Pod stdin/stdout/stderr
```

**Sandbox Web Service Access:**
```
Browser → Caddy (wildcard TLS: *.sandbox.threadedstack.app)
  → Proxy (auth validation — JWT or API key)
    → Backend (sandboxProxy middleware)
      → Parse subdomain: extract sandboxId + port
      → Lookup in-memory route map: sandboxId → podIP
      → http-proxy-middleware forwards to podIP:port
```

**Sandbox Egress (secret injection):**
```
Code in sandbox calls fetch('https://api.openai.com/...')
  → iptables (init container) intercepts port 80/443
    → Request redirected to tdsk-backend:5885
      → Backend MITM proxy terminates TLS
        → Inspects headers, replaces placeholder tokens with real secrets
          → Backend makes real HTTPS call to destination
            → Response returned to sandbox
NetworkPolicy blocks any attempt to bypass this chain
```

**Sandbox Auto-Start (on agent interaction):**
```
User starts agent interaction (REPL/API/Chat) for a project
  → System checks: does a pod exist for (userId, projectId, sandboxId)?
    → No pod: create sandbox record (if needed) + create pod from config
    → Pod exists but stopped: restart pod
    → Pod running: reconnect agent to existing pod
  → Agent tools bridge to KubeSandbox connected to running pod
```

---

## Data Model

### `sandboxes` Table (New)

Stores configuration blueprints only. Runtime state comes from K8s.

```
sandboxes:
  id              uuid PK
  createdAt       timestamp
  updatedAt       timestamp
  name            varchar NOT NULL
  orgId           FK → organizations (cascade) NOT NULL
  userId          FK → users (nullable) — null=org-wide config, set=user personal preset
  config          jsonb NOT NULL (TKubeSandboxConfig)

  INDEX (orgId)
  INDEX (orgId, userId)
```

**Config JSONB Structure (`TKubeSandboxConfig`):**
```typescript
{
  image: string                          // e.g., "node:20", "ghcr.io/org/custom:latest"
  command?: string[]                     // Entrypoint override
  args?: string[]                        // Entrypoint args
  workdir?: string                       // Working directory (default: /workspace)
  ports?: Record<string, TPortConfig>    // Exposed ports: { "3000": { protocol: "http" } }
  envVars?: Record<string, string>       // Environment variables
  resources?: {
    limits?: { cpu?: string, memory?: string }
    requests?: { cpu?: string, memory?: string }
  }
  secretIds?: string[]                   // Secret IDs → placeholder tokens generated at pod creation
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never'
  imagePullSecret?: string              // For private registries
  runtimes?: TSandboxRuntime[]          // Available code runtimes (e.g. node, python)
  defaultRuntime?: string               // Matches runtime.name — used by evaluate()
}

// Runtime definition for evaluate() support
type TSandboxRuntime = {
  name: string        // 'node', 'python'
  command: string     // 'node', 'python3'
  extension: string   // '.js', '.py'
}
```

### Pod Labels & Annotations (K8s Runtime State)

```yaml
labels:
  tdsk.app/managed: "true"              # Identifies TDSK-managed sandbox pods
  tdsk.app/sandbox-id: "<sandboxes.id>" # Links to config in DB
  tdsk.app/user-id: "<userId>"
  tdsk.app/project-id: "<projectId>"
  tdsk.app/org-id: "<orgId>"

annotations:
  tdsk.app/ports: '{"3000":{"protocol":"http"},"8080":{"protocol":"http"}}'
  tdsk.app/placeholders: '{"tdsk_ph_abc123":"secretId1","tdsk_ph_def456":"secretId2"}'
  tdsk.app/subdomain: "<generated-subdomain>"
```

### Quota Addition

```
quotas table — add field:
  activeSandboxes  integer (default 0)
```

Incremented on pod creation, decremented on pod deletion. Enforced at pod creation time against subscription tier limits.

### ISandbox Interface — No Change

`evaluate` stays **required**. `KubeSandbox` implements it by writing code to a temp file and running it via `exec` with the configured runtime. Returns `{ output: stdout, result: undefined }`.

```typescript
interface ISandbox {
  exec(command: string, args?: string[]): Promise<TSandboxResult>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDir(path: string): Promise<string[]>
  deleteFile(path: string): Promise<void>
  mkdir(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
  evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult>  // REQUIRED — both providers implement
  reset(): Promise<void>
  close(): Promise<void>
}
```

### Sandbox Domain Model

```typescript
class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string    // null = org-wide config, set = user preset
  config: TKubeSandboxConfig
}
```

---

## K8s Infrastructure

### RBAC (via DevSpace)

Add to `deploy/devspace.yaml` under the tdsk-backend deployment:

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

The `@kubernetes/client-node` library auto-loads in-cluster credentials from the mounted service account token (`loadFromCluster()`).

### NetworkPolicy

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
    - to:
        - podSelector:
            matchLabels:
              app: tdsk-backend
      ports:
        - port: 5885
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
```

Enforced at kernel level via iptables/eBPF. All HTTP clients, raw sockets, and network tools are blocked equally if they bypass the proxy.

**CNI Requirement:** The cluster CNI must support NetworkPolicy. Calico, Cilium, and Weave all do. Flannel does NOT by default.

### Pod Lifecycle & Event Watching

Adapted from conductor's `kubectl.ts`:

**Backend Startup:**
1. Initialize KubeClient (`loadFromCluster()` or `loadFromDefault()`)
2. `hydrate()` — scan all pods with label `tdsk.app/managed=true`
   - Rebuild in-memory route maps from pod annotations
   - Remove orphaned/failed/terminated pods (via `shouldHydrate()` / `shouldRemove()`)
3. `watch()` — start K8s pod watch with cycle listening (restart every 10 min)
   - `ADDED` / `MODIFIED` → `hydrateSingle()` (update route maps)
   - `DELETED` → `removeFromCache()` (clean route maps)
   - `BOOKMARK` → keep-alive, no action
   - `ERROR` → log and restart watch

**Pod Creation:**
1. Look up sandbox config from DB
2. Build pod manifest (image, ports, envs, resources, labels, annotations)
3. Generate placeholder tokens for secretIds → store in annotations
4. Add init container for iptables redirect
5. Mount CA cert volume
6. Create pod via K8s API
7. Watch events update state → route maps populated when pod reaches Running
8. Increment `activeSandboxes` quota

**Pod Deletion:**
1. Delete pod via K8s API (`gracePeriodSeconds` configurable)
2. Watch `DELETED` event → `removeFromCache()`
3. Decrement `activeSandboxes` quota

---

## Secret Security — Transparent Egress Interception

### Design Principle

All outbound HTTP/HTTPS traffic from sandbox pods is transparently intercepted and routed through `tdsk-backend`. The sandbox code (including any AI agent) has zero knowledge of this. Secrets never enter the sandbox pod.

### Layer 1: Init Container (iptables Redirect)

Added to every sandbox pod spec. Redirects ALL outbound port 80/443 traffic to `tdsk-backend:5885` before the sandbox container starts.

```yaml
initContainers:
  - name: proxy-redirect
    image: alpine
    securityContext:
      capabilities:
        add: [NET_ADMIN]
    command:
      - sh
      - -c
      - |
        apk add --no-cache iptables
        iptables -t nat -A OUTPUT -p tcp --dport 80 -j DNAT --to-destination tdsk-backend:5885
        iptables -t nat -A OUTPUT -p tcp --dport 443 -j DNAT --to-destination tdsk-backend:5885
```

The `NET_ADMIN` capability is required ONLY on the init container, not the sandbox container itself. iptables rules persist in the pod's network namespace after the init container exits.

### Layer 2: Backend MITM Proxy

The `tdsk-backend` service implements a transparent HTTPS forward proxy:

**HTTP (port 80):**
- Receives the redirected request
- Inspects and replaces `Authorization: Bearer <token_placeholder>` (and other configured headers/body patterns) with real secret values
- Forwards the modified request to the original destination

**HTTPS (port 443 via CONNECT):**
- Receives the `CONNECT` request from the redirected client
- Performs SSL interception (MITM): terminates TLS, inspects headers, substitutes tokens, re-encrypts and forwards to the real destination
- Requires a self-signed CA cert injected into the sandbox container's trust store

**Token Substitution Logic:**
- Maintains a map of placeholder strings to real secret values
- Loaded from pod annotations (`tdsk.app/placeholders`) during hydration
- On every proxied request, scans Authorization headers (and optionally request bodies) for known placeholders and replaces before forwarding

**Recommended Node.js Libraries:**
- `node-http-mitm-proxy` — purpose-built for transparent MITM proxying
- `http-proxy` — for standard HTTP forwarding
- Custom `http.createServer` + `tls.connect` for fine-grained control

### Layer 3: CA Cert Injection

Mount the proxy's CA cert into the sandbox container so HTTPS requests pass TLS verification:

```yaml
volumes:
  - name: proxy-ca-cert
    secret:
      secretName: tdsk-proxy-ca

containers:
  - name: sandbox
    volumeMounts:
      - name: proxy-ca-cert
        mountPath: /usr/local/share/ca-certificates/tdsk-proxy.crt
        subPath: ca.crt
    lifecycle:
      postStart:
        exec:
          command: ["update-ca-certificates"]
```

The CA cert is generated once and stored as a K8s Secret (`tdsk-proxy-ca`). The backend uses the corresponding private key for MITM TLS termination.

### Layer 4: NetworkPolicy (Defense in Depth)

Even if iptables rules are somehow bypassed, the NetworkPolicy blocks all direct egress from sandbox pods. Only traffic to `tdsk-backend:5885` and `kube-dns:53` is allowed.

### Enforcement Chain

```
sandbox code calls fetch('https://api.openai.com/...')
  ↓
iptables (init container) intercepts port 443
  ↓
request redirected to tdsk-backend:5885
  ↓
backend terminates TLS, inspects headers, substitutes placeholder tokens
  ↓
backend makes the real HTTPS call to the destination
  ↓
NetworkPolicy blocks any attempt to bypass this chain entirely
```

### Placeholder Token Format

```
tdsk_ph_<16 random alphanumeric chars>
Example: tdsk_ph_a3f8c912b7e4d601
```

Generated at pod creation time. Mapping stored in pod annotation `tdsk.app/placeholders`:
```json
{
  "tdsk_ph_a3f8c912b7e4d601": "secret-id-uuid-1",
  "tdsk_ph_x9k2m5p8r1t4w7z3": "secret-id-uuid-2"
}
```

The backend resolves `secret-id-uuid-*` to the actual decrypted secret value using the existing `SecretResolver` / crypto utilities.

---

## KubeSandbox Implementation (repos/sandbox/)

### Provider Registration

```typescript
// sandbox.ts — updated factory
const providers = new Map<TSandboxType, () => ISandboxProvider>([
  [ESandboxType.local, () => new LocalSandboxProvider()],
  [ESandboxType.kubernetes, () => new KubeSandboxProvider()],
])
```

### KubeSandboxProvider

```typescript
class KubeSandboxProvider implements ISandboxProvider {
  readonly type = ESandboxType.kubernetes

  async create(config: TKubeSandboxConfig): Promise<ISandbox> {
    // 1. Initialize KubeClient (in-cluster or kubeconfig)
    // 2. Build pod manifest from config (buildPodManifest)
    // 3. Create pod via K8s API
    // 4. Wait for pod to reach Running state
    // 5. Return KubeSandbox instance connected to the pod
  }
}
```

### KubeSandbox (ISandbox Implementation)

All operations via K8s API using `@kubernetes/client-node`:

```typescript
class KubeSandbox implements ISandbox {
  constructor(
    private client: KubeClient,
    private podName: string,
    private runtimes?: TSandboxRuntime[],   // from TKubeSandboxConfig
    private defaultRuntime?: string         // from TKubeSandboxConfig
  ) {}

  // Shell operations via K8s API → WebSocket streams → { success, output, error, exitCode }
  async exec(command: string, args?: string[]): Promise<TSandboxResult>

  // File operations via K8s API shell commands
  async readFile(path: string): Promise<string>       // runs 'cat <path>' → stdout
  async writeFile(path: string, content: string): Promise<void>  // runs 'printf' with stdin
  async listDir(path: string): Promise<string[]>      // runs 'ls -1a' → parse, prefix dirs with [DIR]
  async deleteFile(path: string): Promise<void>        // runs 'rm <path>'
  async mkdir(path: string): Promise<void>             // runs 'mkdir -p <path>'
  async fileExists(path: string): Promise<boolean>     // runs 'test -e <path>' → boolean from exit code

  // Code evaluation — writes to temp file, runs with configured runtime
  // Returns { output: stdout, result: undefined }
  async evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult>
  // 1. Write opts.modules to /tmp as files (if provided)
  // 2. Write main code to /tmp/<random>.<ext>
  // 3. Run: <runtime.command> /tmp/<random>.<ext>
  // 4. Cleanup temp files
  // 5. Return { output: stdout, result: undefined }

  async reset(): Promise<void>   // runs 'rm -rf /workspace/* /tmp/*'
  async close(): Promise<void>   // Disconnect client (does NOT delete pod — persistent workspace)
}
```

### KubeClient (K8s API Wrapper)

Adapted from conductor's `kubectl.ts`:

```typescript
class KubeClient {
  // Pod CRUD
  createPod(manifest: V1Pod): Promise<V1Pod>
  getPod(name: string): Promise<V1Pod>
  listPods(labelSelector: string): Promise<V1Pod[]>
  deletePod(name: string, gracePeriod?: number): Promise<void>

  // Command execution (streaming via K8s API WebSocket)
  runInPod(podName: string, command: string[], stdin?: Readable): Promise<TSandboxResult>

  // Watch
  watch(labelSelector: string, events: TKubeEventHandlers): Promise<void>
  cycleListen(intervalMs?: number): void  // Restart watch every 10 min (K8s client bug workaround)

  // Hydration
  hydrate(): Promise<TRouteMap>           // Rebuild route maps from cluster state
  hydrateSingle(pod: V1Pod): void         // Update single pod in route maps
  removeFromCache(pod: V1Pod): void       // Remove pod from route maps
}
```

### Pod Manifest Builder

Adapted from conductor's `pod/` directory:

```typescript
buildPodManifest(sandbox: Sandbox, placeholders: TPlaceholderMap): V1Pod
  ├── buildMeta()            → labels, annotations (tdsk.app/*, placeholder mappings)
  ├── buildSpec()            → restartPolicy: Never, serviceAccountName: none, security
  ├── buildContainers()      → image, command, args, ports, resources, CA cert volume mount
  ├── buildInitContainers()  → iptables redirect init container (NET_ADMIN)
  ├── buildEnvs()            → env vars with placeholder tokens (never real secrets)
  ├── buildPorts()           → containerPort mappings from config
  ├── buildSecurity()        → allowPrivilegeEscalation: false, privileged: false
  ├── buildResources()       → CPU/memory limits and requests
  └── buildVolumes()         → CA cert secret volume
```

---

## Dynamic Proxy & Subdomain Routing

### URL Structure

```
{port}.{sandboxSlug}.sandbox.threadedstack.app
```

Examples:
- `3000.sb-a1b2c3d4.sandbox.threadedstack.app` → pod port 3000
- `8080.sb-a1b2c3d4.sandbox.threadedstack.app` → pod port 8080

The `sandboxSlug` is derived from the sandbox DB record ID (first 8 chars of UUID, prefixed with `sb-`).

### Caddy Configuration

```
*.sandbox.{$TDSK_HOST:threadedstack.app} {
    reverse_proxy tdsk-proxy:{$TDSK_PROXY_PORT:7118}
}
```

Wildcard TLS via Caddy certmagic. Requires wildcard DNS A record for `*.sandbox.threadedstack.app`.

### Routing Chain

```
Browser → Caddy (wildcard TLS) → Proxy (auth) → Backend (sandboxProxy middleware)
  → Parse Host header: extract port + sandboxSlug
  → Lookup in-memory route map: sandboxSlug → podIP
  → http-proxy-middleware forwards to podIP:port
```

### In-Memory Route Map

Adapted from conductor's route management:

```typescript
// Route map structure
routes: {
  [sandboxSlug]: {
    meta: { podIp: string, state: EContainerState, sandboxId: string, podName: string }
    ports: {
      [port]: { host: string, port: number, protocol: 'http' | 'https' }
    }
  }
}
```

Rebuilt from K8s labels/annotations via `hydrate()` on startup, updated in real-time via watch events.

### WebSocket Support

HTTP upgrade requests on sandbox subdomains are handled by the proxy upgrade handler (adapted from conductor's `proxyUpgrade` pattern). Intercepts upgrade requests and routes to the correct pod/port.

---

## Backend API

### Sandbox Config Routes (`/_/templates/sandboxes/`)

```
POST   /_/templates/sandboxes              → Create sandbox config (org-scoped)
GET    /_/templates/sandboxes              → List configs for org (+ user presets)
GET    /_/templates/sandboxes/:id          → Get config
PUT    /_/templates/sandboxes/:id          → Update config
DELETE /_/templates/sandboxes/:id          → Delete config
```

Query: `GET /_/templates/sandboxes?orgId=<orgId>` returns both org-level (userId=null) and current user's presets (userId=currentUser).

### Sandbox Instance Routes (`/_/sandboxes/`)

```
POST   /_/sandboxes                        → Create sandbox instance (start pod from config)
GET    /_/sandboxes                        → List running sandboxes (filter by projectId, userId)
GET    /_/sandboxes/:id                    → Get sandbox state (from K8s)
DELETE /_/sandboxes/:id                    → Delete sandbox (stop pod)

POST   /_/sandboxes/:id/start             → Start pod (debug/testing)
POST   /_/sandboxes/:id/stop              → Stop pod (delete pod, keep config)
POST   /_/sandboxes/:id/restart           → Restart pod
GET    /_/sandboxes/:id/status            → Pod state (Running, Pending, Failed, etc.)
POST   /_/sandboxes/:id/exec             → Run command in pod (returns result)
```

### Backend SandboxService

Orchestrates between DB (config records) and K8s (pod operations):

```typescript
class SandboxService {
  // Config CRUD (database)
  createConfig(orgId, data): Promise<Sandbox>
  listConfigs(orgId, userId?): Promise<Sandbox[]>

  // Pod operations (K8s)
  startPod(sandboxId, projectId, userId): Promise<void>
  stopPod(sandboxId, projectId, userId): Promise<void>
  getPodState(sandboxId, projectId, userId): Promise<TContainerState>

  // ISandbox bridge (for AgentRunner)
  getSandbox(sandboxId, projectId, userId): Promise<ISandbox>
  // Returns KubeSandbox connected to existing running pod
}
```

### AgentRunner Integration

```typescript
// When sandbox provider is 'kubernetes':
if (config.provider === 'kubernetes') {
  // Connect to existing persistent pod (auto-started on agent interaction)
  sandbox = await sandboxService.getSandbox(config.sandboxId, config.projectId, config.userId)
} else {
  // Existing local sandbox flow
  const provider = createSandboxProvider(config.provider)
  sandbox = await provider.create(config)
}
```

The agent connects to an EXISTING pod (persistent workspace) rather than creating a new one. Same sandbox tools work via KubeSandbox.

---

## Admin UI

### Sandbox Configs Page (Org-Level)

Route: `/orgs/:orgId/templates/sandboxes`

Table listing all sandbox configs for the org:

| Column | Content |
|---|---|
| Name | Config name (e.g., "Node.js Dev", "Python ML") |
| Scope | Org-wide / User preset |
| Image | Docker image |
| Ports | Exposed ports |
| Resources | CPU/Memory limits |
| Actions | Edit, Delete |

**Create/Edit Drawer** — form with:
- Name (required)
- Image (required, autocomplete for common base images: node:20, python:3.12, ubuntu:24.04)
- Command / Args (optional entrypoint override)
- Working directory (default: /workspace)
- Exposed ports (dynamic list: port number + protocol)
- Environment variables (key-value pairs)
- Secret references (select from org secrets — will become placeholder tokens)
- Resource limits (CPU, Memory — with tier-based maximums)
- Image pull policy / Image pull secret

### Project Sandboxes Page (Project-Level)

Route: `/orgs/:orgId/projects/:projectId/sandboxes`

Shows sandboxes for the current user in this project:

| Column | Content |
|---|---|
| Config | Which sandbox config it uses |
| Status | Running / Stopped / Pending / Failed (live from K8s) |
| URLs | Generated subdomain links per port |
| Actions | Start (debug), Stop, Restart, Delete |

**"Create Sandbox" Flow:**
1. Select a config from org configs or user presets
2. Optionally add per-instance overrides
3. Create → pod started from config

**Detail Panel** (when a sandbox is selected):
- Status badge (live polling)
- Pod info (IP, start time)
- Exposed port URLs (clickable links)
- Logs viewer (optional: pod log streaming)

### State Management (Jotai)

```typescript
sandboxConfigsState: Record<string, Sandbox>    // Org-level configs
activeSandboxConfigIdState: string | undefined

runningSandboxesState: Record<string, TRunningSandbox>  // From K8s hydration
activeSandboxIdState: string | undefined
```

### API Services

```typescript
class SandboxConfigsApi extends BaseApi {
  // CRUD for /_/templates/sandboxes/
}

class SandboxesApi extends BaseApi {
  // Operations for /_/sandboxes/ (start, stop, restart, status)
}
```

---

## Repos Impacted — Summary

| Repo | Changes |
|---|---|
| **domain** | New types: `ESandboxType.kubernetes`, `TKubeSandboxConfig`, `TSandboxRuntime`, `TPlaceholderMap`, `TContainerState`, `TRouteMap`. New model: `Sandbox`. No ISandbox interface change — evaluate stays required. |
| **database** | New `sandboxes` table + service. Add `activeSandboxes` to quotas. |
| **sandbox** | New (`src/kube/`, `src/types/`) directories (7 files). Update factory to register kubernetes provider. |
| **backend** | New routes (`/_/templates/sandboxes/`, `/_/sandboxes/`). New services (SandboxService). MITM egress proxy. sandboxProxy middleware. AgentRunner integration. |
| **proxy** | Forward sandbox subdomain requests to backend. WebSocket upgrade handling for sandbox subdomains. |
| **admin** | Sandbox configs page (org-level). Project sandboxes page. Detail panel. Jotai state + API services. |
| **deploy** | `devspace.yaml`: ServiceAccount + RBAC. `networkpolicy.yaml`: Sandbox egress policy. `Caddyfile`: Wildcard subdomain. CA cert K8s Secret. |

---

## Key Adaptations from Conductor Reference

| Conductor Pattern | ThreadedStack Adaptation |
|---|---|
| In-memory route maps only | Route maps + `sandboxes` DB table for config persistence |
| `userHash` keying | `(userId, projectId, sandboxId)` composite key in pod labels |
| No auth | Full JWT/API key auth through existing proxy chain |
| No secret handling | Placeholder token system with iptables + MITM proxy |
| Generic pod orchestrator | ISandbox interface implementation for agent tool bridge |
| External config only | Admin UI for sandbox configuration |
| Watch cycle every 10 min | Same pattern (K8s client library bug workaround) |
| Pod annotation metadata | Same pattern — ports, subdomain, placeholders stored in annotations |
| `shouldHydrate` / `shouldRemove` | Same lifecycle decision pattern for cleanup |

---

## Important Notes

- The `NET_ADMIN` capability is required only on the init container, not the sandbox container itself
- iptables rules persist in the pod's network namespace after the init container exits
- If the sandbox runs as a non-root user, iptables OUTPUT chain rules still apply to all UIDs
- The cluster CNI must support NetworkPolicy (Calico, Cilium, Weave — NOT Flannel)
- The CA cert must be generated once and stored as K8s Secret `tdsk-proxy-ca`
- The backend's MITM proxy needs the corresponding private key for TLS termination
- Sandbox pods use `restartPolicy: Never` — restarting means creating a new pod
- Pod names follow the pattern: `tdsk-sb-{sandboxSlug}-{random}` for uniqueness
