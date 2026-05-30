# Auth & Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mass assignment vulnerabilities, add rate limiting, security headers, timing-safe comparison, normalize error messages, and add WebSocket connection limits before beta launch.

**Architecture:** Six independent hardening tasks across proxy and backend repos. Each can be implemented and tested independently. Mass assignment fixes follow the existing allowlist pattern in `updateSandbox.ts`. Rate limiting uses `express-rate-limit`. Security headers use `helmet`. WebSocket limits use an in-memory connection counter.

**Tech Stack:** Express 5, express-rate-limit, helmet, Node.js crypto, Vitest

**Spec:** `docs/superpowers/specs/2026-04-18-auth-hardening-design.md`

---

### Task 1: Fix Mass Assignment in updateOrg

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/updateOrg.ts`

- [ ] **Step 1: Fix the endpoint**

Replace the direct `req.body` spread with an explicit allowlist. Edit `repos/backend/src/endpoints/orgs/updateOrg.ts`:

Replace lines 18-30:
```typescript
    const orgData = req.body

    // Check permission first
    await checkPermission(req, EPermAction.update, EPermResource.org, { orgId })

    // Check if org exists
    const { data: existingOrg, error: getError } = await db.services.org.get(orgId)

    if (getError) throw new Exception(500, getError.message)

    if (!existingOrg) throw new Exception(404, `Org not found`)

    const { data, error } = await db.services.org.update({ ...orgData, id: orgId })
```

With:
```typescript
    const { name, description, config } = req.body

    // Check permission first
    await checkPermission(req, EPermAction.update, EPermResource.org, { orgId })

    // Check if org exists
    const { data: existingOrg, error: getError } = await db.services.org.get(orgId)

    if (getError) throw new Exception(500, getError.message)

    if (!existingOrg) throw new Exception(404, `Org not found`)

    const { data, error } = await db.services.org.update({
      id: orgId,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(config !== undefined && { config }),
    })
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 2: Fix Mass Assignment in updateProject

**Files:**
- Modify: `repos/backend/src/endpoints/projects/updateProject.ts`

- [ ] **Step 1: Fix the endpoint**

Edit `repos/backend/src/endpoints/projects/updateProject.ts`. Replace line 18 and lines 32-35:

Replace:
```typescript
    const updates = req.body
```
With:
```typescript
    const { name, description } = req.body
```

Replace:
```typescript
    const { data, error } = await db.services.project.update({
      ...updates,
      id: projectId,
    })
```
With:
```typescript
    const { data, error } = await db.services.project.update({
      id: projectId,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    })
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 3: Fix Mass Assignment in updateProvider

**Files:**
- Modify: `repos/backend/src/endpoints/providers/updateProvider.ts`

- [ ] **Step 1: Fix the endpoint**

Edit `repos/backend/src/endpoints/providers/updateProvider.ts`. Replace lines 18-41:

Replace:
```typescript
    const providerData = req.body

    const existing = await requireResourceWithPermission(
      req,
      db.services.provider,
      id,
      EPermAction.update,
      EPermResource.provider,
      `Provider`,
      (provider) => ({ orgId: provider.orgId })
    )

    // Prevent accidental clearing of API key link
    // Allow secretId to be changed to a different secret, but not nulled out
    if (providerData.secretId === null) delete providerData.secretId

    // Merge with existing record so partial updates still validate correctly
    const effectiveType = providerData.type ?? existing.type
    const effectiveBrand = providerData.brand ?? existing.brand

    if (providerData.type) db.services.provider.validateType(providerData.type)
    db.services.provider.validateLLM(effectiveType, effectiveBrand)

    const { data, error } = await db.services.provider.update({ ...providerData, id })
```

With:
```typescript
    const { name, baseUrl, defaultModel, config, type, brand, secretId } = req.body

    const existing = await requireResourceWithPermission(
      req,
      db.services.provider,
      id,
      EPermAction.update,
      EPermResource.provider,
      `Provider`,
      (provider) => ({ orgId: provider.orgId })
    )

    // Merge with existing record so partial updates still validate correctly
    const effectiveType = type ?? existing.type
    const effectiveBrand = brand ?? existing.brand

    if (type) db.services.provider.validateType(type)
    db.services.provider.validateLLM(effectiveType, effectiveBrand)

    const { data, error } = await db.services.provider.update({
      id,
      ...(name !== undefined && { name }),
      ...(baseUrl !== undefined && { baseUrl }),
      ...(defaultModel !== undefined && { defaultModel }),
      ...(config !== undefined && { config }),
      ...(type !== undefined && { type }),
      ...(brand !== undefined && { brand }),
      // Allow secretId to be changed to a different secret, but not nulled out
      ...(secretId !== undefined && secretId !== null && { secretId }),
    })
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 4: Fix Mass Assignment in updateAgent

