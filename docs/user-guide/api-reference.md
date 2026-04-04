# Threaded Stack API Reference

## Base URL

| Environment | Base URL |
|-------------|----------|
| Managed (production) | `https://<your-domain>` |
| Local development | `https://local.threadedstack.app` |

All admin API endpoints are served under the `/_/` path prefix. Proxy and WebSocket endpoints use their own top-level paths (`/proxy/`, `/ai/`).

---

## Authentication

### Methods

Threaded Stack supports two authentication methods:

1. **JWT Bearer Token** -- Obtained via Neon Auth social login (GitHub, GitLab, Google, Vercel). The proxy validates the JWT against a JWKS endpoint.

2. **API Key** -- Programmatic access keys prefixed with `tdsk_`. Generated via the API Keys endpoints.

Both are sent in the `Authorization` header:

```
Authorization: Bearer <jwt-token>
Authorization: Bearer tdsk_<api-key>
```

### Public Endpoints (No Auth Required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Proxy health check |
| GET | `/_/health` | Backend health check |
| GET | `/_/` | Backend base endpoint |

All other `/_/*` endpoints require a valid JWT or API key.

### Session Token Auth (WebSocket Only)

The `/ai/ws` WebSocket endpoint uses session token authentication. Obtain a session token via `POST /_/ai/sessions` (which requires JWT/API key auth), then connect with:

```
wss://<base-url>/ai/ws?token=<session-token>
```

Session tokens expire after 1 hour.

---

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 50 | 200 | Number of records to return |
| `offset` | 0 | -- | Number of records to skip |

Paginated responses include `limit` and `offset` in the response body alongside the `data` array.

---

## Endpoints by Resource

### Organizations

All organization endpoints are under `/_/orgs`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs` | List organizations (returns only orgs where user is a member; super admins see all) |
| POST | `/_/orgs` | Create a new organization (creator becomes owner) |
| GET | `/_/orgs/:orgId` | Get organization by ID |
| PUT | `/_/orgs/:orgId` | Update an organization (admin+) |
| DELETE | `/_/orgs/:orgId` | Delete an organization (owner only) |

#### Organization Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/members` | List all members of an organization (any member) |
| POST | `/_/orgs/:orgId/members` | Add a member to an organization (admin+) |
| PUT | `/_/orgs/:orgId/members/:userId` | Update a member's role (admin+) |
| DELETE | `/_/orgs/:orgId/members/:userId` | Remove a member from an organization (admin+) |

#### Organization Roles

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/_/orgs/:orgId/roles/:roleId` | Update a user's role in an organization (admin+) |
| DELETE | `/_/orgs/:orgId/roles/:roleId` | Remove a user from an organization (admin+) |

#### Invite Users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/_/orgs/:orgId/users/invite` | Invite a user to the organization by email (admin+) |

#### Quickstart

| Method | Path | Description |
|--------|------|-------------|
| POST | `/_/orgs/:orgId/quickstart` | Create Provider + Secret + Project + Agent + Endpoint in a single transaction (admin+) |

**Quickstart body:**

```json
{
  "providerBrand": "anthropic",
  "apiKey": "sk-...",
  "projectName": "My Project",
  "agentName": "My Agent",
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 100000,
  "systemPrompt": "You are a helpful assistant.",
  "agentDescription": "General purpose agent"
}
```

### Org-Scoped Resources

The following resources are accessed through organization-scoped paths.

#### Projects (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/projects` | List projects in an organization |
| POST | `/_/orgs/:orgId/projects` | Create a project |
| GET | `/_/orgs/:orgId/projects/:projectId` | Get a project by ID |
| PUT | `/_/orgs/:orgId/projects/:projectId` | Update a project |
| DELETE | `/_/orgs/:orgId/projects/:projectId` | Delete a project |

#### Project Members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/projects/:projectId/members` | List project members |
| POST | `/_/orgs/:orgId/projects/:projectId/members` | Add a member to a project |
| PUT | `/_/orgs/:orgId/projects/:projectId/members/:userId` | Update a project member's role |
| DELETE | `/_/orgs/:orgId/projects/:projectId/members/:userId` | Remove a member from a project |

#### Endpoints (Project-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/projects/:projectId/endpoints` | List endpoints in a project |
| POST | `/_/orgs/:orgId/projects/:projectId/endpoints` | Create an endpoint |
| GET | `/_/orgs/:orgId/projects/:projectId/endpoints/:id` | Get an endpoint by ID |
| PUT | `/_/orgs/:orgId/projects/:projectId/endpoints/:id` | Update an endpoint |
| DELETE | `/_/orgs/:orgId/projects/:projectId/endpoints/:id` | Delete an endpoint |

