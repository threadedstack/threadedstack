import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'
import type { TPermission, TSessionsUpdatedMessage } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { WsPingInterval } from '@TBE/constants/sandbox'
import { verifyShellToken } from '@TBE/services/sessionToken'
import { checkUserPermission } from '@TBE/utils/auth/checkUserPermission'
import {
  hashKey,
  ERoleType,
  EShellMsg,
  hasMinRole,
  EPermAction,
  ApiKeyPrefix,
  EPermResource,
} from '@tdsk/domain'

const monitorConnected = async (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): Promise<void> => {
  const { db, sandbox: sbService } = app.locals

  const url = new URL(req.url || ``, `http://localhost`)
  const queryToken = url.searchParams.get(`token`)
  const authHeader = req.headers.authorization

  let orgId: string
  let userId: string
  let apiKeyPerms: TPermission[] | undefined

  if (authHeader?.startsWith(`Bearer `)) {
    const token = authHeader.slice(7)

    if (token.startsWith(ApiKeyPrefix)) {
      const keyHash = hashKey(token)
      const { data: apiKey, error: keyErr } = await db.services.apiKey.getByHash(keyHash)
      if (keyErr || !apiKey || !apiKey.isValid()) {
        ws.close(4001, `Invalid or expired API key`)
        return
      }
      if (!apiKey.orgId || !apiKey.userId) {
        ws.close(4001, `API key missing org or user scope`)
        return
      }
      orgId = apiKey.orgId
      userId = apiKey.userId
      if (apiKey.permissions) apiKeyPerms = apiKey.permissions as TPermission[]
    } else {
      const payload = verifyShellToken(token)
      if (!payload) {
        ws.close(4001, `Invalid or expired token`)
        return
      }
      orgId = payload.orgId
      userId = payload.userId
    }
  } else if (queryToken) {
    const payload = verifyShellToken(queryToken)
    if (!payload) {
      ws.close(4001, `Invalid or expired token`)
      return
    }
    orgId = payload.orgId
    userId = payload.userId
  } else {
    ws.close(4001, `Authentication required`)
    return
  }

  // Check read permission on sandbox resource (with override support)
  const permResult = await checkUserPermission(
    db,
    userId,
    orgId,
    EPermAction.read,
    EPermResource.sandbox,
    undefined,
    apiKeyPerms
  )
  if (!permResult.allowed) {
    ws.close(4003, permResult.reason || `Permission denied`)
    return
  }

  // Fetch the role separately for the project-scoping check below
  const { data: userOrgRole, error: roleErr } = await db.services.role.getOrgRole(
    userId,
    orgId
  )
  if (roleErr) {
    logger.error(
      `[Monitor] Role lookup failed for user ${userId} in org ${orgId}:`,
      roleErr.message
    )
    ws.close(4005, `Failed to verify user role`)
    return
  }
  const effectiveRole = (userOrgRole?.type as ERoleType | null) ?? null

  if (!sbService) {
    ws.close(4003, `Sandbox service not available`)
    return
  }

  const { data: orgSandboxes, error: sbErr } = await db.services.sandbox.listByOrg(orgId)
  if (sbErr) {
    logger.error(`[Monitor] Sandbox listing failed for org ${orgId}:`, sbErr.message)
    ws.close(4005, `Failed to load sandbox data`)
    return
  }
  const allSandboxIds = (orgSandboxes ?? []).map((sb) => sb.id)

  let accessibleIds: Set<string> | null = null
  if (!hasMinRole(effectiveRole, ERoleType.admin)) {
    const { data: userProjectIds, error: projErr } =
      await db.services.role.getUserProjects(userId)
    if (projErr) {
      logger.error(
        `[Monitor] User projects lookup failed for user ${userId}:`,
        projErr.message
      )
      ws.close(4005, `Failed to verify project access`)
      return
    }
    const projectIdSet = new Set(userProjectIds ?? [])

    accessibleIds = new Set<string>()
    for (const sb of orgSandboxes ?? []) {
      if (!sb.projects.length || sb.projects.some((p) => projectIdSet.has(p.id))) {
        accessibleIds.add(sb.id)
      }
    }
  }

  sbService.addOrgMonitor(orgId, ws, accessibleIds, userId)

  for (const sbId of accessibleIds ?? allSandboxIds) {
    const sessions = sbService.getSessionsForSandbox(sbId)

    const enriched = sessions.map((s) => ({
      ...s,
      hasShellSession: !!sbService.getShellSession(s.sessionId),
    }))

    const snapshot: TSessionsUpdatedMessage = {
      sandboxId: sbId,
      sessions: enriched,
      type: EShellMsg.SessionsUpdated,
    }

    try {
      ws.send(JSON.stringify(snapshot))
    } catch (err) {
      logger.warn(
        `[Monitor] Failed to send session snapshot for ${sbId}:`,
        (err as Error).message
      )
      sbService.removeOrgMonitor(orgId, ws)
      return
    }

    try {
      const snapshot = await sbService.buildInstanceSnapshot(sbId, orgId)
      ws.send(JSON.stringify(snapshot))
    } catch (err) {
      logger.warn(
        `[Monitor] Failed to send instance snapshot for ${sbId}:`,
        (err as Error).message
      )
      sbService.removeOrgMonitor(orgId, ws)
      return
    }
  }

  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (ws.readyState !== ws.OPEN) {
      clearInterval(pingInterval)
      sbService.removeOrgMonitor(orgId, ws)
      return
    }
    if (!pongReceived) {
      clearInterval(pingInterval)
      sbService.removeOrgMonitor(orgId, ws)
      ws.close()
      return
    }
    pongReceived = false
    ws.ping()
  }, WsPingInterval)

  ws.on(`pong`, () => {
    pongReceived = true
  })

  ws.on(`close`, () => {
    clearInterval(pingInterval)
    sbService.removeOrgMonitor(orgId, ws)
  })

  ws.on(`error`, (err) => {
    logger.warn(`[Monitor] WebSocket error for org ${orgId}:`, err.message)
    clearInterval(pingInterval)
    sbService.removeOrgMonitor(orgId, ws)
  })
}

export const onMonitorConnect = async (
  ws: WebSocket,
  req: IncomingMessage,
  app: TApp
): Promise<void> => {
  try {
    await monitorConnected(ws, req, app)
  } catch (err) {
    logger.error(`[Monitor] Unhandled error:`, (err as Error).message)
    try {
      ws.close(4002, `Internal server error`)
    } catch {
      /* already closing */
    }
  }
}
