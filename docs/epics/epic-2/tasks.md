# Epic 2: Backend Proxy Feature - Task Tracking

**Goal:** Implement a production-ready Reverse Proxy with Secret Injection, Body Transformation, and Machine-to-Machine Authentication.

## Task Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## 1. Backend API & Data

### 1.1 Secrets Management API
- [ ] **TASK-1.1.1**: Create secrets endpoint file at `repos/backend/src/endpoints/secrets.ts`
- [ ] **TASK-1.1.2**: Implement `POST /_api/secrets` - Create secret (encrypt value before storage)
- [ ] **TASK-1.1.3**: Implement `GET /_api/secrets` - List secrets (metadata only, no values)
- [ ] **TASK-1.1.4**: Implement `GET /_api/secrets/:id` - Get secret metadata by ID
- [ ] **TASK-1.1.5**: Implement `PUT /_api/secrets/:id` - Update secret
- [ ] **TASK-1.1.6**: Implement `DELETE /_api/secrets/:id` - Delete secret
- [ ] **TASK-1.1.7**: Implement encryption utility for secret values
- [ ] **TASK-1.1.8**: Implement decryption utility for secret values
- [ ] **TASK-1.1.9**: Associate secrets with Teams (team_id foreign key)
- [ ] **TASK-1.1.10**: Associate secrets with Repos (repo_id foreign key - exclusive arc)

### 1.2 Endpoint Management API
- [ ] **TASK-1.2.1**: Create endpoints endpoint file at `repos/backend/src/endpoints/proxyEndpoints.ts`
- [ ] **TASK-1.2.2**: Implement `POST /_api/endpoints` - Create proxy endpoint definition
- [ ] **TASK-1.2.3**: Implement `GET /_api/endpoints` - List endpoints
- [ ] **TASK-1.2.4**: Implement `GET /_api/endpoints/:id` - Get endpoint by ID
- [ ] **TASK-1.2.5**: Implement `PUT /_api/endpoints/:id` - Update endpoint
- [ ] **TASK-1.2.6**: Implement `DELETE /_api/endpoints/:id` - Delete endpoint
- [ ] **TASK-1.2.7**: Define schema validation for `proxy_url` field
- [ ] **TASK-1.2.8**: Define schema validation for `proxy_headers` field
- [ ] **TASK-1.2.9**: Define schema validation for `proxy_options` (regex/replacements)
- [ ] **TASK-1.2.10**: Implement endpoint-to-secrets association

---

## 2. Proxy Engine Logic (`/proxy/*`)

### 2.1 Request Matching
- [ ] **TASK-2.1.1**: Create proxy engine router at `repos/backend/src/middleware/proxyEngine.ts`
- [ ] **TASK-2.1.2**: Implement path-based endpoint lookup from database
- [ ] **TASK-2.1.3**: Implement regex-based path matching for flexible routing
- [ ] **TASK-2.1.4**: Handle endpoint not found (404) responses

### 2.2 Secret Decryption
- [ ] **TASK-2.2.1**: Implement secret fetching for matched endpoint
- [ ] **TASK-2.2.2**: Implement runtime decryption of secret values
- [ ] **TASK-2.2.3**: Cache decrypted secrets with TTL for performance
- [ ] **TASK-2.2.4**: Implement secret reference resolution in headers (e.g., `{{SECRET_NAME}}`)

### 2.3 Header Injection
- [ ] **TASK-2.3.1**: Implement header merger utility
- [ ] **TASK-2.3.2**: Inject Authorization headers from secrets
- [ ] **TASK-2.3.3**: Inject custom headers defined in endpoint config
- [ ] **TASK-2.3.4**: Support dynamic header values from request context
- [ ] **TASK-2.3.5**: Implement header sanitization (remove sensitive client headers)

### 2.4 Body Transformation
- [ ] **TASK-2.4.1**: Create body transformer utility at `repos/backend/src/utils/proxy/bodyTransformer.ts`
- [ ] **TASK-2.4.2**: Implement regex-based find/replace on request body
- [ ] **TASK-2.4.3**: Implement JSON path-based value replacement
- [ ] **TASK-2.4.4**: Implement secret injection into request body
- [ ] **TASK-2.4.5**: Support multiple transformation rules in sequence

### 2.5 Request Execution & Streaming
- [ ] **TASK-2.5.1**: Implement HTTP client for outbound requests
- [ ] **TASK-2.5.2**: Stream request body to target URL
- [ ] **TASK-2.5.3**: Stream response body back to client
- [ ] **TASK-2.5.4**: Handle connection timeouts gracefully
- [ ] **TASK-2.5.5**: Implement retry logic with exponential backoff
- [ ] **TASK-2.5.6**: Pass through response headers (with filtering)
- [ ] **TASK-2.5.7**: Implement request/response logging for debugging