**Files:**
- Modify: `repos/backend/src/endpoints/agents/updateAgent.ts`

- [ ] **Step 1: Fix the endpoint**

Edit `repos/backend/src/endpoints/agents/updateAgent.ts`. The issue is line 18 where `...agent` captures all remaining fields. Replace line 18:

Replace:
```typescript
    const { secretIds, projectIds = [], providerInputs, ...agent } = req.body
```

With:
```typescript
    const {
      name,
      description,
      instructions,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      thinkingEnabled,
      thinkingBudget,
      secretIds,
      projectIds = [],
      providerInputs,
    } = req.body
```

Then replace lines 89-93:

Replace:
```typescript
    agent.id = id
    if (projects?.length) agent.projects = projects
    if (pins !== undefined) agent.providerInputs = pins
    if (secretIds !== undefined) agent.secretIds = secretIds
    const { data, error } = await db.services.agent.update(agent)
```

With:
```typescript
    const agentUpdate: Record<string, unknown> = { id }
    if (name !== undefined) agentUpdate.name = name
    if (description !== undefined) agentUpdate.description = description
    if (instructions !== undefined) agentUpdate.instructions = instructions
    if (model !== undefined) agentUpdate.model = model
    if (temperature !== undefined) agentUpdate.temperature = temperature
    if (maxTokens !== undefined) agentUpdate.maxTokens = maxTokens
    if (systemPrompt !== undefined) agentUpdate.systemPrompt = systemPrompt
    if (thinkingEnabled !== undefined) agentUpdate.thinkingEnabled = thinkingEnabled
    if (thinkingBudget !== undefined) agentUpdate.thinkingBudget = thinkingBudget
    if (projects?.length) agentUpdate.projects = projects
    if (pins !== undefined) agentUpdate.providerInputs = pins
    if (secretIds !== undefined) agentUpdate.secretIds = secretIds
    const { data, error } = await db.services.agent.update(agentUpdate)
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 5: Fix Mass Assignment in updateUser (Admin Path)

**Files:**
- Modify: `repos/backend/src/endpoints/users/updateUser.ts`

- [ ] **Step 1: Fix the endpoint**

Edit `repos/backend/src/endpoints/users/updateUser.ts`. The self-update path (lines 33-44) already has an allowlist. Fix only the admin path at line 68.

Replace line 21:
```typescript
    const userData = req.body
```
With:
```typescript
    const { name, email, avatar, metadata, orgId: bodyOrgId } = req.body
```

Replace line 23:
```typescript
    const orgId = userData.orgId as string | undefined
```
With:
```typescript
    const orgId = bodyOrgId as string | undefined
```

Replace the self-update allowlist section (lines 34-37) to use the already-destructured fields:
```typescript
      const filteredData = Object.fromEntries(
        Object.entries({ name, email, avatar, metadata }).filter(([, v]) => v !== undefined)
      )
```

Replace line 68:
```typescript
    const { data, error } = await db.services.user.update({ ...userData, id })
```
With:
```typescript
    const adminAllowed: Record<string, unknown> = {}
    if (name !== undefined) adminAllowed.name = name
    if (email !== undefined) adminAllowed.email = email
    if (avatar !== undefined) adminAllowed.avatar = avatar
    if (metadata !== undefined) adminAllowed.metadata = metadata
    const { data, error } = await db.services.user.update({ ...adminAllowed, id })
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 6: Add Security Headers (Helmet)

**Files:**
- Modify: `repos/proxy/package.json`
- Modify: `repos/backend/package.json`
- Modify: `repos/proxy/src/middleware/setupServer.ts`
- Modify: `repos/backend/src/middleware/setupServer.ts`

- [ ] **Step 1: Install helmet in both repos**

Run: `pnpm --filter @tdsk/proxy add helmet && pnpm --filter @tdsk/backend add helmet`

- [ ] **Step 2: Add helmet to proxy setupServer**

Edit `repos/proxy/src/middleware/setupServer.ts`. Add import and use helmet early:

