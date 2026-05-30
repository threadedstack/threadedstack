# Sandbox Usage Guide

## What Are Sandboxes

Sandboxes are secure, managed execution environments where AI tools run without access to your raw credentials. They are the **primary way to use Threaded Stack** — pick your AI tool of choice (Claude Code, Codex, OpenCode, or any custom tool), and the platform handles the rest: pod orchestration, secret injection, file sync, and SSH connectivity.

Every sandbox operates under the same security model:

- **Isolation**: Code executes in its own environment, separated from other workloads and the host system.
- **Secret injection at the network layer**: Your code never sees real API keys or credentials. Instead, it receives opaque placeholder tokens (`tdsk_ph_*`). When the code makes outbound HTTP/HTTPS requests, a transparent man-in-the-middle (MITM) egress proxy intercepts the traffic and swaps the placeholders for the actual secret values before forwarding to the external service.
- **No escape hatch**: All outbound traffic on ports 80 and 443 is redirected through the egress proxy via network rules set up before the sandbox container starts. The sandbox container cannot bypass this redirection because it lacks the privileges needed to modify network rules.

This design means that even if code running inside a sandbox is compromised or behaves unexpectedly, it cannot exfiltrate raw credentials.

---

## Quick Start with `tsa run`

The fastest way to start using Threaded Stack is the `tsa run` command. It starts a sandbox pod, syncs your files, and launches your AI tool — all in one step.

### 1. Install and Login

```bash
tsa login tdsk_<api-key>
```

### 2. List Available Sandboxes

```bash
tsa run --list
```

This shows all sandbox configs in your organization with their name, runtime, and ID. Every new organization comes with six built-in presets: Claude Code, Codex, OpenCode, Antigravity, OpenClaw, and Base.

### 3. Run a Sandbox

```bash
tsa run <sandbox-id>
```

This single command:
- Starts the sandbox pod if it is not already running
- Syncs your local files to the sandbox (configurable)
- SSHs into the sandbox
- Launches the AI tool configured for that sandbox's runtime

To skip file sync:

```bash
tsa run <sandbox-id> --no-sync
```

To specify an organization explicitly:

```bash
tsa run <sandbox-id> --org <org-id>
```

### `tsa run` vs `tsa ssh`

| | `tsa run` | `tsa ssh` |
|---|---|---|
| Starts pod | Yes | Yes |
| Syncs files | Yes (unless `--no-sync`) | Only if `sync.autoStart: true` |
| Launches AI tool | Yes (executes `runtimeCommand`) | No (opens plain shell) |
| Recommended for | Daily AI-assisted development | Debugging, manual setup |

---

## Built-In Sandbox Presets

Every new organization is seeded with six ready-to-use sandbox configs:

| Preset | Runtime | What It Runs |
|--------|---------|-------------|
| Claude Code | `claude-code` | Anthropic's Claude Code CLI |
| Codex | `codex` | OpenAI's Codex CLI |
| OpenCode | `opencode` | Open-source AI coding tool |
| Antigravity | `antigravity` | Google's Antigravity CLI |
| OpenClaw | `openclaw` | Open-source AI agent platform |
| Base | `custom` | Plain sandbox with SSH, bring your own runtime |

These presets:
- Are marked `builtIn: true` in the system
- Can be started immediately with `tsa run <id>` — no configuration needed
- Can be edited (change secrets, resource limits, init script)
- Can be copied to create customized variants
- Can be deleted if not needed

---

## Runtime System

Each sandbox has a **runtime** that determines which AI tool is launched by `tsa run`.

### Available Runtimes

| Runtime | Value | Description |
|---------|-------|-------------|
| Claude Code | `claude-code` | Anthropic's Claude Code CLI |
| Codex | `codex` | OpenAI's Codex CLI |
| OpenCode | `opencode` | Open-source AI coding tool |
| Antigravity | `antigravity` | Google's Antigravity CLI |
| OpenClaw | `openclaw` | Open-source AI agent platform |
| Custom | `custom` | You specify the command |

> **Best practice:** Start with the built-in presets. Only create custom runtimes when a built-in preset does not support your tool.

