# Security Model

## Security Philosophy

Threaded Stack follows a **defense-in-depth** strategy built around one core invariant: **AI agents and end users never see raw credentials**. Secrets are encrypted at rest using AES-256-GCM, decrypted only at the point of use, and injected outside the agent's execution context. If any single layer is compromised, multiple additional barriers remain.

The system enforces this through five reinforcing layers:

1. **Encryption at rest** -- All secrets are stored encrypted in PostgreSQL using per-entity derived keys.
2. **Hash-only authentication** -- API keys are stored as SHA-256 hashes; raw keys are shown once at creation and never persisted.
3. **Just-in-time injection** -- Secrets are decrypted and injected into outbound requests at the last possible moment, then immediately discarded.
4. **Egress interception** -- All outbound traffic from sandboxed code passes through a MITM proxy that replaces placeholder tokens with real values, ensuring the sandbox code only ever handles opaque tokens.
5. **Scoped access** -- Secrets are bound to exactly one entity (org, project, provider, or agent) via exclusive arc constraints enforced at the database level.


## Encryption at Rest

All secret values are encrypted before being written to the database. The encryption pipeline lives in `repos/domain/src/crypto/crypto.ts`.

### Algorithm

- **Cipher**: AES-256-GCM (authenticated encryption)
- **Key derivation**: HKDF (RFC 5869) with SHA-256
- **IV**: 12 bytes, cryptographically random per encryption
- **Auth tag**: 16 bytes (GCM default)
- **Storage format**: Base64-encoded concatenation of `[iv:12][authTag:16][ciphertext:N]`

### Master Key

The platform master key is provided via the `TDSK_MASTER_KEY` environment variable:
- Must be hex-encoded
- Minimum 64 hex characters (32 bytes) for AES-256
- Loaded once at first use, cached in-process
- Kubernetes secret managed via `tdsk kube secret tdsk`

### Per-Entity Key Derivation

Each entity (org, project, provider, agent) gets a unique derived encryption key:

```
HKDF-SHA256(
  ikm:  TDSK_MASTER_KEY (32+ bytes),
  salt: entity ref_id (e.g., org ID, provider ID),
  info: "user-secret-key" (fixed context string),
  len:  32 bytes
) --> derived key
```

Function signature from `repos/domain/src/crypto/crypto.ts`:

```typescript
deriveKey(ref_id: string): Promise<Buffer>
```

The `ref_id` parameter is the owning entity's ID. This means that even if the master key is the same, every entity's secrets are encrypted with a different derived key.

> **Known deviation from RFC 5869**: The `ref_id` is used as the HKDF salt (parameter 3) rather than info (parameter 4). Per the RFC, salt should be random/fixed and info should be contextual. This ordering is preserved for backward compatibility with existing encrypted data.

### Encryption Flow

```
                          TDSK_MASTER_KEY
                                |
                          HKDF(ref_id)
                                |
                          derived_key (32 bytes)
                                |
                    +-----------+-----------+
                    |                       |
               ENCRYPT                 DECRYPT
                    |                       |
    plaintext --> AES-256-GCM         base64 --> split
                    |                       |
          iv (12B) + authTag (16B)    iv | authTag | ciphertext
            + ciphertext                    |
                    |                  AES-256-GCM
               concat + base64             |
                    |                  plaintext
               store in DB
```

Key functions from `repos/domain/src/crypto/crypto.ts`:

```typescript
encryptValue(derivedKey: Buffer, plaintextValue: string): Promise<TEncryptVal>
// Returns: { iv: Buffer, encrypted: Buffer, authTag: Buffer }

decryptValue(derivedKey: Buffer, ciphertext: Buffer, iv: Buffer, authTag: Buffer): Promise<string>

encodeEncrypted(iv: Buffer, authTag: Buffer, encrypted: Buffer): string
// Returns: base64 string of [iv:12][authTag:16][ciphertext:N]
```

### Secret Creation Example

When a secret is created via `POST /secrets` (see `repos/backend/src/endpoints/secrets/createSecret.ts`):

