# Epic 2: Backend Proxy Feature - Task Tracking

**Goal:** Implement a production-ready Reverse Proxy with Secret Injection, Body Transformation, and Machine-to-Machine Authentication.

## Task Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## Pre-Epic 2 Analysis (from Epic-1)

### What's Already Implemented:
- **Database schemas** for secrets and endpoints (complete)
- **Database services** for secrets and endpoints (base CRUD complete)
- **Crypto utilities** in domain repo (AES-256-GCM encryption complete)
- **Admin UI components** for secrets and endpoints (complete, but awaiting backend API)
- **Admin API services** calling `/secrets` and `/endpoints` (complete)
- **Admin actions** for CRUD operations (complete)

### Critical Gap Identified:
The Admin UI is fully implemented and calling `/secrets` and `/endpoints` backend APIs, but **these backend endpoints do not exist yet**. This is the primary blocker.

---

## 1. Backend API & Data

### 1.1 Secrets Management API
- [x] **TASK-1.1.1**: Create secrets endpoint file at `repos/backend/src/endpoints/secrets/secrets.ts`
- [x] **TASK-1.1.2**: Implement `POST /_/secrets` - Create secret (encrypt value before storage)
- [x] **TASK-1.1.3**: Implement `GET /_/secrets` - List secrets (metadata only, no values)
- [x] **TASK-1.1.4**: Implement `GET /_/secrets/:id` - Get secret metadata by ID
- [x] **TASK-1.1.5**: Implement `PUT /_/secrets/:id` - Update secret
- [x] **TASK-1.1.6**: Implement `DELETE /_/secrets/:id` - Delete secret
- [x] **TASK-1.1.7**: Implement encryption utility for secret values - **EXISTS**: `repos/domain/src/utils/crypto.ts`
- [x] **TASK-1.1.8**: Implement decryption utility for secret values - **EXISTS**: `repos/domain/src/utils/crypto.ts`
- [x] **TASK-1.1.9**: Associate secrets with Orgs (org_id foreign key) - **EXISTS**: Schema has `orgId` field
- [x] **TASK-1.1.10**: Associate secrets with Projects (project_id foreign key - exclusive arc) - **EXISTS**: Schema has `projectId` with check constraint
- [x] **TASK-1.1.11**: Register secrets endpoints in backend router (`repos/backend/src/endpoints/accounts.ts`)

### 1.2 Endpoint Management API
- [x] **TASK-1.2.1**: Create endpoints endpoint file at `repos/backend/src/endpoints/endpoints/endpoints.ts`
- [x] **TASK-1.2.2**: Implement `POST /_/endpoints` - Create proxy endpoint definition
- [x] **TASK-1.2.3**: Implement `GET /_/endpoints` - List endpoints
- [x] **TASK-1.2.4**: Implement `GET /_/endpoints/:id` - Get endpoint by ID
- [x] **TASK-1.2.5**: Implement `PUT /_/endpoints/:id` - Update endpoint
- [x] **TASK-1.2.6**: Implement `DELETE /_/endpoints/:id` - Delete endpoint
- [x] **TASK-1.2.7**: Define schema for `proxy_url` field - **EXISTS**: `url` field in schema
- [x] **TASK-1.2.8**: Define schema for `proxy_headers` field - **EXISTS**: `headers` jsonb field in schema
- [x] **TASK-1.2.9**: Define schema for `proxy_options` (regex/replacements) - **EXISTS**: `options` jsonb field in schema
- [ ] **TASK-1.2.10**: Implement endpoint-to-secrets association (link table or reference)
- [x] **TASK-1.2.11**: Register endpoints endpoints in backend router (`repos/backend/src/endpoints/accounts.ts`)

---

## 2. Proxy Engine Logic (`/proxy/*`)

### 2.1 Request Matching
- [x] **TASK-2.1.1**: Create proxy engine router at `repos/backend/src/middleware/proxyEngine.ts`
- [x] **TASK-2.1.2**: Implement path-based endpoint lookup from database
- [x] **TASK-2.1.3**: Implement regex-based path matching for flexible routing
- [x] **TASK-2.1.4**: Handle endpoint not found (404) responses

