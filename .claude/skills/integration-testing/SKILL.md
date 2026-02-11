# Integration Testing Skill

Validate admin UI ↔ backend API integration using API keys and Playwright MCP.

## Prerequisites

Services must be running before testing:

```bash
# Verify all services
curl -sf http://localhost:5885/_/health  # Backend
curl -sf http://localhost:7118/health    # Proxy
curl -sf http://localhost:5887           # Admin UI
```

If any fail: `tdsk dev start --clean` for K8s services, `cd repos/admin && pnpm start` for admin.

## Authentication

API key auth bypasses social login for automated testing. The proxy accepts `Authorization: Bearer tdsk_*` tokens.

### Create a Test API Key

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 00000000-0000-0000-0000-000000000000" \
  -H "tdsk-backend: loca1-thre4ded-5tack" \
  http://localhost:5885/_/orgs/<ORG_ID>/api-keys \
  -d '{"name":"integration-test","scopes":"admin"}'
```

Save the returned `key` value (starts with `tdsk_`). It's only shown once.

### Use the API Key

**curl (through proxy)**:
```bash
curl -s -H "Authorization: Bearer tdsk_<KEY>" http://localhost:7118/_/orgs
```

**curl (direct to backend)** — bypasses proxy auth, useful for isolated backend testing:
```bash
curl -s -H "X-User-Id: 00000000-0000-0000-0000-000000000000" \
  -H "tdsk-backend: loca1-thre4ded-5tack" \
  http://localhost:5885/_/orgs