1. Determine the scope owner (`refId`) from the exclusive arc fields
2. `deriveKey(refId)` -- derive a per-entity key from the master key
3. `encryptValue(derivedKey, plaintext)` -- produce IV, auth tag, and ciphertext
4. `encodeEncrypted(iv, authTag, encrypted)` -- pack into base64 for storage
5. `createHashKey(name)` -- truncated SHA-256 of the secret name for lookup
6. Store the `encryptedValue` (base64) and `hashKey` in the database; plaintext is never persisted


## API Key Security

API keys provide programmatic access to the platform as an alternative to JWT authentication.

### Generation

From `repos/domain/src/crypto/crypto.ts`:

```typescript
generateApiKey(): TKeyHash
// Returns: { key, hash, prefix }
```

1. Generate 32 bytes of cryptographically random data via `crypto.randomBytes(32)`
2. Encode as base64url and prepend the `tdsk_` prefix
3. Compute SHA-256 hash of the full key string
4. Extract the first 12 characters as a display prefix

### Storage

Only the **hash** and **prefix** are stored in the database. The raw key is returned to the user exactly once at creation time. On subsequent requests, the raw key is hashed and compared against stored hashes:

```typescript
hashKey(key: string): string
// crypto.createHash('sha256').update(key).digest('hex')
```

### Validation Flow

API key validation occurs in `repos/proxy/src/middleware/setupApiKeyAuth.ts`:

1. Extract token from `Authorization: Bearer tdsk_...`
2. Compute `hashKey(token)` (SHA-256)
3. Look up hash in database via `db.services.apiKey.getByHash(keyHash)`
4. Validate the key is active and not expired via `apiKey.isValid()`
5. Map API key scopes to backend roles:
   - `admin` scope --> `admin` role
   - `write` scope --> `member` role
   - all else --> `viewer` role
6. Set `req.user` with the key's `userId` and derived role
7. Fire-and-forget `touchLastUsed()` update


## JIT Secret Injection

Just-in-time (JIT) secret injection is the mechanism that keeps credentials out of agent and function code. There are two injection paths depending on the execution context: **server-side resolution** for proxy/FaaS endpoints and **egress proxy replacement** for sandboxed pods.

### Server-Side Resolution (Proxy/FaaS Endpoints)

For proxy and FaaS endpoints, secrets are resolved by the `SecretResolver` service (`repos/backend/src/services/secrets/secretResolver.ts`) before outbound requests are made.

**Placeholder format**: `{{ secret-name:secret-id }}` where the ID is a 10-character nanoid.

Regex patterns from `repos/domain/src/constants/values.ts`:

```
SecretRefTest:    /\{\{\s*.+?:[A-Za-z0-9_-]{10}\s*\}\}/
SecretRefPattern: /\{\{\s*(.+?):([A-Za-z0-9_-]{10})\s*\}\}/g
```

**Resolution flow**:

```
  Endpoint Configuration               SecretResolver
  +--------------------------+         +---------------------------+
  | headers:                 |         |                           |
  |   Authorization:         |  --->   | 1. Detect {{ }} patterns  |
  |     "Bearer {{key:abc}}" |         | 2. Load secrets by scope  |
  |                          |         |    (provider + org)       |
  | bodyParams:              |         | 3. Decrypt each secret    |
  |   apiKey: "{{k2:def}}"  |         |    via deriveKey + AES    |
  +--------------------------+         | 4. Replace templates      |
                                       | 5. Return resolved obj    |
                                       +---------------------------+
                                                  |
                                                  v
                                       Outbound request with
                                       real credentials injected
```

The `SecretResolver` supports multiple resolution methods:

- **`resolveHeaders(provider)`** -- Resolves `{{ }}` templates in provider headers
- **`resolveBodyParams(provider)`** -- Resolves templates in provider body parameters (string values only; non-string values pass through)
- **`resolveApiKey(agent, provider)`** -- Direct O(1) lookup via `provider.secretId`
- **`loadAndDecrypt(scope)`** -- Loads provider-scoped + org-scoped secrets, deduplicates (provider takes precedence), and decrypts all

**Decryption with scope fallback** (`SecretResolver.decrypt`):

1. Parse the base64 storage format: `iv[12] | authTag[16] | ciphertext[N]`
2. Determine the scope owner: `agentId || providerId || projectId || orgId`
3. Attempt decryption with the scope owner's derived key
4. If that fails, fall back to `orgId` (handles quickstart secrets encrypted with org key but stored as provider-scoped)
5. If both fail, return `null` and log a warning