### Two-Command Model

Sandboxes use two separate commands:

1. **Container start command** — Runs when the pod starts. Keeps it alive and starts SSH. For built-in runtimes, this is set automatically.
2. **Runtime command** — Runs when you execute `tsa run`. This is the AI tool itself.

An optional **init script** runs between container start and "ready" state. Use it for setup tasks like installing extra dependencies, configuring git, or cloning a project.

> **Best practice:** Keep init scripts short. Long init scripts delay sandbox startup and frustrate developers. Move heavy setup into a custom Docker image instead.

### Custom Runtimes

For tools not covered by the built-in runtimes, set the runtime to `custom` and provide:
- **Runtime Command** — the shell command to launch your tool (e.g., `aider`, `continue`)
- **Start Command/Args** — optional custom container start command
- **Init Script** — optional setup script

---

## Sandbox Providers

Threaded Stack supports two sandbox providers, each suited to different stages of your workflow.

### Local Provider (Development)

The Local provider runs entirely in-process with no external dependencies. It is the default for local development and lightweight function execution.

**How it works:**

- A virtual in-memory filesystem (`/workspace` and `/tmp`) provides file storage.
- A virtual shell handles command execution against that filesystem.
- An optional isolated environment provides safe JavaScript code execution with a module system and Node.js-compatible APIs.

**When it is used:**

- Local development (`NODE_ENV=local`).
- Running FaaS endpoint code that does not require network access or a full container environment.
- Unit testing sandbox-dependent features without K8s infrastructure.

**Capabilities:**

- Shell command execution.
- In-memory file I/O (read, write, list, delete, mkdir).
- JavaScript code evaluation with 14 Node.js builtin shims (see the "Using Sandboxes for FaaS" section below).

**Limitations:**

- No real network access -- outbound HTTP requests from evaluated code are bridged through the host process, not through the MITM proxy.
- No container isolation -- code runs in the same Node.js process (the isolated environment provides memory isolation but not process-level sandboxing).
- If the isolated execution environment is not available on your platform (e.g., some ARM architectures), the provider degrades gracefully: shell and filesystem operations still work, but `evaluate()` calls will throw an error.

### Kubernetes Provider (Production)

The Kubernetes provider runs code inside dedicated K8s pods. It is used in production and staging environments for sandbox workspaces and any workload that requires real network access with secret injection.

**How it works:**

- A pod is created with a sandbox container (your configured Docker image) and an init container that sets up network rules for traffic redirection.
- All outbound HTTP/HTTPS traffic from the sandbox container is transparently routed through the MITM egress proxy.
- Commands are executed inside the pod via the Kubernetes API (WebSocket-based exec), not via SSH or direct network access.
- A custom CA certificate is mounted into the container so that TLS connections trust the proxy's generated certificates.

**When it is used:**

- Production and staging deployments.
- AI tool execution that requires outbound API calls with real credentials.
- Any workload that needs full container isolation, configurable resource limits, or access to secrets.

**Capabilities:**

- Full container environment with configurable Docker image, resource limits (CPU/memory), and environment variables.
- Real network access with transparent secret injection via the MITM proxy.
- File I/O and command execution via the K8s API.
- Code evaluation by writing to a temp file and running with a configured runtime (e.g., `node`).
- Pod lifecycle management (start, stop, list, ownership validation).

---

## Using Sandboxes for FaaS

FaaS (Function as a Service) endpoints let you deploy JavaScript functions that execute inside a sandbox. The sandbox provides a Node.js-like environment where your function code can use familiar APIs.

### How Function Execution Works

1. **You create an endpoint** of type "FaaS" in the admin dashboard, providing your function code.
2. **A request arrives** at your endpoint's URL (via the proxy).
3. **The backend loads your function code** and passes it to the sandbox for evaluation.
4. **The sandbox executes your code** in an isolated environment and returns the result.

### What Is Available Inside a FaaS Sandbox

When your function code runs in the Local provider's isolated environment, it has access to the following Node.js builtin shims:

