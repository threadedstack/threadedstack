# Sandbox Connect — Developer Internals

Internal implementation details for Sandbox Connect. For user-facing documentation, see `docs/features/sandbox-connect.md`.


## Technology

### K8s Sandbox Provider

The `KubeSandboxProvider` (`repos/sandbox/src/kube/kubeSandboxProvider.ts`) connects to existing running pods via the `KubeClient`. It implements the `ISandboxProvider` interface and requires a `podName` in its config -- pods are created separately by the `SandboxService`, not by the provider itself.

### Pod Manifest Generation

`buildPodManifest()` in `repos/sandbox/src/kube/podManifest.ts` produces complete K8s pod specs with:

- **Sandbox container** -- Runs the configured Docker image with `sleep infinity` as the default command (overridable). Security context enforces `privileged: false` and `allowPrivilegeEscalation: false`. The CA certificate is volume-mounted at `/etc/tdsk/ca/tls.crt` so the container trusts the MITM proxy's generated TLS certificates (via `NODE_EXTRA_CA_CERTS`).
- **Init container** (`proxy-redirect`) -- An Alpine container with `NET_ADMIN` capability that installs iptables rules redirecting all outbound TCP traffic on ports 80 and 443 to the egress proxy service. This is what makes the MITM interception transparent -- the sandbox code makes normal HTTP/HTTPS requests and they are silently rerouted.
- **Labels and annotations** -- Pods are tagged with `orgId`, `userId`, `sandboxId`, and `projectId` for filtering and ownership validation. Placeholder mappings and port configs are stored as annotations.

### SandboxService (Pod Orchestration)

`SandboxService` in `repos/backend/src/services/sandboxes/sandbox.ts` orchestrates the full pod lifecycle:

- **`initKube()`** -- Initializes the `KubeClient`, hydrates the in-memory route map from existing pods, starts the K8s pod watcher, and registers route-removal callbacks for proxy cache cleanup.
- **`startPod()`** -- Loads sandbox config from the database, generates placeholder tokens (`tdsk_ph_` + nanoid) for each secret, builds the pod manifest, and creates the pod via the K8s API.
- **`stopPod()`** -- Deletes the pod with a 30-second grace period.
- **`getSandbox()`** -- Returns a `KubeSandbox` instance connected to a running pod, used by `AgentRunner` for tool bridging.
- **`listPods()`** -- Filters pods by org, user, project, and state using K8s label selectors.
- **`validatePodOwnership()`** -- Verifies a pod's `orgId` label matches the requesting org before allowing operations.

### KubeSandbox (Pod Operations)

`KubeSandbox` in `repos/sandbox/src/kube/kubeSandbox.ts` implements the `ISandbox` interface for K8s pods. All operations use the Kubernetes API (WebSocket to the K8s API server) -- no host-level shell calls:

- `run()` -- Run shell commands inside the pod via `sh -c`
- `readFile()` / `writeFile()` -- File I/O via `cat` and `printf`
- `evaluate()` -- Write code to a temp file, run with a configured runtime (e.g., `node`), capture stdout, clean up
- `reset()` -- Clear the workspace and temp directories
- `close()` -- Disconnect (does not delete the pod -- lifecycle is managed by `SandboxService`)

### KubeClient (K8s API Wrapper)

`KubeClient` in `repos/sandbox/src/kube/kubeClient.ts` provides:

- Pod CRUD operations (`createPod`, `getPod`, `listPods`, `deletePod`)
- Command runs inside pods via the K8s API (`runInPod`)
- Pod event watching with cycle-based restart to work around stale watch connections (`cycleListen`, backed by `setupKubeWatcher` in `repos/sandbox/src/kube/kubeEvents.ts`)
- In-memory route map hydration from running pods, including port mappings and placeholder maps

### MITM Egress Proxy

`EgressProxy` in `repos/backend/src/services/proxy/egress.ts` intercepts all outbound HTTP/HTTPS traffic from sandbox pods:

- **Protocol sniffing** -- A front TCP server peeks at the first byte of each connection. `0x16` indicates TLS (routes through SNI extraction and CONNECT tunneling); anything else is plain HTTP (piped directly to the MITM proxy).
- **Placeholder replacement** -- The MITM request handler identifies the source pod by IP (via `X-TDSK-Real-IP` header), looks up the pod's placeholder map from the route table, and replaces every `tdsk_ph_*` token in outgoing headers with the corresponding decrypted secret value.
- **Failure safety** -- If a placeholder cannot be resolved (secret deleted, decryption failure), the proxy returns HTTP 502 to the sandbox rather than forwarding the placeholder token to an external service.
- **CA management** -- Uses a custom CA certificate for TLS interception. The library (`http-mitm-proxy`) generates per-hostname certificates signed by this CA on the fly.


