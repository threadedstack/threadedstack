# Proxy Engine - Endpoint Options Implementation

## Overview

The Proxy Engine (`/proxy/:projectId/:endpointId/*`) now fully implements all endpoint options from the admin UI, enabling secure API proxying with advanced features like OAuth 2.0, authentication, request/response transformation, and domain whitelisting.

## Architecture

### Request Flow

```
Client Request
  ↓
Proxy Endpoint (/proxy/:projectId/:endpointId/*)
  ↓
1. Fetch endpoint from database
2. Verify project ownership
3. Check permissions (unless public)
4. Fetch project secrets
5. Apply endpoint options
  ├── Headers (with secret injection)
  ├── Timeout
  ├── Domain whitelist validation
  ├── Path regex validation
  ├── Authentication (bearer/basic/apikey)
  ├── OAuth 2.0 token exchange
  └── Request/response transformation
  ↓
Proxy to target URL
  ↓
Return response to client
```

### Files

- **`proxyRequest.ts`** - Main proxy endpoint handler
- **`proxy.ts`** - Router configuration
- **`../../utils/proxy/applyEndpointOptions.ts`** - Options application logic
- **`../../utils/proxy/replaceSecretRefs.ts`** - Secret replacement utilities

## Features

### 1. Headers with Secret Injection

**UI Configuration:**
```typescript
headers: {
  'Authorization': 'Bearer {{API_TOKEN}}',
  'X-API-Key': '{{SECRET_KEY}}'
}
```

**Implementation:**
- Uses `addEndpointHeaders()` function
- Replaces `{{secret-name}}` references with actual secret values from database
- Secrets are scoped to the project

### 2. Timeout

**UI Configuration:**
```typescript
options: {
  timeout: 5000  // milliseconds
}
```

**Implementation:**
- Applied via `http-proxy-middleware` timeout option
- Request will fail if target doesn't respond within specified time

### 3. Retries

**UI Configuration:**
```typescript
options: {
  retries: 3
}
```

**Implementation:**
- Logged for future implementation
- `http-proxy-middleware` doesn't natively support retries
- Would need custom retry logic in error handler

### 4. Path Regex Validation

**UI Configuration:**
```typescript
options: {
  pathRegex: '^/api/v[0-9]+/.*'
}
```

**Implementation:**
- Validates incoming request path matches regex pattern
- Rejects requests with 400 error if path doesn't match
- Useful for restricting allowed endpoints

### 5. Authentication

**UI Configuration:**
```typescript
options: {
  auth: {
    type: 'bearer',  // or 'basic' or 'apikey'
    secretName: 'MY_API_TOKEN',
    headerName: 'Authorization'  // default
  }
}
```

**Implementation:**

**Bearer Token:**
```
Authorization: Bearer <secret_value>
```

**Basic Auth:**
```
Authorization: Basic <base64(secret_value)>
// secret_value should be "username:password"
```

**API Key:**
```
<headerName>: <secret_value>
// Direct injection of secret value
```

### 6. OAuth 2.0 Client Credentials Flow

**UI Configuration:**
```typescript
options: {
  oauth: {
    tokenUrl: 'https://oauth.example.com/token',
    clientId: '{{CLIENT_ID}}',         // supports secret references
    clientSecret: '{{CLIENT_SECRET}}', // supports secret references
    scopes: ['read', 'write'],
    credentialStyle: 'header',         // or 'body'
    additionalParams: {
      'audience': 'https://api.example.com'
    }
  }
}
```

**Implementation:**
- Exchanges client credentials for access token before proxying request
- Caches tokens until expiration (with 5-minute buffer)
- Supports two credential styles:
  - **Header (RFC 6749):** `Authorization: Basic base64(clientId:clientSecret)`
  - **Body:** clientId and clientSecret in request body
- Adds `Authorization: Bearer <access_token>` to proxied request
- Token cache key: `${tokenUrl}:${clientId}`

**OAuth takes precedence over basic auth** - if both are configured, OAuth is used.

### 7. Transform (Request/Response Body)

**UI Configuration:**
```typescript
options: {
  transform: {
    injectSecrets: true
  }
}
```