#### Functions (Project-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/projects/:projectId/functions` | List functions in a project |
| POST | `/_/orgs/:orgId/projects/:projectId/functions` | Create a function |
| GET | `/_/orgs/:orgId/projects/:projectId/functions/:id` | Get a function by ID |
| PUT | `/_/orgs/:orgId/projects/:projectId/functions/:id` | Update a function |
| DELETE | `/_/orgs/:orgId/projects/:projectId/functions/:id` | Delete a function |

#### Secrets (Org-Scoped and Project-Scoped)

Secrets can be managed at both the organization and project level. Secret values are encrypted with AES-256-GCM and never returned in responses.

**Org-scoped secrets:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/secrets` | List secrets for an organization |
| POST | `/_/orgs/:orgId/secrets` | Create an org-scoped secret |
| GET | `/_/orgs/:orgId/secrets/:id` | Get a secret by ID |
| PUT | `/_/orgs/:orgId/secrets/:id` | Update a secret |
| DELETE | `/_/orgs/:orgId/secrets/:id` | Delete a secret |

**Project-scoped secrets:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/projects/:projectId/secrets` | List secrets for a project |
| POST | `/_/orgs/:orgId/projects/:projectId/secrets` | Create a project-scoped secret |
| GET | `/_/orgs/:orgId/projects/:projectId/secrets/:id` | Get a secret by ID |
| PUT | `/_/orgs/:orgId/projects/:projectId/secrets/:id` | Update a secret |
| DELETE | `/_/orgs/:orgId/projects/:projectId/secrets/:id` | Delete a secret |

#### API Keys (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/api-keys` | List API keys for an organization |
| POST | `/_/orgs/:orgId/api-keys` | Create a new API key (returns the full key once; subsequent reads are masked) |
| GET | `/_/orgs/:orgId/api-keys/:id` | Get an API key by ID |
| PUT | `/_/orgs/:orgId/api-keys/:id` | Update an API key |
| DELETE | `/_/orgs/:orgId/api-keys/:id` | Delete an API key |

#### Providers (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/providers` | List providers for an organization |
| POST | `/_/orgs/:orgId/providers` | Create a provider |
| GET | `/_/orgs/:orgId/providers/:id` | Get a provider by ID |
| PUT | `/_/orgs/:orgId/providers/:id` | Update a provider |
| DELETE | `/_/orgs/:orgId/providers/:id` | Delete a provider |

#### Provider Models (Global)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/_/providers/:brand/models` | Fetch available models for a provider brand (e.g., `anthropic`, `openai`, `google`) |

#### Agents (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/agents` | List agents for an organization |
| POST | `/_/orgs/:orgId/agents` | Create an agent |
| GET | `/_/orgs/:orgId/agents/:id` | Get an agent by ID |
| PUT | `/_/orgs/:orgId/agents/:id` | Update an agent |
| DELETE | `/_/orgs/:orgId/agents/:id` | Delete an agent |
| POST | `/_/orgs/:orgId/agents/:id/run` | Run an agent with SSE streaming |

**Agent run body:**

```json
{
  "prompt": "Hello, how can you help me?",
  "threadId": "optional-existing-thread-id",
  "providerId": "optional-provider-override-id"
}
```

#### Agent Project Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/projects/:projectId/agents/:agentId/config` | Get agent-project configuration |
| PUT | `/_/orgs/:orgId/projects/:projectId/agents/:agentId/config` | Create or update agent-project configuration |
| DELETE | `/_/orgs/:orgId/projects/:projectId/agents/:agentId/config` | Delete agent-project configuration |

#### OpenAI-Compatible Endpoints

Each agent exposes OpenAI-compatible endpoints for integration with tools that use the OpenAI API format.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/agents/:id/v1/models` | List models available to the agent (OpenAI format) |
| POST | `/_/agents/:id/v1/chat/completions` | Chat completions (OpenAI format, supports streaming) |

#### Threads (Agent-Scoped)

Threads are scoped under agents within an organization.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/agents/:agentId/threads` | List threads for an agent |
| POST | `/_/orgs/:orgId/agents/:agentId/threads` | Create a new thread |
| GET | `/_/orgs/:orgId/agents/:agentId/threads/:id` | Get a thread by ID (supports `?include=branches`) |
| PUT | `/_/orgs/:orgId/agents/:agentId/threads/:id` | Update a thread |
| DELETE | `/_/orgs/:orgId/agents/:agentId/threads/:id` | Delete a thread |
| POST | `/_/orgs/:orgId/agents/:agentId/threads/:threadId/branch` | Branch a thread from a specific message |

#### Messages (Thread-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages` | List messages in a thread |
| POST | `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages` | Create a message |
| PUT | `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages/:messageId` | Update a message |
| DELETE | `/_/orgs/:orgId/agents/:agentId/threads/:threadId/messages/:messageId` | Delete a message |