| Module | What You Can Do |
|--------|----------------|
| `fs` / `node:fs` | Read and write files in the virtual filesystem (sync and async variants) |
| `path` / `node:path` | Path manipulation (`join`, `resolve`, `dirname`, `basename`, `extname`) |
| `buffer` / `node:buffer` | `Buffer.from()`, `Buffer.alloc()`, `Buffer.concat()`, base64/hex encoding |
| `crypto` / `node:crypto` | `randomUUID()`, `randomBytes()`, `createHash()` (SHA-256, etc.) |
| `child_process` / `node:child_process` | `execSync()` routed to the virtual shell |
| `url` / `node:url` | `URL`, `URLSearchParams`, legacy `parse`/`format` |
| `querystring` / `node:querystring` | `stringify`, `parse`, `escape`, `unescape` |
| `events` / `node:events` | `EventEmitter` with `on`, `emit`, `off`, `once` |
| `os` / `node:os` | Static values (`platform: 'linux'`, `arch: 'x64'`, `tmpdir: '/tmp'`) |
| `assert` / `node:assert` | `ok`, `strictEqual`, `deepStrictEqual`, `throws` |
| `util` / `node:util` | `format`, `inspect`, `inherits`, `promisify` |
| `process` | `process.env`, `process.cwd()`, `process.platform`, `process.nextTick()` |
| `console` | `console.log/error/warn/info` (output is captured and returned) |
| `fetch` | `fetch()` available as a global for HTTP requests |

You can import these modules using standard ES module syntax:

```javascript
import { readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
```

Both bare specifiers (`'fs'`) and Node.js-prefixed specifiers (`'node:fs'`) are supported.

### Secrets in FaaS

When your FaaS endpoint is configured with secrets, those secrets are available as placeholder tokens. In the Kubernetes provider, outbound HTTP requests automatically have the placeholder tokens replaced with real values by the egress proxy. Your code references secrets by their placeholder token, and the infrastructure handles the rest.

### Resource Limits

- **Memory**: Configurable per sandbox (default: 128 MB for the isolated environment).
- **Timeout**: Code evaluation has a default timeout of 5 seconds. Long-running computations are terminated.
- **Timer support**: `setTimeout`, `setInterval`, `setImmediate`, and `clearTimeout`/`clearInterval` are available with a maximum timer duration of 30 seconds.

---

## Sandbox Pod Lifecycle

AI tools in Threaded Stack execute code and make API calls within Kubernetes sandbox pods. This gives tools access to real external services while keeping credentials secure.

### How Sandbox Pods Work

1. **A sandbox configuration is created** specifying the Docker image, resource limits, secrets to attach, and available runtimes.
2. **When a session starts**, the `SandboxService` starts a pod from the configuration:
   - A unique pod name is generated (`tdsk-sb-<id>-<suffix>`).
   - Placeholder tokens are generated for each attached secret.
   - The pod manifest is built with the sandbox container, the init container (network rules setup), and the CA certificate volume mount.
   - The pod is created via the K8s API.
3. **The AI tool executes commands** inside the pod via the `KubeSandbox` interface -- running shell commands, reading/writing files, and evaluating code.
4. **Outbound API calls** made by sandbox code are intercepted by the MITM proxy, which replaces placeholder tokens with real secret values before forwarding to external services.
5. **When the session ends**, the pod is stopped and deleted.

### MITM Proxy Integration

The MITM egress proxy is what makes sandbox security work transparently. Here is what happens when code inside a pod makes an HTTPS request:

1. The request leaves the sandbox container on port 443.
2. The init container's network rules redirect it to the egress proxy service.
3. The egress proxy peeks at the first byte to determine the protocol:
   - **TLS (byte `0x16`)**: Extracts the SNI hostname, establishes a CONNECT tunnel, and performs TLS interception using a per-hostname certificate signed by the custom CA.
   - **Plain HTTP**: Pipes directly to the MITM proxy with an internal tracking header.
4. The proxy identifies which pod sent the request by matching the source IP against its route map.
5. It scans all outbound request headers for `tdsk_ph_*` tokens and replaces each one with the corresponding decrypted secret value.
6. The request is forwarded to the external service with real credentials. The external service never sees placeholder tokens.