### 2.2 Secret Decryption
- [x] **TASK-2.2.1**: Implement secret fetching for matched endpoint (`secretResolver.ts`)
- [x] **TASK-2.2.2**: Implement runtime decryption of secret values (use `decryptValue` from domain)
- [x] **TASK-2.2.3**: Cache decrypted secrets with TTL for performance (5 min TTL)
- [x] **TASK-2.2.4**: Implement secret reference resolution in headers (e.g., `{{SECRET_NAME}}`)

### 2.3 Header Injection
- [x] **TASK-2.3.1**: Implement header merger utility at `repos/backend/src/utils/proxy/headerMerger.ts`
- [x] **TASK-2.3.2**: Inject Authorization headers from secrets (Bearer, Basic, API Key support)
- [x] **TASK-2.3.3**: Inject custom headers defined in endpoint config
- [x] **TASK-2.3.4**: Support dynamic header values from request context (X-Request-ID, X-Forwarded-For)
- [x] **TASK-2.3.5**: Implement header sanitization (remove sensitive client headers)

### 2.4 Body Transformation
- [x] **TASK-2.4.1**: Create body transformer utility at `repos/backend/src/utils/proxy/bodyTransformer.ts`
- [x] **TASK-2.4.2**: Implement regex-based find/replace on request body
- [x] **TASK-2.4.3**: Implement JSON path-based value replacement
- [x] **TASK-2.4.4**: Implement secret injection into request body
- [x] **TASK-2.4.5**: Support multiple transformation rules in sequence

### 2.5 Request Execution & Streaming
- [x] **TASK-2.5.1**: Implement HTTP client for outbound requests (native fetch)
- [x] **TASK-2.5.2**: Stream request body to target URL
- [x] **TASK-2.5.3**: Stream response body back to client
- [x] **TASK-2.5.4**: Handle connection timeouts gracefully (configurable timeout)
- [x] **TASK-2.5.5**: Implement retry logic with exponential backoff (configurable retries)
- [x] **TASK-2.5.6**: Pass through response headers (with filtering)
- [x] **TASK-2.5.7**: Implement request/response logging for debugging

---

## 3. Security & Auth Layer

### 3.1 OAuth Client Credentials
- [x] **TASK-3.1.1**: Create OAuth config schema for endpoints (add to endpoint options) - Added to TEndpointData.options.oauth
- [x] **TASK-3.1.2**: Implement client credentials token fetch - `repos/backend/src/utils/proxy/oauthClient.ts`
- [x] **TASK-3.1.3**: Implement token caching with expiry tracking - Token cache with automatic cleanup
- [x] **TASK-3.1.4**: Implement automatic token refresh before expiry - 1 minute refresh buffer
- [x] **TASK-3.1.5**: Support multiple OAuth providers per endpoint - Each endpoint can have its own OAuth config

### 3.2 API Key Authentication
- [x] **TASK-3.2.1**: Create API key schema at `repos/database/src/schemas/apiKeys.ts`
- [x] **TASK-3.2.2**: Create API key service at `repos/database/src/services/apiKey.ts`
- [x] **TASK-3.2.3**: Create API key model at `repos/domain/src/models/apiKey.ts`
- [x] **TASK-3.2.4**: Create backend endpoints at `repos/backend/src/endpoints/apiKeys/apiKeys.ts`
- [x] **TASK-3.2.5**: Implement `POST /_/api-keys` - Generate API key
- [x] **TASK-3.2.6**: Implement `GET /_/api-keys` - List API keys (masked)
- [x] **TASK-3.2.7**: Implement `DELETE /_/api-keys/:id` - Revoke API key
- [x] **TASK-3.2.8**: Implement API key validation middleware
- [x] **TASK-3.2.9**: Support API key scopes (read, write, admin)
- [x] **TASK-3.2.10**: Implement rate limiting per API key

### 3.3 Domain Whitelisting
- [x] **TASK-3.3.1**: Add domain whitelist field to endpoint schema (or separate table) - Added to endpoint options.domainWhitelist
- [x] **TASK-3.3.2**: Implement domain whitelist management in endpoint API - Stored in endpoint options jsonb
- [x] **TASK-3.3.3**: Implement pre-request domain validation in proxy engine - `validateRequestDomain()` in proxyEngineMiddleware
- [x] **TASK-3.3.4**: Support wildcard domain patterns (e.g., `*.example.com`) - `patternToRegex()` in domainValidator.ts
- [x] **TASK-3.3.5**: Log blocked domain attempts for security auditing - Logging in domainValidator with logBlocked option

