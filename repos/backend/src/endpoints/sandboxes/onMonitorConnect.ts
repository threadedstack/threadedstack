import type WebSocket from 'ws'
import type { TApp } from '@TBE/types'
import type { IncomingMessage } from 'http'
import type { TMonitorMessage } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { WsPingInterval } from '@TBE/constants/sandbox'
import { verifyShellToken } from '@TBE/services/sessionToken'
import {
  hashKey,
  EShellMsg,
  hasMinRole,
  canPerform,
  ERoleType,
  ApiKeyPrefix,
  EPermAction,
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

  const { data: userOrgRole } = await db.services.role.getOrgRole(userId, orgId)
  const effectiveRole = (userOrgRole?.type as ERoleType | null) ?? null
  const permResult = canPerform(effectiveRole, EPermAction.read, EPermResource.sandbox)
  if (!permResult.allowed) {
    ws.close(4003, permResult.reason || `Permission denied`)
    return
  }

  if (!sbService) {
    ws.close(4003, `Sandbox service not available`)
    return
  }

  const { data: orgSandboxes } = await db.services.sandbox.listByOrg(orgId)
  const allSandboxIds = (orgSandboxes ?? []).map((sb) => sb.id)

  let accessibleIds: Set<string> | null = null
  if (!hasMinRole(effectiveRole, ERoleType.admin)) {
    const { data: userProjectIds } = await db.services.role.getUserProjects(userId)
    const projectIdSet = new Set(userProjectIds ?? [])

    accessibleIds = new Set<string>()
    for (const sb of orgSandboxes ?? []) {
      const sbProjects = (sb as any).projects as Array<{ id: string }> | undefined
      if (!sbProjects?.length || sbProjects.some((p) => projectIdSet.has(p.id))) {
        accessibleIds.add(sb.id)
      }
    }
  }

  sbService.addOrgMonitor(orgId, ws, accessibleIds)

  for (const sbId of accessibleIds ?? allSandboxIds) {
    const sessions = sbService.getSessionsForSandbox(sbId)

    const enriched = sessions.map((s) => ({
      ...s,
      hasShellSession: !!sbService.getShellSession(s.sessionId),
    }))

    const snapshot: TMonitorMessage = {
      sandboxId: sbId,
      sessions: enriched,
      type: EShellMsg.SessionsUpdated,
    }

    try {
      ws.send(JSON.stringify(snapshot))
    } catch (err) {
      logger.warn(
        `[Monitor] Failed to send snapshot for ${sbId}:`,
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