If a placeholder cannot be resolved (for example, the secret was deleted), the proxy returns HTTP 502 to the sandbox rather than forwarding an unresolved token. This prevents accidental credential leakage.

### Pod Security

Every sandbox pod is hardened:

| Setting | Value | Purpose |
|---------|-------|---------|
| `privileged` | `false` | No elevated kernel access |
| `allowPrivilegeEscalation` | `false` | Processes cannot gain more privileges |
| `automountServiceAccountToken` | `false` | No K8s API access from within the sandbox |
| `restartPolicy` | `Never` | Failed pods do not restart automatically |

### Pod Ownership and Scoping

Pods are labeled with the organization ID, user ID, sandbox ID, and project ID. Every operation (start, stop, connect, list) validates that the requesting user's organization owns the pod via the `orgId` label. You can only interact with pods that belong to your organization.

### Pod Lifecycle and Naming

Each running sandbox pod is an **instance**. The pod name serves as the `instanceId` and follows the format `tdsk-sb-<sandboxId>-<suffix>`. Multiple pods can exist simultaneously for the same sandbox configuration -- each one is a separate instance.

Pod labels applied to every instance:

| Label | Value | Purpose |
|-------|-------|---------|
| `orgId` | Organization ID | Ownership validation |
| `projectId` | Project ID | Project scoping |
| `userId` | Creating user's ID | Instance creator tracking |
| `sandboxId` | Sandbox config ID | Mapping instances to their config |

When a new instance starts, it goes through these states:

1. **Pending** -- Pod is being scheduled and containers are starting.
2. **Running** -- Container is ready and accepting connections.
3. **Terminating** -- Pod is being stopped and cleaned up.
4. **Failed** -- Pod encountered an error during startup.
5. **Unknown** -- Pod state could not be determined.

The platform polls the pod state after creation and waits for it to reach `Running` before returning connection credentials. If the pod fails to start or does not reach `Running` within the timeout window, it is automatically cleaned up.

---

## Instance Management

A single sandbox configuration can have multiple running instances (pods) at the same time. This allows multiple team members to each have their own isolated environment from the same sandbox config, or lets a single user run parallel workloads.

### Listing Instances

To see all active instances for a sandbox:

```http
GET /_/orgs/:orgId/projects/:projectId/sandboxes/:id/instances
```

Response:

```json
{
  "data": {
    "instances": [
      {
        "instanceId": "tdsk-sb-abc123-x7k9",
        "sandboxId": "abc123",
        "state": "Running",
        "userId": "user_01",
        "sessionCount": 2,
        "sessions": [
          {
            "sessionId": "sess_01",
            "userId": "user_01",
            "sandboxId": "abc123",
            "instanceId": "tdsk-sb-abc123-x7k9",
            "connectedAt": "2026-05-11T10:30:00Z",
            "hasShellSession": true,
            "visibility": "private"
          }
        ]
      },
      {
        "instanceId": "tdsk-sb-abc123-m2p4",
        "sandboxId": "abc123",
        "state": "Running",
        "userId": "user_02",
        "sessionCount": 1,
        "sessions": []
      }
    ],
    "maxInstances": 4
  }
}
```

Each instance object contains:

| Field | Type | Description |
|-------|------|-------------|
| `instanceId` | string | Unique pod name (Kubernetes pod name) |
| `sandboxId` | string | Parent sandbox configuration ID |
| `state` | string | Current pod state: `Running`, `Pending`, `Failed`, `Terminating`, or `Unknown` |
| `userId` | string | ID of the user who created this instance |
| `sessionCount` | number | Number of active sessions on this instance |
| `sessions` | array | Detailed session objects for this instance |

The `maxInstances` field indicates the maximum number of concurrent instances allowed for this sandbox configuration (configurable in sandbox settings, defaults to the platform default).

### Instance Limits

Each sandbox config has a `maxInstances` limit. When the number of active instances (including those currently starting) reaches this limit, new instance creation is rejected with an `INSTANCE_LIMIT_REACHED` error. The error response includes the list of active instances so you can decide which one to connect to or stop.