## SSH / Connection Layer

The `tsa` CLI provides direct SSH access to running sandbox pods. Users connect via `tsa ssh <sandbox-id>`, which handles the full connection lifecycle:

1. **Pod startup** -- If the sandbox pod is not running, the CLI calls `POST /_/sandboxes/:id/connect` to start it.
2. **SSH key generation** -- An Ed25519 key pair is generated at `~/.config/tdsk/sandbox_key` (idempotent -- reuses existing keys).
3. **Key injection** -- The public key is injected into the pod's `/home/sandbox/.ssh/authorized_keys` via the K8s exec API.
4. **WebSocket tunnel** -- The CLI connects via a ProxyCommand (`tsa proxy <sandbox-id>`) that establishes a WebSocket tunnel through Caddy → auth proxy → backend → TCP to pod port 2222.
5. **SSH session** -- OpenSSH connects through the tunnel using the generated key.

Authentication is tied to the user's Threaded Stack identity -- the `tsa proxy` command authenticates with the user's API key, and the backend validates pod ownership before establishing the TCP tunnel.

Session multiplexing is supported by OpenSSH natively -- multiple terminals can SSH into the same sandbox using the same `tsa ssh` command.

The SSH config at `~/.ssh/config` is automatically managed by the CLI. A `Host sb_*` block is added with the correct ProxyCommand, IdentityFile, and host key checking settings.


## File Sync