```typescript
import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import cors from 'cors'
import helmet from 'helmet'
import express from 'express'
import { behindLBProxy } from '@tdsk/domain'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

export const setupServer = (app: TProxyApp, router: Router) => {
  app.disable(`x-powered-by`)
  app.use(helmet())

  const origins = ensureArr(app.locals.config.server.origins)

  !behindLBProxy() &&
    app.use(
      cors({
        origin: origins.includes(`*`) ? `*` : origins,
      })
    )

  app.use(express.urlencoded({ extended: true }))

  app.use(router)
}
```

- [ ] **Step 3: Add helmet to backend setupServer**

Edit `repos/backend/src/middleware/setupServer.ts`:

```typescript
import type { Router } from 'express'
import type { TApp, TRouter } from '@tdsk/domain'

import cors from 'cors'
import helmet from 'helmet'
import { behindLBProxy } from '@tdsk/domain'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'

export const setupServer = (app: TApp, router: TRouter) => {
  app.disable(`x-powered-by`)
  app.use(helmet())

  const origins = ensureArr(app.locals.config.server.origins)
  if (!behindLBProxy())
    app.use(
      cors({
        origin: origins.includes(`*`) ? `*` : origins,
      })
    )

  app.use(router as unknown as Router)
}
```

- [ ] **Step 4: Verify tests pass in both repos**

Run: `cd repos/proxy && pnpm test && cd ../backend && pnpm test`
Expected: All tests pass in both repos

---

### Task 7: Add Rate Limiting

**Files:**
- New: `repos/proxy/src/middleware/rateLimit.ts`
- New: `repos/backend/src/middleware/rateLimit.ts`
- Modify: `repos/proxy/src/proxy.ts`
- Modify: `repos/backend/src/middleware/index.ts` (if barrel exists) or the main setup chain

- [ ] **Step 1: Install express-rate-limit in both repos**

Run: `pnpm --filter @tdsk/proxy add express-rate-limit && pnpm --filter @tdsk/backend add express-rate-limit`

- [ ] **Step 2: Create proxy rate limit middleware**

Create `repos/proxy/src/middleware/rateLimit.ts`:

```typescript
import type { TProxyApp } from '@TPX/types'
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later` },
})

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later` },
})

export const setupRateLimit = (app: TProxyApp) => {
  app.use(`/auth`, authLimiter)
  app.use(`/_`, apiLimiter)
}
```

- [ ] **Step 3: Wire proxy rate limiting into middleware chain**

Edit `repos/proxy/src/proxy.ts`. Add import and call after `setupServer` but before `setupAuth`:

Add import:
```typescript
import { setupRateLimit } from '@TPX/middleware/rateLimit'
```

Add after line 23 (`setupServer(app, router)`):
```typescript
  setupRateLimit(app)
```

The middleware order becomes: Logger → Server → **RateLimit** → Database → Auth → ...

- [ ] **Step 4: Create backend rate limit middleware**

Create `repos/backend/src/middleware/rateLimit.ts`:

```typescript
import type { TApp } from '@TBE/types'
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later` },
})

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later` },
})

export const setupRateLimit = (app: TApp) => {
  app.use(`/_/ai/sessions`, authLimiter)
  app.use(`/_`, apiLimiter)
}
```

- [ ] **Step 5: Wire backend rate limiting into the server setup**

The backend's middleware chain is set up in `repos/backend/src/main.ts` or equivalent. Find where `setupServer` is called and add `setupRateLimit` after it. The implementer should read the backend's main entry point to find the exact location.

Add import:
```typescript
import { setupRateLimit } from '@TBE/middleware/rateLimit'
```

Call `setupRateLimit(app)` after `setupServer` but before `setupAuth` or `setupEndpoints`.

- [ ] **Step 6: Verify tests pass in both repos**

Run: `cd repos/proxy && pnpm test && cd ../backend && pnpm test`
Expected: All tests pass

---

### Task 8: Timing-Safe Proxy Header Comparison

**Files:**
- Modify: `repos/backend/src/utils/auth/pxToBeHeader.ts`

- [ ] **Step 1: Fix the comparison**

Edit `repos/backend/src/utils/auth/pxToBeHeader.ts`. Replace the entire file:

```typescript
import type { TRequest } from '@tdsk/domain'

import { timingSafeEqual } from 'crypto'
import { exists } from '@keg-hub/jsutils/exists'

export const pxToBeHeader = (req: TRequest) => {
  const { config } = req.app?.locals

  if (!exists(config.proxy.headerValue)) return

  const validate = req.header(config.proxy.headerKey)
  if (!validate) throw new Error(`Invalid proxy validation`)

  const expected = Buffer.from(config.proxy.headerValue)
  const received = Buffer.from(validate)

  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new Error(`Invalid proxy validation`)
}
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 9: Normalize Shell Token Error Messages

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`