#### File Uploads (Thread-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/_/orgs/:orgId/agents/:agentId/threads/:threadId/files` | Upload a file to a thread |

**Upload body:**

```json
{
  "fileName": "document.pdf",
  "data": "<base64-encoded-content>",
  "mimeType": "application/pdf"
}
```

#### Domains (Org-Scoped and Project-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/domains` | List domains for an organization |
| POST | `/_/orgs/:orgId/domains` | Create a domain |
| GET | `/_/orgs/:orgId/domains/:id` | Get a domain by ID |
| PUT | `/_/orgs/:orgId/domains/:id` | Update a domain |
| DELETE | `/_/orgs/:orgId/domains/:id` | Delete a domain |

Project-scoped domain endpoints follow the same pattern under `/_/orgs/:orgId/projects/:projectId/domains`.

#### Skills (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/skills` | List skills for an organization |
| POST | `/_/orgs/:orgId/skills` | Create a skill |
| GET | `/_/orgs/:orgId/skills/:skillId` | Get a skill by ID |
| PUT | `/_/orgs/:orgId/skills/:skillId` | Update a skill |
| DELETE | `/_/orgs/:orgId/skills/:skillId` | Delete a skill |
| POST | `/_/orgs/:orgId/skills/:skillId/agents/:agentId` | Attach a skill to an agent |
| DELETE | `/_/orgs/:orgId/skills/:skillId/agents/:agentId` | Detach a skill from an agent |

#### Sandboxes (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/sandboxes` | List sandboxes for an organization |
| POST | `/_/orgs/:orgId/sandboxes` | Create a sandbox |
| GET | `/_/orgs/:orgId/sandboxes/:id` | Get a sandbox by ID |
| PUT | `/_/orgs/:orgId/sandboxes/:id` | Update a sandbox |
| DELETE | `/_/orgs/:orgId/sandboxes/:id` | Delete a sandbox |
| GET | `/_/orgs/:orgId/sandboxes/:id/status` | Get sandbox status |
| POST | `/_/orgs/:orgId/sandboxes/:id/start` | Start a sandbox |
| DELETE | `/_/orgs/:orgId/sandboxes/:id/stop` | Stop a sandbox |
| POST | `/_/orgs/:orgId/sandboxes/:id/exec` | Execute a command in a sandbox |

#### Schedules (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/schedules` | List schedules for an organization |
| POST | `/_/orgs/:orgId/schedules` | Create a schedule |
| GET | `/_/orgs/:orgId/schedules/:scheduleId` | Get a schedule by ID |
| PUT | `/_/orgs/:orgId/schedules/:scheduleId` | Update a schedule |
| DELETE | `/_/orgs/:orgId/schedules/:scheduleId` | Delete a schedule |
| POST | `/_/orgs/:orgId/schedules/:scheduleId/trigger` | Manually trigger a schedule |

#### Quotas (Org-Scoped)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/orgs/:orgId/quotas` | Get current quota usage for an organization |
| GET | `/_/orgs/:orgId/quotas/limits` | Get plan limits for an organization |
| POST | `/_/orgs/:orgId/quotas/check` | Check if an action is within quota limits |

**Quota check body:**

```json
{
  "resource": "threads",
  "amount": 1
}
```

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/users` | List users (requires `?orgId=` query param, or super admin) |
| POST | `/_/users` | Create a user (admin+) |
| GET | `/_/users/:id` | Get a user by ID |
| PUT | `/_/users/:id` | Update a user |
| DELETE | `/_/users/:id` | Delete a user |

### Assets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/assets` | List assets |
| POST | `/_/assets` | Create an asset |
| GET | `/_/assets/:id` | Get an asset by ID |
| PUT | `/_/assets/:id` | Update an asset |
| DELETE | `/_/assets/:id` | Delete an asset |

### Subscriptions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/subscriptions/plans` | Get all available subscription plans |
| GET | `/_/subscriptions/current` | Get the current user's subscription |
| GET | `/_/subscriptions/invoices` | Get invoices for the current user |
| POST | `/_/subscriptions/checkout` | Create a Stripe checkout session |
| POST | `/_/subscriptions/update` | Update current subscription tier |
| POST | `/_/subscriptions/portal` | Create a Stripe customer portal session |
| DELETE | `/_/subscriptions/current` | Cancel the current subscription (at period end) |

**Checkout body:**

```json
{
  "tier": "pro",
  "successUrl": "https://app.example.com/billing?success=true",
  "cancelUrl": "https://app.example.com/billing?cancel=true"
}
```

### Invitations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_/invitations/me` | Get pending invitations for the current user |
| GET | `/_/invitations/org/:orgId` | List invitations for an organization (admin+, supports `?status=` filter) |
| POST | `/_/invitations/accept` | Accept an invitation (`{ token: string }`) |
| DELETE | `/_/invitations/:invitationId` | Revoke a pending invitation (admin+) |