---

## 4. Frontend / Admin UI

### 4.1 Secrets Manager UI
- [x] **TASK-4.1.1**: Create Secrets page - **EXISTS**: `repos/admin/src/pages/Orgs/OrgSecrets.tsx`
- [x] **TASK-4.1.2**: Implement secrets list table - **EXISTS**: Using DataTable component
- [x] **TASK-4.1.3**: Implement secret creation form/modal - **EXISTS**: `CreateSecretDialog.tsx`
- [x] **TASK-4.1.4**: Implement secret edit form - **EXISTS**: `EditSecretDialog.tsx`
- [x] **TASK-4.1.5**: Implement secret deletion with confirmation - **EXISTS**: In OrgSecrets.tsx
- [x] **TASK-4.1.6**: Add secrets section to Org detail page - **EXISTS**: OrgSecrets.tsx
- [x] **TASK-4.1.7**: Add secrets section to Projects detail page - **EXISTS**: `ProjectSecrets.tsx`
- [x] **TASK-4.1.8**: Create Secrets API service in admin - **EXISTS**: `repos/admin/src/services/secretsApi.ts`
- [ ] **TASK-4.1.9**: Add secret reference picker to endpoint forms (dropdown of available secrets)

### 4.2 Endpoint Builder UI
- [x] **TASK-4.2.1**: Create Endpoints list page - **EXISTS**: `repos/admin/src/pages/Projects/ProjectEndpoints.tsx`
- [x] **TASK-4.2.2**: Implement endpoint list table - **EXISTS**: Using MUI Table
- [x] **TASK-4.2.3**: Create endpoint builder form component - **EXISTS**: `CreateEndpointDialog.tsx`
- [x] **TASK-4.2.4**: Implement target URL input - **EXISTS**: In CreateEndpointDialog
- [ ] **TASK-4.2.5**: Implement headers configuration UI (key-value pairs with secret refs)
- [ ] **TASK-4.2.6**: Implement proxy_options configuration (regex rules UI)
- [ ] **TASK-4.2.7**: Implement endpoint testing tool (send test request)
- [x] **TASK-4.2.8**: Create Endpoints API service in admin - **EXISTS**: `repos/admin/src/services/endpointsApi.ts`
- [x] **TASK-4.2.9**: Endpoint routes exist in admin router - **EXISTS**: Routes to ProjectEndpoints

### 4.3 API Keys UI
- [x] **TASK-4.3.1**: Create API Keys page at `repos/admin/src/pages/Orgs/OrgApiKeys.tsx`
- [x] **TASK-4.3.2**: Implement API key generation UI with copy-to-clipboard - `CreateApiKeyDialog.tsx`
- [x] **TASK-4.3.3**: Display generated key once (masked after) - Key shown once in dialog with warning
- [x] **TASK-4.3.4**: Implement API key list with revoke option - DataTable with revoke confirmation
- [x] **TASK-4.3.5**: Implement API key scope selection - Checkbox selection for read/write/admin
- [x] **TASK-4.3.6**: Create API Keys API service in admin - `apiKeysApi.ts`, state atoms, actions
- [ ] **TASK-4.3.7**: Add API Keys to navigation (Settings or Org page) - Route integration pending

---

## 5. Testing

### 5.1 Backend API Tests
- [x] **TASK-5.1.1**: Write tests for secrets API endpoints (`repos/backend/src/endpoints/secrets/secrets.test.ts`)
- [x] **TASK-5.1.2**: Write tests for endpoints API endpoints (`repos/backend/src/endpoints/endpoints/endpoints.test.ts`)
- [x] **TASK-5.1.3**: Write tests for API keys API endpoints (`repos/backend/src/endpoints/apiKeys/apiKeys.test.ts`)

### 5.2 Proxy Engine Tests
- [x] **TASK-5.2.1**: Write tests for endpoint matching logic (`proxyEngine.test.ts`)
- [x] **TASK-5.2.2**: Write tests for header injection (`headerMerger.test.ts`)
- [x] **TASK-5.2.3**: Write tests for body transformation (`bodyTransformer.test.ts`)
- [x] **TASK-5.2.4**: Write tests for secret decryption in proxy context (`secretResolver.test.ts`)