### Egress Proxy Replacement (Sandbox Pods)

For sandboxed code running in K8s pods, secrets use opaque placeholder tokens instead of `{{ }}` templates. See the **MITM Proxy** section below for the full flow.


## MITM Proxy (Sandbox Egress)

Sandbox pods execute user-provided code in isolated Kubernetes pods. All outbound HTTP/HTTPS traffic from these pods is intercepted by the **EgressProxy** (`repos/backend/src/services/proxy/egress.ts`), which replaces opaque placeholder tokens with real secret values before forwarding to external services.

### Why a MITM Proxy?

Sandbox code must be able to call external APIs using credentials (API keys, tokens) without ever having access to the real credential values. The solution is a transparent intercepting proxy:

1. When a sandbox pod is created, each secret gets a random placeholder token (`tdsk_ph_` + 16-char nanoid)
2. The sandbox code receives only placeholder tokens as environment variables
3. All outbound traffic is redirected to the egress proxy via iptables DNAT rules
4. The proxy intercepts requests, finds placeholder tokens in headers, and replaces them with decrypted secret values
5. The request reaches the external API with real credentials -- but the sandbox code never saw them

### Architecture

```
  Sandbox Pod (user code)
  +----------------------------------------------+
  |                                              |
  |  fetch("https://api.openai.com/v1/chat", {   |
  |    headers: {                                |
  |      Authorization: "Bearer tdsk_ph_Ax7k..." |  <-- opaque token,
  |    }                                         |      NOT real key
  |  })                                          |
  |                                              |
  +-----|----------------------------------------+
        | iptables DNAT redirects all outbound
        | traffic to egress proxy port
        v
  EgressProxy (front TCP server, port from config)
  +----------------------------------------------+
  |                                              |
  |  1. Protocol sniff first byte                |
  |     +-- 0x16? --> TLS path                   |
  |     +-- else --> HTTP path                   |
  |                                              |
  +-----|---------------------|------------------+
        |                     |
   HTTP path             TLS path
        |                     |
        v                     v
  Pipe directly         Extract SNI from
  to MITM proxy         ClientHello
  on loopback           (extractSNI.ts)
  port, inject               |
  X-TDSK-Real-IP             v
  header              Synthesize HTTP
        |              CONNECT tunnel
        |              to MITM proxy
        |              with X-TDSK-Real-IP
        |                     |
        +----------+----------+
                   |
                   v
        MITM Proxy (http-mitm-proxy, loopback port)
        +--------------------------------------+
        |                                      |
        |  1. Read X-TDSK-Real-IP header       |
        |     to identify source pod           |
        |                                      |
        |  2. Look up pod IP in route table    |
        |     to find placeholder map          |
        |                                      |
        |  3. Scan ALL headers for tokens      |
        |     matching tdsk_ph_* prefix        |
        |                                      |
        |  4. For each token found:            |
        |     a. Look up secret ID from map    |
        |     b. Fetch + decrypt from DB       |
        |     c. Replace token with real value |
        |                                      |
        |  5. Strip X-TDSK-Real-IP header      |
        |     (never forwarded externally)     |
        |                                      |
        |  6. Forward to original destination  |
        |                                      |
        +--------------------------------------+
                   |
                   v
        External API receives request
        with real credentials
```

### Protocol Sniffing

The front TCP server (`handleConnection`) peeks at the first byte of each connection:

- **`0x16` (TLS ClientHello)**: The connection is TLS. The SNI hostname is extracted from the ClientHello message via `repos/backend/src/utils/proxy/extractSNI.ts`, then the connection is converted into an HTTP CONNECT tunnel to the internal MITM proxy.
- **Any other byte**: The connection is plain HTTP. It is piped directly to the MITM proxy on the loopback port.

In both cases, the real client IP is injected via the `x-tdsk-real-ip` header so the MITM request handler can identify which sandbox pod the traffic came from.

### Placeholder Token Lifecycle