### Payments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/_/payments/webhooks` | Stripe webhook handler (raw body, signature verified) |

### AI Sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/_/ai/sessions` | Create an LLM session (returns a session token for WebSocket use) |

**Session body:**

```json
{
  "agentId": "agent-uuid",
  "projectId": "optional-project-uuid"
}
```

### Proxy Engine

The proxy engine dispatches requests to configured endpoints (proxy, FaaS, or agent type) based on the project and endpoint IDs.

| Method | Path | Description |
|--------|------|-------------|
| ALL | `/proxy/:projectId/:endpointId` | Execute a configured endpoint (method determined by endpoint config) |

Public endpoints skip authentication. Non-public endpoints authenticate via proxy-forwarded headers.

---

## Streaming Endpoints

### SSE -- Agent Run

**Endpoint:** `POST /_/orgs/:orgId/agents/:id/run`

Runs an agent and streams the response as Server-Sent Events.

**Connection setup:**

```bash
curl -N -X POST https://local.threadedstack.app/_/orgs/:orgId/agents/:id/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

**Event format:**

Each SSE event is a JSON object with a `type` field:

```
data: {"type":"start","data":{}}

data: {"type":"text_start","data":{}}

data: {"type":"text_delta","data":{"text":"Hello"}}

data: {"type":"text_delta","data":{"text":" there!"}}

data: {"type":"text_end","data":{}}

data: {"type":"thinking_start","data":{}}

data: {"type":"thinking_delta","data":{"text":"Let me consider..."}}

data: {"type":"thinking_end","data":{}}

data: {"type":"toolcall_start","data":{"name":"search","id":"call_123"}}

data: {"type":"toolcall_delta","data":{"text":"{\"query\":\"..."}}

data: {"type":"toolcall_end","data":{}}

data: {"type":"done","data":{}}
```

**Event types:**

| Type | Description |
|------|-------------|
| `start` | Stream started |
| `text_start` | Text content block started |
| `text_delta` | Incremental text content |
| `text_end` | Text content block ended |
| `thinking_start` | Thinking/reasoning block started |
| `thinking_delta` | Incremental thinking content |
| `thinking_end` | Thinking/reasoning block ended |
| `toolcall_start` | Tool call started (includes tool name and call ID) |
| `toolcall_delta` | Incremental tool call arguments |
| `toolcall_end` | Tool call ended |
| `done` | Stream complete |
| `error` | An error occurred |

### WebSocket -- AI Chat

**Endpoint:** `WS /ai/ws?token=<session-token>`

Real-time bidirectional communication for AI agent execution.

**Connection setup:**

1. Create a session via `POST /_/ai/sessions` with JWT/API key auth.
2. Connect to the WebSocket with the returned session token:

```javascript
const ws = new WebSocket("wss://local.threadedstack.app/ai/ws?token=<session-token>");

ws.onopen = () => {
  ws.send(JSON.stringify({ prompt: "Hello" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type matches the same event types as SSE (text_delta, done, etc.)
};
```

**Message format:**

WebSocket messages use the same event type structure as SSE events. Send messages as JSON with a `prompt` field. Responses arrive as JSON objects with `type` and `data` fields matching the SSE event types listed above.

**Close codes:**

| Code | Meaning |
|------|---------|
| 4001 | Session token missing or invalid |

---

## Error Format

All error responses follow a consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

The `code` field is present when a specific error code was set. Database errors containing raw SQL are sanitized before being sent to the client.

### Common HTTP Status Codes

| Status | Meaning | Typical Cause |
|--------|---------|---------------|
| 400 | Bad Request | Missing required fields, invalid input, malformed UUID |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for the requested action |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource name or unique constraint violation |
| 500 | Internal Server Error | Unexpected server-side failure |

### Common Error Codes

| Code | Description |
|------|-------------|
| `BAD_REQUEST` | Request validation failed |
| `FORBIDDEN` | Permission denied (role hierarchy violation, seat limit, etc.) |
| `Unknown` | Unhandled exception (no specific code assigned) |

### UUID Validation

All `:id`, `:orgId`, `:projectId`, `:agentId`, `:threadId`, and similar path parameters are automatically validated as UUIDs. Invalid UUID format returns:

```json
{
  "error": "Invalid ID format \u2014 expected a valid UUID",
  "code": "BAD_REQUEST"
}
```

---

## Response Format

Successful responses wrap data in a `data` field:

```json
{
  "data": { ... }
}
```

List endpoints include pagination metadata:

```json
{
  "data": [ ... ],
  "limit": 50,
  "offset": 0
}
```

Create operations return HTTP 201. Read and update operations return HTTP 200. Delete operations return HTTP 200.
