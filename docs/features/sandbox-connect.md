# Sandbox Connect

## What is Sandbox Connect

Sandbox Connect lets users SSH (or similar) into a sandboxed container running a pre-configured AI tool -- Claude Code, Codex, OpenCode, or any tool that runs in a Docker container. The container is managed by Threaded Stack's Kubernetes infrastructure, and all outbound traffic passes through a transparent MITM proxy that replaces placeholder tokens with real secret values. The user interacts with the AI tool directly, as if it were running locally, but never gains access to raw credentials.

This is one of four agent interaction surfaces in Threaded Stack:

| Surface | Interface | Audience |
|---------|-----------|----------|
| REPL CLI (`tsa`) | Terminal TUI | Developers |
| Threads web app | Browser | Non-developers |
| API (SSE/WebSocket) | Programmatic | Integrations |
| **Sandbox Connect** | **Direct container access** | **Developers using off-the-shelf AI tools** |


## Vision

**"Bring your own AI tool, we make it secure and managed."**

Org admins configure sandbox environments -- selecting a Docker image, attaching secrets, setting resource limits, and choosing which projects the sandbox can access. Users connect to the sandbox and work with whichever AI tool is installed in the image. Threaded Stack handles:

- **Credential security** -- Secrets are injected as opaque placeholder tokens. The MITM egress proxy swaps them for real values on outbound requests. The AI tool and the user session never see raw API keys.
- **Environment consistency** -- Every team member gets the same container image, same tools, same configuration. No per-engineer setup drift.
- **Lifecycle management** -- Pods are created, monitored, and torn down automatically. When the sandbox shuts down, nothing leaks.
- **Access control** -- Sandbox pods are scoped to organizations and projects. Pod ownership is validated before any operation.

The user experience is: pick a sandbox config from the admin dashboard, click "Start", connect via SSH, and start working. The complexity of K8s pod orchestration, TLS interception, and secret management is invisible.


## What Exists Today (Current)

The Kubernetes sandbox infrastructure is built and operational. The following components are in production.

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


## What Needs to Be Built (Planned)

### SSH / Connection Layer

Users need a way to connect directly to a running sandbox pod. The current infrastructure supports command runs via the K8s API, but there is no user-facing connection mechanism. Planned work includes:

- SSH server or equivalent running inside sandbox containers, exposed via a K8s service or ingress
- Authentication tied to the user's Threaded Stack identity (JWT or API key mapped to SSH credentials)
- Session multiplexing so multiple terminals can connect to the same sandbox
- Connection URL generation and display in the admin UI

### Pre-Configured Agent Images

Docker images pre-loaded with popular AI tools, ready to run in sandboxes:

- **Claude Code** -- Anthropic's CLI agent
- **Codex** -- OpenAI's coding agent
- **OpenCode** -- Open-source alternative

Each image must:
- Accept placeholder tokens as environment variables for API keys
- Trust the MITM proxy's CA certificate (already handled via `NODE_EXTRA_CA_CERTS` volume mount)
- Run a long-lived process suitable for interactive use (SSH server, or the tool's native interactive mode)

### Admin UI: Sandbox Configuration

The admin dashboard needs pages for org admins to:

- Create and manage sandbox configurations (image, resource limits, secrets, ports)
- Start/stop sandbox pods
- View running sandboxes and their states
- Generate connection instructions (SSH command, URL, etc.)
- Assign sandbox configs to projects

### Session Management

- Track active sandbox sessions (who is connected, for how long)
- Idle timeout and automatic pod teardown after inactivity
- Session resume -- reconnecting to a sandbox that is still running
- Concurrent session limits per user and per org (tied to subscription tier quotas)

### Persistence Options

Sandbox pods currently use `restartPolicy: Never` and ephemeral storage. Planned options:

- Persistent volume claims for workspace data that survives pod restarts
- Git-based workspace initialization (clone a repo into the workspace on pod start)
- Snapshot/restore for sandbox state


## Security Model

Sandbox Connect inherits the platform's defense-in-depth security model. The full security architecture is documented in `docs/architecture/security-model.md`. The aspects most relevant to Sandbox Connect are:

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


## Use Cases

### Developer Running Claude Code with Org Secrets

A developer needs to use Claude Code to work on a project that requires API keys for OpenAI, a database connection string, and a third-party SaaS token. Instead of configuring these locally:

1. The org admin creates a sandbox config with the `claude-code` image and attaches the three secrets
2. The developer starts a sandbox from the admin dashboard
3. The developer connects via SSH
4. Claude Code runs inside the container with placeholder tokens as environment variables
5. When Claude Code makes API calls, the egress proxy transparently replaces the placeholders with real credentials
6. The developer never sees the raw API keys -- neither does Claude Code

### Team Lead Configuring a Standard AI Environment

A team lead wants every engineer on the project to use the same AI tooling setup:

1. The team lead creates a sandbox config: selects the `claude-code` image, attaches the project's secrets, sets resource limits (CPU, memory), and assigns it to the project
2. Any project member can start a sandbox from this config
3. Every sandbox gets the same image, same secrets, same resource limits
4. New team members get a working AI environment without any local setup

### Onboarding New Developers

A new hire joins the team and needs access to AI-assisted development:

1. The org admin invites the new user to the organization
2. The new user signs in via social login (Neon Auth)
3. The new user navigates to the project, sees available sandbox configs
4. One click to start a sandbox, connect via SSH, and start working
5. No API keys to request, no environment to configure, no secrets shared over Slack


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
| `docs/architecture/security-model.md` | Full platform security model (encryption, auth, MITM proxy, scoping) |