1. **Pod creation** (`repos/backend/src/services/sandboxes/sandbox.ts`): For each secret ID in the sandbox config, generate `tdsk_ph_` + `nanoid(16)`. Store the mapping `{ token -> secretId }` in the route table.
2. **Pod runtime**: Sandbox code uses placeholder tokens in HTTP headers (e.g., `Authorization: Bearer tdsk_ph_Ax7kM3nP...`).
3. **Egress interception**: The `EgressProxy.handleRequest` method scans all outgoing headers for any value containing the `tdsk_ph_` prefix. When found, the token is looked up in the route table and replaced with the decrypted secret value.
4. **Failure mode**: If a placeholder token maps to a secret that cannot be resolved (deleted, decryption failure), the proxy throws an error and returns HTTP 502 to the sandbox. This prevents placeholder tokens from leaking to external services.

### CA Certificate Management

The MITM proxy uses a custom CA certificate for TLS interception:

- CA cert and key paths: `/etc/tdsk/ca/tls.crt` and `/etc/tdsk/ca/tls.key` (defined in `repos/backend/src/constants/values.ts`)
- On startup, `prepareCaDir()` creates a temp directory with the CA cert/key in the layout expected by `http-mitm-proxy`
- The library auto-generates per-hostname certificates signed by this CA
- The CA cert is injected into sandbox pods so they trust the proxy's generated certificates
- On shutdown, the temp directory is cleaned up via `fs.rmSync`


## Secret Scoping

Secrets follow the **exclusive arc** pattern -- each secret belongs to exactly one owner entity. The database enforces this with constraints.

### Four Scope Levels

| Scope | Field | Visibility | Use Case |
|-------|-------|-----------|----------|
| **Organization** | `orgId` | All members of the org | Shared API keys, org-wide credentials |
| **Project** | `projectId` | Project members only | Project-specific service credentials |
| **Provider** | `providerId` | Provider context only | LLM API keys tied to a specific provider config |
| **Agent** | `agentId` | Agent execution context only | Agent-specific credentials |

### Scope Resolution Order

When decrypting secrets, `SecretResolver.decrypt` determines the scope owner by priority:

```
agentId > providerId > projectId > orgId
```

If decryption fails with the scope owner's derived key, a fallback to `orgId` is attempted (handles quickstart secrets where encryption used the org key but storage used provider scope).

### Dual Ownership Exception

Provider secrets support dual ownership (`orgId` + `providerId`) so they appear in both the organization Secrets page and the Provider configuration drawer. In this case, the encryption key derivation uses `orgId` as the `refId`.

### Secret Loading Precedence

When `SecretResolver.loadAndDecrypt` resolves secrets for an operation:

1. Load provider-scoped secrets (`where: { providerId }`)
2. Load org-scoped secrets (`where: { orgId }`)
3. Deduplicate by secret ID -- provider-scoped secrets take precedence when names collide
4. Decrypt each secret and return the resolved set


## Auth Chain

### Request Flow

```
  Client (Browser / CLI / API Key)
    |
    | HTTPS request
    v
  Caddy (TLS termination, port 443)
    |
    | Plain HTTP (cluster-internal)
    v
  Auth Proxy (repos/proxy, port 7118)
    |
    | 1. Route classification
    |    - Public route?    --> skip all auth
    |    - Session route?   --> skip JWT/API key, require session token
    |    - Protected route? --> require JWT or API key
    |
    | 2. JWT validation (setupAuth.ts)
    |    - Extract token from Authorization: Bearer <jwt>
    |    - Skip if token starts with tdsk_ (API key, not JWT)
    |    - Verify via JWKS (jose library, Neon Auth endpoint)
    |    - Set req.user = { userId, email, role }
    |
    | 3. API key validation (setupApiKeyAuth.ts)
    |    - Skip if req.user already set (JWT succeeded)
    |    - Extract token from Authorization: Bearer tdsk_...
    |    - SHA-256 hash, DB lookup, validate active/unexpired
    |    - Set req.user = { userId, role, orgId?, projectId? }
    |
    | 4. Session token check (setupSessionAuth.ts)
    |    - Only for /ai/ws route
    |    - Verify token is present (backend validates it)
    |
    | 5. Forward to backend with auth headers
    |
    v
  Backend (repos/backend, port 5885)
    |
    | Reads auth from forwarded headers:
    |   X-User-Id
    |   X-User-Role
    |   X-User-Email
    |   X-User-Org-Id      (if API key scoped)
    |   X-User-Project-Id  (if API key scoped)
    |
    | Additional proxy-to-backend identity:
    |   Custom header key/value (shared secret)
    |
    v
  Business logic / External APIs / Database
```