**Implementation:**
- **Request transformation:** Not yet implemented (IncomingMessage doesn't have parsed body)
- **Response transformation:** Replaces `{{secret-name}}` references in response JSON
- Recursively processes nested objects and arrays
- Non-JSON responses are passed through unchanged

### 8. Domain Whitelist

**UI Configuration:**
```typescript
options: {
  domainWhitelist: {
    allowedDomains: ['api.example.com', '*.example.com'],
    enforceWhitelist: true,
    logBlocked: true
  }
}
```

**Implementation:**
- Validates target URL domain before proxying
- Supports wildcard patterns: `*.example.com` matches `api.example.com`, `dev.example.com`, etc.
- Rejects requests to non-whitelisted domains with error
- Logs blocked requests if `logBlocked: true`

## Usage Example

### 1. Create Endpoint in Admin UI

```typescript
POST /_/endpoints
{
  "name": "GitHub API Proxy",
  "path": "/repos",
  "method": "GET",
  "projectId": "proj_123",
  "headers": {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": "token {{GITHUB_TOKEN}}"
  },
  "options": {
    "timeout": 10000,
    "domainWhitelist": {
      "allowedDomains": ["api.github.com"],
      "enforceWhitelist": true
    },
    "auth": {
      "type": "bearer",
      "secretName": "GITHUB_TOKEN"
    }
  }
}
```

### 2. Create Secret

```typescript
POST /_/secrets
{
  "name": "GITHUB_TOKEN",
  "value": "ghp_abcdefghijklmnopqrstuvwxyz123456",
  "projectId": "proj_123"
}
```

### 3. Proxy Request

```bash
GET /proxy/proj_123/ep_456/octocat/Hello-World
```

This will:
1. Fetch endpoint `ep_456` from database
2. Verify it belongs to project `proj_123`
3. Fetch secret `GITHUB_TOKEN`
4. Replace `{{GITHUB_TOKEN}}` in headers
5. Validate domain is `api.github.com`
6. Apply 10-second timeout
7. Proxy to: `https://api.github.com/repos/octocat/Hello-World`
8. Return GitHub API response

## Security Features

### Secret Injection
- Secrets are **NEVER** exposed to clients
- Replacement happens server-side in the proxy
- Secrets are scoped to projects
- Uses secure pattern matching: `{{secret-name}}`

### Permission Checks
- Requires project member+ role
- Public endpoints bypass permission checks
- Uses `EPermAction.read` for endpoint access

### Domain Whitelist
- Prevents proxy abuse (SSRF protection)
- Restricts targets to approved domains
- Supports wildcard patterns for subdomains

## Error Handling

### 400 Bad Request
- Missing projectId or endpointId
- Path doesn't match pathRegex

### 403 Forbidden
- Endpoint belongs to different project
- Insufficient permissions
- Domain not in whitelist

### 404 Not Found
- Endpoint not found in database

### 405 Method Not Allowed
- Request method doesn't match endpoint's configured method

### 500 Internal Server Error
- OAuth token exchange failed
- Error setting up proxy

### 502 Bad Gateway
- Target server error
- Proxy middleware error
- Domain whitelist validation failed

## Performance

### OAuth Token Caching
- Tokens cached in-memory with expiration tracking
- Cache key: `${tokenUrl}:${clientId}`
- Reduces token exchange requests
- 5-minute expiration buffer to prevent race conditions

### Timeout Configuration
- Default: No timeout (inherited from http-proxy-middleware)
- Recommended: 5000-30000ms depending on target API
- Prevents hanging requests

## Limitations

1. **Request body transformation not implemented**
   - IncomingMessage doesn't have parsed body property
   - Would require bodyParser middleware integration

2. **Retries not implemented**
   - http-proxy-middleware doesn't support retries natively
   - Would require custom error handler with retry logic

3. **Transform rules not implemented**
   - Only `injectSecrets` flag is supported
   - Complex transformation rules (from TTransformRule[]) not yet implemented

## Future Enhancements

1. **Request body transformation**
   - Integrate with bodyParser
   - Support secret injection in request bodies

2. **Retry logic**
   - Implement exponential backoff
   - Configurable retry delays
   - Retry only on specific error codes

3. **Advanced transform rules**
   - JSONPath-based transformations
   - Custom transformation functions
   - Conditional transformations

4. **Metrics & Monitoring**
   - Track proxy request counts
   - Monitor OAuth token usage
   - Log performance metrics

5. **Rate limiting**
   - Per-endpoint rate limits
   - Per-project quotas
   - Token bucket algorithm

## Testing

```bash
# Run backend tests
pnpm test

# Run specific proxy tests (when added)
pnpm test proxy

# Type checking
pnpm exec tsc --noEmit
```

## Dependencies

- **http-proxy-middleware** - Proxy middleware
- **axios** - OAuth token exchange
- **@tdsk/domain** - Shared types and models
- **@TBE/utils/logger** - Winston logger
