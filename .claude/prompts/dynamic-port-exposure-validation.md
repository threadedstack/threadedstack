# Dynamic Port Exposure — Integration Testing & Validation

## What was done

A full "Dynamic Port Exposure" feature was implemented across 6 repos. It lets users expose ports on running sandbox pods at runtime, with port discovery, CRUD API endpoints, TSA CLI commands, monitor WebSocket broadcasts, and a PortsSection UI panel in the threads SPA.

All code is written. Type checks pass across all repos (domain, sandbox, backend, threads, tsa). Unit tests pass (17 sandboxProxy, 501 TSA). Two rounds of multi-agent code review completed — all critical/high/medium issues found were fixed and verified.

**What remains: integration testing against live K8s to validate the feature end-to-end.**

## Files changed (port-exposure feature only)

### New files (7):
- `repos/backend/src/endpoints/sandboxes/managePorts.ts` — GET/POST/DELETE endpoint handlers
- `repos/threads/src/components/SessionLayout/PortsSection.tsx` — UI component (exposed ports, detected ports, add/remove/open)
- `repos/threads/src/actions/sandboxes/loadPorts.ts` — Jotai state loader
- `repos/threads/src/actions/sandboxes/exposePort.ts` — Expose port action
- `repos/threads/src/actions/sandboxes/removePort.ts` — Remove port action
- `repos/tsa/src/tasks/ports.ts` — CLI task (list/add/remove/open subtasks)
- `repos/tsa/src/commands/ports.ts` — Slash command for interactive chat

### Modified files (19):
- `repos/domain/src/types/sandbox.types.ts` — Added TDetectedPort, TPortsResponse, TExposePortRequest, TExposePortResponse, TPortsChangedMessage, PortsChanged enum; updated TSBConnectResp with subdomain/portUrlTemplate; updated TMonitorMessage union
- `repos/sandbox/src/kube/kubeClient.ts` — Added patchPodAnnotation, updateRoutePort, removeRoutePort, findSubdomainByInstance
- `repos/backend/src/services/sandboxes/sandbox.ts` — Added exposePort, removePort, scanPorts, parseListeningPorts, getExposedPorts, buildPortUrl, buildPortUrlTemplate, broadcastPortsChanged, removePodProxiesByIp; fixed onRemoveRoute cleanup to use IP-based sweep
- `repos/backend/src/endpoints/sandboxes/connectSandbox.ts` — Added subdomain + portUrlTemplate to response
- `repos/backend/src/endpoints/orgs/orgProjects.ts` — Registered listPorts, exposePort, removePort endpoints
- `repos/threads/src/services/sandboxApi.ts` — Added listPorts, exposePort, removePort methods with _onError
- `repos/threads/src/services/monitorService.ts` — Added PortsChanged handler with field validation
- `repos/threads/src/services/sessionService.ts` — Stores subdomain + portUrlTemplate from connect response
- `repos/threads/src/components/SessionLayout/ContextPanel.tsx` — Added Ports section, accepts orgId/projectId props
- `repos/threads/src/components/SessionLayout/index.ts` — Exports PortsSection
- `repos/threads/src/pages/Session/Session.tsx` — Passes orgId/projectId to ContextPanel
- `repos/threads/src/state/sessions.ts` — Added sandboxPortsAtom
- `repos/threads/src/state/accessors.ts` — Added getSandboxPorts, setSandboxPorts, resetSandboxPorts
- `repos/threads/src/state/selectors.ts` — Added useSandboxPorts
- `repos/threads/src/types/sessions.types.ts` — Added subdomain/portUrlTemplate to TOpenSession
- `repos/tsa/src/services/api.ts` — Added listPorts, exposePort, removePort API methods
- `repos/tsa/src/tasks/index.ts` — Registered ports task
- `repos/tsa/src/commands/registry.ts` — Registered ports slash command

## Architecture summary

### How it works:
1. **Preset ports** — configured in admin UI sandbox drawer (`config.ports`), baked into pod annotation at creation, auto-hydrated into route map
2. **Runtime ports** — added/removed via API (`POST/DELETE /:id/ports`), updates in-memory route map + patches pod annotation for persistence
3. **Port discovery** — `GET /:id/ports` execs `ss -tln` (fallback `netstat -tln`) in the pod, returns both exposed and detected ports
4. **Routing** — existing `sandboxProxy.ts` checks `route.ports[port]`, so only explicitly exposed ports are routable via `<port>--<subdomain>.<domain>`
5. **Monitor** — exposePort/removePort broadcast PortsChanged to connected monitor WebSocket clients
6. **Auth** — all management endpoints use existing `authorize()` middleware (JWT/API key); browser access to exposed ports relies on explicit enablement + subdomain obscurity

### API endpoints (project-scoped):
- `GET /orgs/:orgId/projects/:projectId/sandboxes/:id/ports?instanceId=<id>` — list exposed + detected ports + portUrlTemplate
- `POST /orgs/:orgId/projects/:projectId/sandboxes/:id/ports` — body: `{ instanceId, port, protocol? }` — expose a port
- `DELETE /orgs/:orgId/projects/:projectId/sandboxes/:id/ports/:port` — body: `{ instanceId }` — remove a port

### Key design decisions:
- Blocked ports: 22 and 2222 (SSH infrastructure) cannot be exposed
- Protocol validation: only `http` or `https` accepted, defaults to `http`
- Annotation persistence: route map changes are written to pod annotations so they survive backend restarts
- Port URL format: `https://<port>--<subdomain>.sandbox.threadedstack.app`

## What to validate

### 1. Backend API integration tests
Write tests in `repos/integration/` that:
- Connect to a sandbox (get instanceId)
- `POST /:id/ports` — expose port 8080, verify 200 response with url
- `GET /:id/ports` — verify port 8080 appears in exposed, verify portUrlTemplate is present
- `POST /:id/ports` with port 22 — verify 403 (blocked port)
- `POST /:id/ports` with port 0 — verify 400 (invalid range)
- `POST /:id/ports` with protocol "ftp" — verify 400 (invalid protocol)
- `DELETE /:id/ports/8080` — verify 200, then GET confirms port removed
- `DELETE /:id/ports/9999` — verify 404 (port not exposed)
- Verify port scan (`detected` field in GET response) returns reasonable results

### 2. Subdomain routing validation
- After exposing a port, curl `https://<port>--<subdomain>.sandbox.threadedstack.app` to verify the proxy routes correctly
- Verify that removing the port makes the URL return 404

### 3. Connect response validation
- Verify connect response includes `subdomain` and `portUrlTemplate` fields

### 4. TSA CLI validation
- `tsa ports` — lists ports for a sandbox
- `tsa ports add 3000` — exposes port
- `tsa ports open 3000` — prints URL
- `tsa ports remove 3000` — removes port

### 5. Monitor WebSocket validation
- Connect to monitor WebSocket
- Expose a port via API
- Verify PortsChanged message is received with correct exposed/detected data

### 6. Threads SPA UI validation (Playwright or manual)
- Open session, verify PortsSection appears in context panel
- Verify detected ports show up after scan
- Click expose on a detected port — verify it moves to exposed list
- Click "Open in Browser" — verify link opens correct URL
- Click remove — verify port is removed
- Add port via input field — verify it appears

## Plan file
The full implementation plan is at: `~/.claude/plans/users-need-to-dynamically-prancy-boot.md`

## Test failures
- `repos/backend/src/services/sandboxes/sandbox.test.ts` has 19 failures (`listSkillsForSandbox is not a function`), while unrelated to port exposure must be investigated and fixed. 