### Three Auth Mechanisms

| Mechanism | Token Format | Validator | Routes | Who Issues |
|-----------|-------------|-----------|--------|------------|
| **JWT** | `Bearer <jwt>` | JWKS via jose (Neon Auth) | All protected routes | Neon Auth (social login) |
| **API Key** | `Bearer tdsk_<base64url>` | SHA-256 hash lookup in DB | All protected routes (fallback) | Backend `generateApiKey()` |
| **Session Token** | `Bearer <token>` or `?token=<token>` | Presence check by proxy; validated by backend | `/ai/ws` only | Backend `POST /_/ai/sessions` |

Each request receives exactly one auth mechanism -- they do not overlap. The middleware chain short-circuits once authentication succeeds.

### Proxy-to-Backend Trust

The proxy forwards authenticated identity to the backend via headers set by `setAuthHeaders()` from `repos/domain/src/api/authHeaders.ts`:

```typescript
AuthHeaders = {
  'user.userId':    'X-User-Id',
  'user.role':      'X-User-Role',
  'user.email':     'X-User-Email',
  'user.orgId':     'X-User-Org-Id',
  'user.projectId': 'X-User-Project-Id',
}
```

An additional shared secret header (`headerKey`/`headerValue` from config) provides proxy-to-backend identity verification, ensuring the backend only accepts requests that passed through the auth proxy.

### WebSocket Authentication

WebSocket connections for AI agent interaction (`/ai/ws`) use a dedicated flow:

1. Client obtains a session token via `POST /_/ai/sessions` (authenticated with JWT or API key)
2. Client connects to `/ai/ws?token=<session-token>` or with `Authorization: Bearer <token>`
3. Proxy's `setupSessionAuth` verifies a token is present (does not validate it)
4. Backend validates the session token against its internal session state
5. WebSocket upgrade proceeds if valid


## Key Source Files

| File | Role |
|------|------|
| `repos/domain/src/crypto/crypto.ts` | AES-256-GCM encryption, HKDF key derivation, API key generation, SHA-256 hashing |
| `repos/domain/src/constants/values.ts` | `ApiKeyPrefix`, `AuthHeaders`, `SecretRefTest`, `SecretRefPattern` |
| `repos/domain/src/api/authHeaders.ts` | `setAuthHeaders()`, `fromAuthHeaders()` for proxy-to-backend header forwarding |
| `repos/proxy/src/middleware/setupAuth.ts` | JWT validation via JWKS |
| `repos/proxy/src/middleware/setupApiKeyAuth.ts` | API key hash-based validation |
| `repos/proxy/src/middleware/setupSessionAuth.ts` | Session token presence check for `/ai/ws` |
| `repos/proxy/src/middleware/setupProxy.ts` | http-proxy-middleware forwarding with auth headers |
| `repos/proxy/src/services/auth.ts` | JWKS client, token extraction, JWT verification |
| `repos/backend/src/endpoints/secrets/createSecret.ts` | Secret encryption and storage flow |
| `repos/backend/src/services/secrets/secretResolver.ts` | Secret decryption, template resolution, scope-aware loading |
| `repos/backend/src/services/proxy/egress.ts` | MITM egress proxy for sandbox pods |
| `repos/backend/src/services/proxy/proxy.ts` | ProxyService with OAuth, auth injection, domain whitelist |
| `repos/backend/src/services/endpoints/proxyEndpoint.ts` | Proxy endpoint execution with secret fetching |
| `repos/backend/src/services/sandboxes/sandbox.ts` | Placeholder token generation during pod creation |
| `repos/backend/src/utils/proxy/extractSNI.ts` | TLS ClientHello SNI extraction |
| `repos/backend/src/constants/values.ts` | `PhTokenPrefix`, `RealIpHeader`, `CACertPath`, `CAKeyPath` |
