# Sandbox Usage Guide

## What Are Sandboxes

Sandboxes are secure, isolated execution environments where your code runs without access to your raw credentials. Every sandbox -- whether running a simple function or hosting an AI agent -- operates under the same security model:

- **Isolation**: Code executes in its own environment, separated from other workloads and the host system.
- **Secret injection at the network layer**: Your code never sees real API keys or credentials. Instead, it receives opaque placeholder tokens (`tdsk_ph_*`). When the code makes outbound HTTP/HTTPS requests, a transparent man-in-the-middle (MITM) egress proxy intercepts the traffic and swaps the placeholders for the actual secret values before forwarding to the external service.
- **No escape hatch**: All outbound traffic on ports 80 and 443 is redirected through the egress proxy via iptables rules set up before the sandbox container starts. The sandbox container cannot bypass this redirection because it lacks the `NET_ADMIN` capability needed to modify network rules.

This design means that even if code running inside a sandbox is compromised or behaves unexpectedly, it cannot exfiltrate raw credentials.

---

## Sandbox Providers

Threaded Stack supports two sandbox providers, each suited to different stages of your workflow.

### Local Provider (Development)

The Local provider runs entirely in-process with no external dependencies. It is the default for local development and lightweight function execution.

**How it works:**

- A virtual in-memory filesystem (`/workspace` and `/tmp`) provides file storage.
- A virtual shell handles command execution against that filesystem.
- An optional V8 isolate (via `isolated-vm`) provides safe JavaScript code execution with a module system and Node.js-compatible APIs.

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
- No container isolation -- code runs in the same Node.js process (V8 isolate provides memory isolation but not process-level sandboxing).
- If `isolated-vm` is not available on your platform (e.g., some ARM architectures), the provider degrades gracefully: shell and filesystem operations still work, but `evaluate()` calls will throw an error.

### Kubernetes Provider (Production)

The Kubernetes provider runs code inside dedicated K8s pods. It is used in production and staging environments for agent hosting, sandbox workspaces, and any workload that requires real network access with secret injection.

**How it works:**

- A pod is created with a sandbox container (your configured Docker image) and an init container that sets up iptables rules for traffic redirection.
- All outbound HTTP/HTTPS traffic from the sandbox container is transparently routed through the MITM egress proxy.
- Commands are executed inside the pod via the Kubernetes API (WebSocket-based exec), not via SSH or direct network access.
- A custom CA certificate is mounted into the container so that TLS connections trust the proxy's generated certificates.

**When it is used:**

- Production and staging deployments.
- AI agent execution that requires outbound API calls with real credentials.
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

When your function code runs in the Local provider's V8 isolate, it has access to the following Node.js builtin shims:

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

- **Memory**: Configurable per sandbox (default: 128 MB for the V8 isolate).
- **Timeout**: Code evaluation has a default timeout of 5 seconds. Long-running computations are terminated.
- **Timer support**: `setTimeout`, `setInterval`, `setImmediate`, and `clearTimeout`/`clearInterval` are available with a maximum timer duration of 30 seconds.

---

## Using Sandboxes for Agents

AI agents in Threaded Stack can execute code and make API calls within Kubernetes sandbox pods. This gives agents access to real tools and external services while keeping credentials secure.

### How Agent Sandboxes Work

1. **A sandbox configuration is created** specifying the Docker image, resource limits, secrets to attach, and available runtimes.
2. **When an agent runs**, the `SandboxService` starts a pod from the configuration:
   - A unique pod name is generated (`tdsk-sb-<id>-<suffix>`).
   - Placeholder tokens are generated for each attached secret.
   - The pod manifest is built with the sandbox container, the init container (iptables setup), and the CA certificate volume mount.
   - The pod is created via the K8s API.
3. **The agent executes tool calls** inside the pod via the `KubeSandbox` interface -- running shell commands, reading/writing files, and evaluating code.
4. **Outbound API calls** made by agent code are intercepted by the MITM proxy, which replaces placeholder tokens with real secret values before forwarding to external services.
5. **When the agent finishes** (or the session ends), the pod is stopped and deleted.

### MITM Proxy Integration

The MITM egress proxy is what makes sandbox security work transparently for agents. Here is what happens when agent code inside a pod makes an HTTPS request:

1. The request leaves the sandbox container on port 443.
2. The init container's iptables rules redirect it to the egress proxy service.
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

---

## Sandbox Direct Connect (Planned)

Sandbox Direct Connect is a planned feature that will let users and AI coding tools connect directly into running sandbox pods for interactive development sessions.

### What It Will Enable

- **Direct container access**: Connect to a running sandbox pod via SSH or a similar protocol, then use the terminal as if it were a local development machine.
- **Bring your own AI tool**: Use whichever AI coding tool you prefer (Claude Code, Codex, OpenCode, or others) inside a managed container environment. The sandbox image ships with the tool pre-installed and configured.
- **Zero credential exposure**: The MITM egress proxy continues to operate transparently. When the AI tool makes outbound API calls, placeholder tokens are swapped for real credentials at the network layer. Neither the AI tool nor the connected user ever sees raw API keys.
- **Team-wide consistency**: Org admins configure a sandbox image once (tool versions, secrets, resource limits), and every team member gets the same environment. No per-engineer setup drift.

### How Credentials Stay Secure with Direct Access

The security model remains intact because the iptables DNAT rules are established by the init container before the sandbox container starts. All outbound traffic on ports 80/443 is redirected to the egress proxy regardless of whether the traffic originates from automated agent code or an interactive SSH session. The sandbox container cannot modify these rules because it lacks `NET_ADMIN` capability.

### Planned Capabilities

- SSH or equivalent connection mechanism exposed via K8s ingress.
- Authentication tied to your Threaded Stack identity (JWT or API key).
- Session multiplexing for multiple terminals connected to the same sandbox.
- Connection URL generation and display in the admin dashboard.
- Pre-configured Docker images for popular AI tools.
- Persistent volume options for workspace data that survives pod restarts.
- Idle timeout with automatic pod teardown after inactivity.
- Session limits tied to your subscription tier quotas.

For full design details, see the [Sandbox Connect feature spec](../features/sandbox-connect.md).

---

## Troubleshooting

### `isolated-vm` Not Available

**Symptom**: Warning message: `isolated-vm not available -- sandbox running without code execution isolation`. The `evaluate()` function throws errors.

**Cause**: The `isolated-vm` package requires native compilation via `node-gyp`. It may fail on some platforms (Alpine Linux, certain ARM architectures) or if build tools are not installed.

**Solution**: Install the required build tools for your platform (`python3`, `make`, `g++` on Linux; Xcode Command Line Tools on macOS) and run `pnpm install` again. If the package still cannot compile for your platform, the Local provider will continue to work for shell and filesystem operations -- only V8 code evaluation is unavailable.

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

**Cause**: The code exceeded the evaluation timeout (default 5 seconds for V8 isolate, configurable for K8s pods).

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