```

## Tier 1 — API Contract Validation

Validate backend responses match what the admin UI expects.

### Contract Reference

| Admin Service | Method | Proxy Path | Response Shape |
|--------------|--------|------------|----------------|
| orgsApi.list | GET | `/_/orgs` | `{ data: Org[], limit, offset }` |
| orgsApi.get | GET | `/_/orgs/:id` | `{ data: Org }` |
| orgsApi.create | POST | `/_/orgs` | `{ data: Org }` |
| orgsApi.update | PUT | `/_/orgs/:id` | `{ data: Org }` |
| orgsApi.delete | DELETE | `/_/orgs/:id` | `{ data: { success, id } }` |
| projectsApi.list | GET | `/_/orgs/:orgId/projects` | `{ data: Project[], limit, offset }` |
| secretsApi.list | GET | `/_/orgs/:orgId/secrets` | `{ data: Secret[], limit, offset }` |
| providersApi.list | GET | `/_/orgs/:orgId/providers` | `{ data: Provider[], limit, offset }` |
| apiKeysApi.list | GET | `/_/orgs/:orgId/api-keys` | `{ data: ApiKey[], limit, offset }` |
| apiKeysApi.create | POST | `/_/orgs/:orgId/api-keys` | `{ data: ApiKey, warning }` |
| endpointsApi.list | GET | `/_/orgs/:orgId/projects/:pId/endpoints` | `{ data: Endpoint[], limit, offset }` |
| subscriptionsApi.current | GET | `/_/subscriptions/current` | `{ data: Subscription }` |
| subscriptionsApi.plans | GET | `/_/subscriptions/plans` | `{ data: Plan[] }` |
| quotasApi.get | GET | `/_/orgs/:orgId/quotas` | `{ data: TQuotaData }` |
| quickstartApi.create | POST | `/_/orgs/:orgId/quickstart` | `{ data: { provider, secret, project, agent, endpoint } }` |

### Validation Procedure

For each endpoint, verify:
1. **Status code** — 200 for success, appropriate 4xx/5xx for errors
2. **Response shape** — `data` field present, correct type (array vs object)
3. **Pagination** — list endpoints return `limit` and `offset` fields
4. **Field names** — match admin API service expectations exactly

Example validation:
```bash
# Validate orgs list contract
RESP=$(curl -s -H "Authorization: Bearer tdsk_<KEY>" http://localhost:7118/_/orgs)
# Check: has .data (array), .limit (number), .offset (number)
echo "$RESP" | jq '{has_data: (.data | type == "array"), has_limit: (.limit != null), has_offset: (.offset != null)}'
```

## Tier 2 — UI Render Validation (Playwright MCP)

Use Playwright MCP tools to verify admin pages render correctly.

### Browser Auth Injection (VALIDATED)

The admin app calls `@neondatabase/neon-js` `getSession()` on load, which makes HTTP requests to `neonauth.c-2.us-east-1.aws.neon.tech/neondb/auth/get-session`. If no session exists, the app redirects to `/auth/sign-in`. To bypass this:

**Mock the Neon Auth session response** via Playwright route interception. Set the API key as the session `token` — the admin app will then use `Authorization: Bearer tdsk_...` for all API calls automatically.

```javascript
// browser_run_code — set up BEFORE navigating to admin app
async (page) => {
  // 1. Intercept Neon Auth get-session → return mock session with API key as token
  await page.route('**/neondb/auth/get-session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session: {
          id: 'playwright-test-session',
          token: 'tdsk_<KEY>',  // API key becomes the Bearer token
          userId: '00000000-0000-0000-0000-000000000000',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'playwright@test.local',
          name: 'Playwright Test User',
        },
      }),
    });
  });

  // 2. Catch any other neonauth requests
  await page.route('**/neonauth**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // 3. Navigate — app now thinks user is logged in
  await page.goto('http://localhost:5887', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
}
```

**Why this works**: The Neon Auth SDK wraps the HTTP response in `{ data: <body> }`. By returning `{ session, user }` directly, the SDK produces `{ data: { session, user } }` — exactly what `initAuth()` expects. The `session.token` is set as `Authorization: Bearer <token>` for all subsequent API calls, and since it's a `tdsk_` token, the proxy validates it as an API key.

**Important**: Set up route interception BEFORE `page.goto()`. Navigation triggers the auth check immediately on page load.

### Page Validation Checklist

For each admin page:
1. `browser_navigate` → target page URL
2. `browser_snapshot` → verify page structure loads (not blank/error)
3. `browser_console_messages` → check for JS errors
4. `browser_network_requests` → verify API calls succeed (no 4xx/5xx)
5. `browser_take_screenshot` → visual verification

### Admin Page URLs

| Page | URL | Key API Calls |
|------|-----|---------------|
| Home | `http://localhost:5887/` | None (static) |
| Organizations | `http://localhost:5887/orgs` | GET /orgs |
| Org Detail | `http://localhost:5887/orgs/:orgId` | GET /orgs/:id |
| Projects | `http://localhost:5887/orgs/:orgId/projects` | GET /projects |
| API Keys | `http://localhost:5887/orgs/:orgId/api-keys` | GET /api-keys |
| Secrets | `http://localhost:5887/orgs/:orgId/secrets` | GET /secrets |
| Providers | `http://localhost:5887/orgs/:orgId/providers` | GET /providers |
| Billing | `http://localhost:5887/billing` | GET /subscriptions/current, /plans |

## Tier 3 — Full E2E User Flows

Test complete workflows:

### Flow: Create Organization
```
1. browser_navigate → /orgs
2. browser_click → "Create Org" button
3. browser_fill_form → name, description
4. browser_click → submit
5. browser_network_requests → verify POST /orgs succeeded
6. browser_snapshot → verify new org appears in list
```

### Flow: Create Project
```
1. browser_navigate → /orgs/:orgId/projects
2. browser_click → "Create Project" button
3. browser_fill_form → name, gitUrl, branch
4. browser_click → submit
5. browser_network_requests → verify POST /projects succeeded
```

### Flow: Create API Key
```
1. browser_navigate → /orgs/:orgId/api-keys
2. browser_click → "Create Key" button
3. browser_fill_form → name, scopes
4. browser_click → submit
5. browser_network_requests → verify POST /api-keys succeeded
6. browser_snapshot → verify key shown with warning
```

## Debugging

### Check Service Logs
```bash
tdsk dev log --context backend --follow    # Backend logs
tdsk dev log --context proxy --follow      # Proxy logs
```

### Correlate Failures
1. `browser_network_requests` → find failed request (URL, status, body)
2. Check proxy logs → did the request reach the proxy? Auth error?
3. Check backend logs → did the request reach the backend? What error?
4. `browser_console_messages(level: "error")` → JS errors in admin

### Common Issues
- **401 from proxy** → API key invalid/expired/revoked, or missing `Authorization` header
- **401 from backend** → Missing `X-User-Id` header (proxy should set this from API key)
- **404 from backend** → Path mismatch between admin service and backend endpoint
- **500 from backend** → Check backend logs for stack trace
- **CORS error in browser** → Request going to wrong origin; check apiUrl configuration
- **Empty response in admin** → Response shape mismatch (admin expects `.data` but backend returns differently)

## Test Data

### Known Test Entities (Local Dev)
- **User ID**: `00000000-0000-0000-0000-000000000000`
- **Org ID**: `22f40206-fd94-4da9-9e6e-b3e860798e0a` (name: "TDSK")
- **Backend header**: `tdsk-backend: loca1-thre4ded-5tack`
- **Proxy URL**: `http://localhost:7118`
- **Backend URL**: `http://localhost:5885`
- **Admin URL**: `http://localhost:5887`
- **Caddy proxy host**: `https://px.local.threadedstack.app`

## Architecture Reference

```
Admin (localhost:5887) → Caddy (443) → Proxy (7118) → Backend (5885) → Neon PostgreSQL
                                          ↓
                                   JWT or API Key auth
                                   Sets X-User-* headers
```

### API Key Auth Flow
```
1. Client sends: Authorization: Bearer tdsk_<KEY>
2. Proxy setupAuth: detects tdsk_ prefix → calls next() (skips JWT)
3. Proxy setupApiKeyAuth: hashes key → looks up in DB → validates active/not expired
4. Sets req.user = { userId: key.userId, role: scopeToRole(key.scopes) }
5. Proxy forwards to backend with X-User-Id, X-User-Email, X-User-Role headers
6. Backend processes request using X-User-* headers
```