### 5.3 Integration Tests
- [ ] **TASK-5.3.1**: Write integration test: Create endpoint → Create secret → Proxy request
- [ ] **TASK-5.3.2**: Write integration test: API key authentication flow
- [ ] **TASK-5.3.3**: Write integration test: OAuth client credentials flow

---

## Deliverables Checklist

- [x] User can create an Endpoint via the Admin UI - ProjectEndpoints.tsx + CreateEndpointDialog.tsx
- [x] User can create and attach a Secret to an Endpoint - OrgSecrets.tsx + header injection via `{{SECRET_NAME}}`
- [x] User can generate an API Key for M2M authentication - OrgApiKeys.tsx + CreateApiKeyDialog.tsx
- [x] Proxy validates API Key or OAuth credentials - apiKeyAuth.ts middleware, oauthClient.ts
- [x] Proxy successfully injects headers from secrets - headerMerger.ts + secretResolver.ts
- [x] Proxy performs body transformations when configured - bodyTransformer.ts
- [x] Proxy streams response from target URL back to client - proxyEngine.ts using Readable.fromWeb
- [x] All new endpoints have test coverage - 258 backend tests pass

---

## Dependencies

- **Epic 1**: Base Setup must be completed (Auth, Users, Orgs, basic UI) ✅

## Technical Notes

### Encryption (Already Implemented)
- `repos/domain/src/utils/crypto.ts` provides:
  - `deriveKey(ref_id)` - Derives encryption key from MASTER_KEY using HKDF
  - `encryptValue(derivedKey, plaintext)` - AES-256-GCM encryption
  - `decryptValue(derivedKey, ciphertext, iv, authTag)` - AES-256-GCM decryption
- Secrets are encrypted with derived keys (one key per org/project)
- `TDSK_MASTER_KEY` env variable required (hex format)

### Database Schema (Already Implemented)
- `secrets` table: id, name, hashKey, encryptedValue, orgId, projectId, providerId
- `endpoints` table: id, name, url, headers (jsonb), options (jsonb), method, public, projectId
- Exclusive arc pattern: secrets belong to EITHER org OR project (not both)

### Admin UI (Already Implemented)
- Full CRUD UI for secrets and endpoints exists
- API services call `/_/secrets` and `/_/endpoints` (need backend implementation)
- State management via Jotai atoms

### Recommended Implementation Order
1. **Phase 1 - Backend APIs (Critical Blocker)**:
   - Implement secrets API endpoints (1.1.1-1.1.6, 1.1.11)
   - Implement endpoints API endpoints (1.2.1-1.2.6, 1.2.11)
   - This unblocks the existing Admin UI

2. **Phase 2 - Proxy Engine Core**:
   - Implement proxy engine router (2.1.x)
   - Implement secret decryption in proxy (2.2.x)
   - Implement header injection (2.3.x)
   - Implement request streaming (2.5.x)

3. **Phase 3 - Body Transformation**:
   - Implement body transformer (2.4.x)

4. **Phase 4 - Security Layer**:
   - API Keys (3.2.x) - Higher priority for M2M auth
   - OAuth Client Credentials (3.1.x)
   - Domain Whitelisting (3.3.x)

5. **Phase 5 - Enhanced UI**:
   - API Keys UI (4.3.x)
   - Advanced endpoint config (headers/options UI)
   - Endpoint testing tool

---

## File Structure Reference

### Backend (to be created)
```
repos/backend/src/
├── endpoints/
│   ├── secrets/
│   │   ├── secrets.ts      # CRUD endpoints
│   │   └── index.ts
│   ├── endpoints/
│   │   ├── endpoints.ts    # CRUD endpoints (rename from proxyEndpoints)
│   │   └── index.ts
│   └── apiKeys/
│       ├── apiKeys.ts      # CRUD endpoints
│       └── index.ts
├── middleware/
│   └── proxyEngine.ts      # Main proxy logic
└── utils/
    └── proxy/
        ├── headerMerger.ts
        ├── bodyTransformer.ts
        └── secretResolver.ts
```

### Database (to be created)
```
repos/database/src/
├── schemas/
│   └── apiKeys.ts          # New schema
└── services/
    └── apiKey.ts           # New service
```

### Domain (to be created)
```
repos/domain/src/
└── models/
    └── apiKey.ts           # New model
```