---

## Sandbox Direct Connect

Sandbox Direct Connect lets you SSH into running sandbox pods and sync files between your local machine and the container. The `tsa` CLI handles the full workflow -- pod startup, SSH key management, WebSocket tunneling, and Mutagen-based file synchronization.

### Getting Started

If you have not already, see the [Quick Start with `tsa run`](#quick-start-with-tsa-run) section above for the recommended workflow. The sections below cover SSH access and file sync in more detail.

#### Connect via SSH

```bash
tsa ssh <sandbox-id>
```

This single command handles:
- Starting the sandbox pod if it is not already running
- Generating an Ed25519 SSH key pair (reuses existing keys)
- Injecting the public key into the pod
- Establishing a WebSocket tunnel through the proxy chain
- Opening an interactive SSH session

To specify an organization explicitly:

```bash
tsa ssh <sandbox-id> --org <org-id>
```

#### Instance-Aware Connection

When connecting to a sandbox that supports multiple instances, the connect endpoint (`POST /_/orgs/:orgId/projects/:projectId/sandboxes/:id/connect`) uses the following logic:

| Scenario | Behavior |
|----------|----------|
| No running instances | A new instance is created automatically |
| One or more running instances exist, no selection provided | Returns `INSTANCE_SELECTION_REQUIRED` error with the list of running instances |
| `newInstance: true` in request body | Creates a new instance (if under the instance limit) |
| `instanceId: "<id>"` in request body | Connects to the specified running instance |

Example -- create a new instance:

```json
{
  "newInstance": true
}
```

Example -- connect to a specific instance:

```json
{
  "instanceId": "tdsk-sb-abc123-x7k9"
}
```

<Warning>When multiple instances are running and neither `newInstance` nor `instanceId` is provided, the API returns a 400 error with code `INSTANCE_SELECTION_REQUIRED`. The error response includes the list of running instances and their session counts so you can choose which one to target.</Warning>

#### 4. Sync Files

Start file synchronization between your local machine and the sandbox:

```bash
# Foreground mode (blocks until Ctrl+C)
tsa sync <sandbox-id> --source ./src --target /workspace/src

# Background mode
tsa sync <sandbox-id> --daemon

# Check sync status
tsa sync status

# Stop syncing
tsa sync stop <sandbox-id>

# Force immediate sync
tsa sync flush <sandbox-id>
```

### Sync Configuration

Define sync rules in `~/.config/tdsk/tsa.yaml`:

```yaml
sync:
  autoStart: true  # Auto-start sync when connecting via tsa ssh
  rules:
    - name: project
      source: ./src
      target: /workspace/src
      mode: one-way-replica
      ignores:
        - dist/
        - "*.log"
    - name: config
      source: ./config
      target: /workspace/config
      mode: two-way-safe
```

#### Sync Modes

| Mode | Behavior |
|------|----------|
| `one-way-replica` | Local → sandbox only. Sandbox changes are overwritten. |
| `one-way-safe` | Local → sandbox only. Existing sandbox files are never deleted or overwritten. |
| `two-way-safe` | Bidirectional. Conflicts are flagged, not overwritten. |
| `two-way-resolved` | Bidirectional. Local wins on conflict. |

> **Best practice:** Use `two-way-safe` sync mode unless you have a specific reason not to. It prevents accidental overwrites in both directions and flags conflicts for manual resolution.

#### Ignore Patterns

Built-in ignores (`.git/`, `node_modules/`, `.DS_Store`, etc.) are always applied. Add your own in the `ignores` list. Prefix with `!` to negate a pattern:

```yaml
ignores:
  - "*.log"
  - temp/
  - "!important.log"  # Keep this file even though *.log is ignored
```

#### Per-Sandbox Overrides

Override sync rules for specific sandboxes:

```yaml
sync:
  sandboxes:
    sb_a1b2c3d:
      rules:
        - name: project
          source: ./custom-src
          target: /workspace/src
          mode: two-way-resolved
```

### Auto-Sync

When `sync.autoStart: true` is set in your config, `tsa ssh` automatically starts file sync when you connect and stops it when the SSH session ends. No separate `tsa sync` command is needed.

### How Credentials Stay Secure

The security model remains intact during direct SSH access. The network redirection rules are established by the init container before the sandbox container starts. All outbound traffic on ports 80/443 is redirected to the egress proxy regardless of whether the traffic originates from AI tool code or an interactive SSH session. The sandbox container cannot modify these rules because it lacks the privileges needed to do so.

### Copying Sandboxes

You can duplicate any sandbox config — including built-in presets — to create a customized version:

- **Admin UI**: Click the copy button on any sandbox row
- **API**: `POST /_/orgs/:orgId/projects/:projectId/sandboxes/:id/copy`

Copies always have `builtIn: false` and get a new ID. All configuration (image, secrets, runtime, resource limits, init script) is preserved.

### Stopping Instances

Stop a running sandbox instance via the stop endpoint:

```http
DELETE /_/orgs/:orgId/projects/:projectId/sandboxes/:id/stop
```

The request body controls which instances to stop and how:

| Field | Type | Description |
|-------|------|-------------|
| `instanceId` | string | Stop a specific instance (required unless `stopAll` is set) |
| `stopAll` | boolean | Stop all active instances for this sandbox |
| `force` | boolean | Force stop even if other users have active sessions |

Example -- stop a specific instance:

```json
{
  "instanceId": "tdsk-sb-abc123-x7k9"
}
```

Example -- stop all instances:

```json
{
  "stopAll": true
}
```

Example -- force stop (ignoring other users' sessions):

```json
{
  "instanceId": "tdsk-sb-abc123-x7k9",
  "force": true
}
```

<Warning>If other users have active sessions on the instance you are trying to stop, the API returns a 409 error with code `ACTIVE_SESSIONS` and includes the list of active sessions. Use `force: true` to override this protection when necessary.</Warning>

When using `stopAll`, the platform attempts to stop every active instance. If some instances fail to stop, the response includes the list of `failedInstances` alongside the `stoppedCount`.

### Executing Commands in an Instance

Execute a command inside a running sandbox instance:

```http
POST /_/orgs/:orgId/projects/:projectId/sandboxes/:id/exec
```

The `instanceId` field is required in the request body to specify which running instance should execute the command.

```json
{
  "command": "node",
  "args": ["--version"],
  "instanceId": "tdsk-sb-abc123-x7k9"
}
```

The response contains the command output, exit code, and success status.

### Sessions

Sessions track active connections to sandbox instances. Each session is associated with a specific instance and includes metadata about the connection.

List all active sessions across all running instances of a sandbox:

```http
GET /_/orgs/:orgId/projects/:projectId/sandboxes/:id/sessions
```

Response:

```json
{
  "data": [
    {
      "sessionId": "sess_01",
      "userId": "user_01",
      "orgId": "org_01",
      "sandboxId": "abc123",
      "instanceId": "tdsk-sb-abc123-x7k9",
      "connectedAt": "2026-05-11T10:30:00Z",
      "hasShellSession": true,
      "visibility": "private"
    }
  ]
}
```

Session fields:

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Unique session identifier |
| `userId` | string | User who owns this session |
| `orgId` | string | Organization ID |
| `sandboxId` | string | Parent sandbox config ID |
| `instanceId` | string | The specific instance this session is connected to |
| `connectedAt` | string | ISO 8601 timestamp of when the session was established |
| `hasShellSession` | boolean | Whether this session has an active PTY (interactive terminal) |
| `visibility` | string | `private` (default) or `public` -- public sessions can be joined by other org members |

<Tip>Sessions are grouped by instance. When viewing sessions for a sandbox with multiple running instances, each session's `instanceId` field tells you which instance it belongs to. The [Instance Management](#instance-management) section's list endpoint also returns sessions nested under each instance.</Tip>

### CLI Quick Reference

```bash
tsa run <sandbox-id> [--org <id>]            # Start sandbox + sync + launch AI tool (recommended)
tsa run --list [--org <id>]                  # List available sandboxes
tsa ssh <sandbox-id> [--org <id>]            # SSH into sandbox (plain shell)
tsa sync <sandbox-id> [options]              # Start file sync
tsa sync stop <sandbox-id>                   # Stop file sync
tsa sync status [sandbox-id]                 # Show sync status
tsa sync flush <sandbox-id>                  # Force immediate sync
tsa sandboxes [--org <id>]                   # List sandboxes
tsa proxy <sandbox-id>                       # SSH ProxyCommand (internal)
```

For full design details, see the [Sandbox Connect feature spec](../features/sandbox-connect.md).

---

## Troubleshooting

### Isolated Execution Environment Not Available

**Symptom**: Warning message about the sandbox running without code execution isolation. The `evaluate()` function throws errors.

**Cause**: The isolated execution environment requires native compilation which may fail on some platforms (Alpine Linux, certain ARM architectures) or if build tools are not installed.

**Solution**: Install the required build tools for your platform (`python3`, `make`, `g++` on Linux; Xcode Command Line Tools on macOS) and run the package install again. If the environment still cannot be set up for your platform, the Local provider will continue to work for shell and filesystem operations -- only isolated code evaluation is unavailable.

### Pod Stuck in Pending State

**Symptom**: A sandbox pod stays in `Pending` state and never transitions to `Running`.

**Cause**: Common reasons include insufficient cluster resources (CPU/memory), image pull failures, or missing image pull secrets.

**Solution**:
- Check pod events for scheduling or image pull errors: the `SandboxService` logs pod state transitions.
- Verify the Docker image name and tag are correct in the sandbox configuration.
- If using a private registry, ensure the `imagePullSecret` is configured in the sandbox config and the corresponding K8s secret exists in the namespace.
- Check cluster resource availability -- the pod's resource requests may exceed what the cluster can allocate.

### Placeholder Token Not Resolved (HTTP 502)

**Symptom**: Outbound HTTP requests from a sandbox pod fail with HTTP 502 responses.

**Cause**: The egress proxy could not resolve a `tdsk_ph_*` placeholder token to a real secret value. This happens when:
- The secret was deleted after the sandbox was started.
- The secret decryption failed (corrupted data or key rotation issue).
- The placeholder token in the request does not match any token in the pod's placeholder map.

**Solution**:
- Verify the secrets attached to the sandbox configuration still exist and are accessible.
- Restart the sandbox pod to regenerate placeholder token mappings from current secrets.
- Check backend logs for specific decryption or resolution errors.

### TLS Certificate Errors Inside Sandbox

**Symptom**: HTTPS requests from sandbox code fail with certificate validation errors (e.g., `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or `SELF_SIGNED_CERT_IN_CHAIN`).

**Cause**: The sandbox container is not trusting the MITM proxy's CA certificate. The CA cert must be mounted and recognized by the runtime.

**Solution**:
- For Node.js workloads, the `NODE_EXTRA_CA_CERTS` environment variable is automatically set to the mounted CA certificate path. Verify the volume mount exists at `/usr/local/share/ca-certificates/tdsk-proxy.crt`.
- For non-Node.js runtimes (Python, Go, etc.), you may need to add the CA certificate to the runtime's trust store inside your Docker image. The CA cert is available at the mounted path.

### Code Evaluation Timeout

**Symptom**: Code evaluation fails with a timeout error.

**Cause**: The code exceeded the evaluation timeout (default 5 seconds for the isolated environment, configurable for K8s pods).

**Solution**:
- Optimize the code to complete within the timeout window.
- For CPU-intensive work, break it into smaller evaluation steps.
- For K8s sandboxes, pass a longer timeout via the runtime configuration.

### Pod Ownership Validation Failure

**Symptom**: Operations on a sandbox pod fail with an ownership or authorization error.

**Cause**: The pod's `orgId` label does not match the organization of the requesting user. This can happen if you switch organizations or if a pod was created by a different org member and the org context is incorrect.

**Solution**:
- Confirm you are operating under the correct organization context.
- Use the admin dashboard to verify which organization owns the sandbox configuration and its pods.
