# Endpoint Test Panel Design

**Date**: 2026-02-23
**Tasks**: [P3] Add Test button to Proxy Endpoints, [P3] Add Test button to Function Endpoints
**Status**: Approved

## Overview

Add a full request builder and response viewer to the EndpointDrawer, allowing users to test Proxy and FaaS endpoints directly from the admin UI. Both endpoint types share the same backend route (`ANY /proxy/:projectId/:endpointId`), so a single implementation covers both.

## Architecture

Follows the existing Component → Action → Service pattern:

```
EndpointDrawer (tabs: Configure | Test)
  └── EndpointTestPanel (request builder + response display)
        └── calls testEndpoint action
              └── calls endpointTestApi.execute()
                     └── fetch to /proxy/:projectId/:endpointId
```

## New Files

| File | Layer | Purpose |
|------|-------|---------|
| `services/endpointTestApi.ts` | Service | `EndpointTestApi` extends `BaseApi` with `path: ''` (no `/_/` prefix) |
| `actions/endpoints/api/testEndpoint.ts` | Action | Thin orchestrator — calls service, returns result |
| `hooks/endpoints/useEndpointTest.ts` | Hook | Request builder state, response state, actions |
| `components/Endpoints/EndpointTestPanel.tsx` | UI | Full request builder + response display |

## Modified Files

| File | Change |
|------|--------|
| `components/Endpoints/EndpointDrawer.tsx` | Add Configure/Test tab switching |
| `services/index.ts` | Export `endpointTestApi` singleton |
| `actions/endpoints/api/index.ts` | Export `testEndpoint` action |

## Component Design

### EndpointDrawer Tab Integration

- Two MUI Tabs: "Configure" (existing form) and "Test" (new panel)
- "Test" tab only visible in edit mode (endpoint has an ID)
- DrawerActions (Save/Cancel/Delete) only show on Configure tab
- Tab state is local to the drawer

### EndpointTestPanel Layout

```
┌─ Test Endpoint ───────────────────────────────┐
│ Method: [GET ▼]                                │
│                                                │
│ Headers:                                       │
│ ┌──────────────┬──────────────────┬───┐        │
│ │ Content-Type │ application/json │ ✕ │        │
│ └──────────────┴──────────────────┴───┘        │
│ [+ Add Header]                                 │
│                                                │
│ Body: (hidden for GET/HEAD)                    │
│ ┌──────────────────────────────────────┐       │
│ │ Monaco editor (json mode)            │       │
│ └──────────────────────────────────────┘       │
│                                                │
│ [▶ Send Request]  [Clear]                      │
│                                                │
│ ── Response ──────────────────────────         │
│ ● 200 OK  •  142ms                             │
│ ┌──────────────────────────────────────┐       │
│ │ Monaco (read-only, auto-detect lang) │       │
│ └──────────────────────────────────────┘       │
└────────────────────────────────────────────────┘
```

### Behaviors

- **Method selector**: MUI Select with GET/POST/PUT/PATCH/DELETE
- **Headers**: Key-value rows with add/remove. Default: `Content-Type: application/json`
- **Body editor**: Monaco (json) via existing Code wrapper. Hidden for GET/HEAD
- **Send button**: Disabled while loading, shows spinner
- **Response status**: Color-coded chip (green 2xx, orange 3xx, red 4xx/5xx) + timing in ms
- **Response body**: Read-only Monaco, language auto-detected from Content-Type
- **Error state**: Network errors show Alert component instead of response

## Service Design

### EndpointTestApi

```typescript
class EndpointTestApi extends BaseApi {
  constructor() {
    super()
    this.api = new ApiService({ path: '' })  // No /_/ prefix
  }

  async execute(projectId, endpointId, { method, headers, body })
    // → fetch /proxy/{projectId}/{endpointId}
    // → returns { data: { status, statusText, body, contentType, timing }, error? }
}
```

### testEndpoint Action

Thin wrapper — calls `endpointTestApi.execute()` and returns result. No Jotai state updates (test results are ephemeral). Future-proofs for test history if needed.

### useEndpointTest Hook

Manages:
- Request state: method, headers (KV array), body string
- UI state: loading, error
- Response state: `{ status, statusText, body, contentType, timing } | null`
- Actions: `sendRequest()`, `clearResponse()`, `addHeader()`, `removeHeader()`, `reset()`
- Computed: `monacoLanguage` derived from `contentType`

## Testing Strategy

### Unit Tests
- `useEndpointTest.test.ts` — State management, language detection, header manipulation
- `EndpointTestPanel.test.ts` — Rendering, tab switching, button states
- `endpointTestApi.test.ts` — URL construction, method forwarding, timing
- `testEndpoint.test.ts` — Action delegates to service

### Integration Test (`repos/integration/src/tier1/endpoint-test.test.ts`)
- Create proxy endpoint via quickstart (real provider key)
- Execute test request via `/proxy/:projectId/:endpointId`
- Verify response status + body
- Test FaaS endpoint execution
- Test error cases: invalid endpoint (404), method not allowed (405)

## Content-Type → Monaco Language Mapping

| Content-Type | Monaco Language |
|-------------|----------------|
| `application/json` | `json` |
| `text/html` | `html` |
| `text/xml`, `application/xml` | `xml` |
| `text/css` | `css` |
| `text/javascript`, `application/javascript` | `javascript` |
| `text/markdown` | `markdown` |
| `text/yaml`, `application/x-yaml` | `yaml` |
| fallback | `plaintext` |