---

## 3. Security & Auth Layer

### 3.1 OAuth Client Credentials
- [ ] **TASK-3.1.1**: Create OAuth config schema for endpoints
- [ ] **TASK-3.1.2**: Implement client credentials token fetch
- [ ] **TASK-3.1.3**: Implement token caching with expiry tracking
- [ ] **TASK-3.1.4**: Implement automatic token refresh before expiry
- [ ] **TASK-3.1.5**: Support multiple OAuth providers per endpoint

### 3.2 API Key Authentication
- [ ] **TASK-3.2.1**: Create API key model/schema additions
- [ ] **TASK-3.2.2**: Implement `POST /_api/api-keys` - Generate API key
- [ ] **TASK-3.2.3**: Implement `GET /_api/api-keys` - List API keys (masked)
- [ ] **TASK-3.2.4**: Implement `DELETE /_api/api-keys/:id` - Revoke API key
- [ ] **TASK-3.2.5**: Implement API key validation middleware
- [ ] **TASK-3.2.6**: Support API key scopes (read, write, admin)
- [ ] **TASK-3.2.7**: Implement rate limiting per API key

### 3.3 Domain Whitelisting
- [ ] **TASK-3.3.1**: Create domain whitelist schema
- [ ] **TASK-3.3.2**: Implement domain whitelist management API
- [ ] **TASK-3.3.3**: Implement pre-request domain validation
- [ ] **TASK-3.3.4**: Support wildcard domain patterns (e.g., `*.example.com`)
- [ ] **TASK-3.3.5**: Log blocked domain attempts for security auditing

---

## 4. Frontend / Admin UI

### 4.1 Secrets Manager UI
- [ ] **TASK-4.1.1**: Create Secrets page at `repos/admin/src/pages/Secrets/Secrets.tsx`
- [ ] **TASK-4.1.2**: Create Secret detail page at `repos/admin/src/pages/Secrets/Secret.tsx`
- [ ] **TASK-4.1.3**: Implement secrets list table with pagination
- [ ] **TASK-4.1.4**: Implement secret creation form/modal
- [ ] **TASK-4.1.5**: Implement secret edit form (value hidden by default)
- [ ] **TASK-4.1.6**: Implement secret deletion with confirmation
- [ ] **TASK-4.1.7**: Add secrets tab/section to Team detail page
- [ ] **TASK-4.1.8**: Add secrets tab/section to Repo detail page
- [ ] **TASK-4.1.9**: Create Secrets API service in admin

### 4.2 Endpoint Builder UI
- [ ] **TASK-4.2.1**: Create Endpoints page at `repos/admin/src/pages/Endpoints/Endpoints.tsx`
- [ ] **TASK-4.2.2**: Create Endpoint detail page at `repos/admin/src/pages/Endpoints/Endpoint.tsx`
- [ ] **TASK-4.2.3**: Implement endpoint list table with pagination
- [ ] **TASK-4.2.4**: Create endpoint builder form component
- [ ] **TASK-4.2.5**: Implement target URL input with validation
- [ ] **TASK-4.2.6**: Implement headers configuration UI (key-value pairs)
- [ ] **TASK-4.2.7**: Implement secret reference picker (dropdown of available secrets)
- [ ] **TASK-4.2.8**: Implement proxy_options configuration (regex rules)
- [ ] **TASK-4.2.9**: Implement endpoint testing tool (send test request)
- [ ] **TASK-4.2.10**: Create Endpoints API service in admin
- [ ] **TASK-4.2.11**: Add route for Endpoints in admin router

### 4.3 API Keys UI
- [ ] **TASK-4.3.1**: Create API Keys section in Settings or Team page
- [ ] **TASK-4.3.2**: Implement API key generation UI
- [ ] **TASK-4.3.3**: Display generated key once (copy to clipboard)
- [ ] **TASK-4.3.4**: Implement API key list with revoke option
- [ ] **TASK-4.3.5**: Implement API key scope selection

---

## Deliverables Checklist

- [ ] User can create an Endpoint via the Admin UI
- [ ] User can create and attach a Secret to an Endpoint
- [ ] User can generate an API Key for M2M authentication
- [ ] Proxy validates API Key or OAuth credentials
- [ ] Proxy successfully injects headers from secrets
- [ ] Proxy performs body transformations when configured
- [ ] Proxy streams response from target URL back to client

---

## Dependencies

- **Epic 1**: Base Setup must be completed (Auth, Users, Teams, basic UI)

## Technical Notes

- Secrets must be encrypted at rest using AES-256 or similar
- Secret values should never be returned in API responses (only metadata)
- Proxy engine should be in `repos/backend`, not `repos/proxy`
- Consider using `http-proxy-middleware` for base proxy functionality
- Body transformations should support both JSON and form-encoded data