The `tsa sync` command provides bidirectional file synchronization between the local machine and a sandbox pod using [Mutagen](https://mutagen.io/).

- **Sync modes**:
  - `two-way-resolved` (bidirectional, local wins on conflict) **Default**.
  - `two-way-safe` (bidirectional, conflicts flagged)
  - `one-way-replica` (local → sandbox, sandbox overwritten)
  - `one-way-safe` (local → sandbox, no deletes/overwrites)
- **Rule-based configuration**: Sync rules are defined in `~/.config/tdsk/tsa.yaml` under `sync.rules`, specifying source/target paths, mode, and ignore patterns.
- **Ignore patterns**: Built-in defaults (`.git/`, `node_modules/`, `.DS_Store`, etc.) are merged with user-defined patterns. `!` prefix negates a pattern.
- **Auto-sync**: When `sync.autoStart: true` is set in the config, `tsa ssh` automatically starts file sync on connect and stops it on disconnect.
- **Daemon mode**: `tsa sync <id> --daemon` starts sync in the background. `tsa sync stop <id>` stops it.
- **Session deduplication**: Won't create duplicate Mutagen sessions for the same sync rule.
- **Per-sandbox overrides**: Sandbox-specific sync defaults can be stored in the sandbox config's `config.sync` JSONB field, and per-sandbox rule overrides can be set via `sync.sandboxes.<id>.rules` in `tsa.yaml`.

The Mutagen binary is auto-installed from the npm registry on first use and stored at `~/.config/tdsk/bin/mutagen`.

Source files:
- `repos/tsa/src/services/sync/mutagenClient.ts` -- Mutagen binary execution, auto-install from npm
- `repos/tsa/src/services/sync/syncManager.ts` -- Sync session lifecycle (start, stop, flush, status)
- `repos/tsa/src/services/sync/configLoader.ts` -- Config merging (rules + sandbox defaults + overrides)
- `repos/tsa/src/services/sync/ignoreResolver.ts` -- Ignore pattern merging with builtins and negation


## Pre-Configured Agent Images

The base sandbox image (`ghcr.io/threadedstack/tdsk-sandbox`, built from `deploy/Dockerfile.sandbox`) ships with:

- **Ubuntu 24.04** base with OpenSSH server on port 2222
- **Node.js 22** runtime
- **AI tools**: Claude Code, Codex, OpenCode -- pre-installed and ready to use
- **Mutagen agent binary** -- pre-baked from `@nuanced-dev/mutagen-linux-*` npm package for file sync support
- **Auth**: Password auth enabled (fallback), SSH key auth enabled (primary)
- **Entrypoint**: Sets SSH password from environment, starts sshd, optionally clones a git repo into the workspace

The image accepts placeholder tokens as environment variables and trusts the MITM proxy's CA certificate via `NODE_EXTRA_CA_CERTS`.


## Security Model

### Credential Isolation

The core security invariant is that sandbox code and the connected user never see raw credentials. This is enforced through the placeholder token system:

1. When a sandbox pod starts, each attached secret gets a random opaque token (`tdsk_ph_` + 16-character nanoid)
2. The token-to-secret mapping is stored in the in-memory route table (keyed by pod IP), never written to disk or exposed to the pod
3. The sandbox container receives only placeholder tokens as environment variables
4. All outbound traffic is transparently redirected to the egress proxy via iptables DNAT rules set up by the init container
5. The egress proxy replaces placeholder tokens with decrypted secret values in outbound request headers
6. The `X-TDSK-Real-IP` internal header (used to identify the source pod) is stripped before forwarding externally

### Container Hardening

Pod manifests enforce:
- `privileged: false` -- no elevated kernel access
- `allowPrivilegeEscalation: false` -- processes cannot gain more privileges than their parent
- `automountServiceAccountToken: false` -- no K8s API access from within the sandbox
- `restartPolicy: Never` -- failed pods do not restart automatically (prevents retry loops with stale state)

### Traffic Interception Guarantees

The init container's iptables rules ensure that all TCP traffic on ports 80 and 443 is redirected to the egress proxy. The sandbox container cannot bypass this because:
- The iptables rules are set at the network namespace level (shared by all containers in the pod)
- The sandbox container does not have `NET_ADMIN` capability (only the init container does, and it exits after setup)
- The rules redirect at the `OUTPUT` chain in the `nat` table, catching all locally-originated traffic

### Ownership Validation

Every pod operation (start, stop, connect, list) validates that the requesting user's organization owns the pod by checking the `orgId` label. The `SandboxService.validatePodOwnership()` method enforces this before any destructive or sensitive operation.


## Key Source Files

| File | Role |
|------|------|
| `repos/sandbox/src/kube/kubeSandboxProvider.ts` | K8s sandbox provider -- connects to existing pods |
| `repos/sandbox/src/kube/kubeSandbox.ts` | ISandbox implementation -- file I/O, evaluate via K8s API |
| `repos/sandbox/src/kube/kubeClient.ts` | K8s API wrapper -- pod CRUD, watch, route hydration |
| `repos/sandbox/src/kube/podManifest.ts` | Pod manifest builder -- sandbox container, init container, iptables rules |
| `repos/sandbox/src/kube/kubeEvents.ts` | Pod event watcher with cycle-based restart |
| `repos/backend/src/services/sandboxes/sandbox.ts` | SandboxService -- pod lifecycle orchestration, placeholder generation |
| `repos/backend/src/services/proxy/egress.ts` | MITM egress proxy -- protocol sniffing, placeholder replacement, CA management |
| `repos/backend/src/utils/proxy/extractSNI.ts` | TLS ClientHello SNI extraction for HTTPS interception |
| `repos/backend/src/services/secrets/secretResolver.ts` | Secret decryption and scope-aware loading |
| `repos/tsa/src/tasks/run.ts` | `tsa run` command -- start sandbox, sync files, launch AI tool |
| `repos/tsa/src/tasks/ssh.ts` | `tsa ssh` command -- connect flow, key injection, auto-sync |
| `repos/tsa/src/tasks/sync.ts` | `tsa sync` command -- rules, modes, daemon/foreground, subtasks |
| `repos/tsa/src/tasks/proxy.ts` | `tsa proxy` -- WebSocket tunnel ProxyCommand |
| `repos/tsa/src/services/sync/sshConfig.ts` | SSH key generation, config management, proxy wrapper |
| `repos/tsa/src/services/sync/mutagenClient.ts` | Mutagen binary execution, auto-install from npm |
| `repos/tsa/src/services/sync/syncManager.ts` | Sync session lifecycle (start, stop, flush, status) |
| `repos/tsa/src/services/sync/configLoader.ts` | Config merging (rules + sandbox defaults + overrides) |
| `repos/tsa/src/services/sync/ignoreResolver.ts` | Ignore pattern merging with builtins and negation |
| `deploy/Dockerfile.sandbox` | Sandbox container image with SSH, AI tools, mutagen agent |
| `docs/architecture/security-model.md` | Full platform security model (encryption, auth, MITM proxy, scoping) |