- [ ] **Step 1: Fix the error message**

Edit `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`. Change line 166:

Replace:
```typescript
      ws.close(4001, `Token sandbox mismatch`)
```
With:
```typescript
      ws.close(4001, `Invalid or expired shell token`)
```

This makes lines 162 and 166 return identical messages to the client. The server-side log (if any) can still differentiate via the code path.

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 10: WebSocket Connection Limits

**Files:**
- Modify: `repos/backend/src/server/wsServer.ts`

- [ ] **Step 1: Add connection tracking**

Edit `repos/backend/src/server/wsServer.ts`. Add connection tracking at the top of `createWSServer` and enforce limits in `onUpgrade`:

```typescript
import type WebSocket from 'ws'
import type { Socket } from 'net'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'

import { WebSocketServer } from 'ws'
import { logger } from '@TBE/utils/logger'
import { onWSConnect } from '@TBE/endpoints/ai/onWSConnect'
import { SBTunnelPattern, SBShellPattern } from '@TBE/constants/sandbox'
import { onShellConnect } from '@TBE/endpoints/sandboxes/onShellConnect'
import { onTunnelConnect } from '@TBE/endpoints/sandboxes/onTunnelConnect'

type TWsHandler = (ws: WebSocket, req: IncomingMessage, app: TApp) => Promise<void>

const WS_MAX_CONNECTIONS_PER_IP = 20

export const createWSServer = (app: TApp) => {
  const wss = new WebSocketServer({ noServer: true })
  const connectionsPerIp = new Map<string, number>()

  const getClientIp = (req: IncomingMessage): string =>
    (req.headers[`x-forwarded-for`] as string)?.split(`,`)[0]?.trim()
    || req.socket.remoteAddress
    || `unknown`

  const trackConnection = (ws: WebSocket, ip: string) => {
    const current = connectionsPerIp.get(ip) || 0
    connectionsPerIp.set(ip, current + 1)
    ws.on(`close`, () => {
      const count = connectionsPerIp.get(ip) || 1
      if (count <= 1) connectionsPerIp.delete(ip)
      else connectionsPerIp.set(ip, count - 1)
    })
  }

  const staticRoutes = new Map<string, TWsHandler>()
  staticRoutes.set(`/ai/ws`, onWSConnect)

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const pathname = new URL(req.url || ``, `http://localhost`).pathname
    const clientIp = getClientIp(req)

    // Enforce per-IP connection limit
    const currentCount = connectionsPerIp.get(clientIp) || 0
    if (currentCount >= WS_MAX_CONNECTIONS_PER_IP) {
      logger.warn(`[WS] Connection limit exceeded for IP ${clientIp} (${currentCount}/${WS_MAX_CONNECTIONS_PER_IP})`)
      socket.destroy()
      return
    }

    // Static route match
    const staticHandler = staticRoutes.get(pathname)
    if (staticHandler) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        trackConnection(ws, clientIp)
        staticHandler(ws, req, app).catch((err) => {
          logger.error(`WS connect error on ${pathname}`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    // Dynamic route: sandbox tunnel
    const tunnelMatch = pathname.match(SBTunnelPattern)
    if (tunnelMatch) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        trackConnection(ws, clientIp)
        onTunnelConnect(ws, req, app).catch((err) => {
          logger.error(`WS tunnel error`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    // Dynamic route: sandbox shell
    const shellMatch = pathname.match(SBShellPattern)
    if (shellMatch) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        trackConnection(ws, clientIp)
        onShellConnect(ws, req, app).catch((err) => {
          logger.error(`WS shell error`, {
            error: err instanceof Error ? err.message : err,
          })
          ws.close(1011, `Internal error`)
        })
      })
      return
    }

    socket.destroy()
  }

  logger.info(`WebSocket server ready (multi-path dispatch)`)

  return { wss, onUpgrade }
}
```

- [ ] **Step 2: Verify backend tests pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 11: Type Check and Full Verification

**Files:** None — validation only

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: All repos type check cleanly

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass across all repos

- [ ] **Step 3: Verify proxy build**

Run: `cd repos/proxy && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Verify backend build**

Run: `cd repos/backend && pnpm build`
Expected: Build succeeds
