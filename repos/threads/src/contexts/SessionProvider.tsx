import type { ReactNode } from 'react'
import type { TSessionCtx } from '@TTH/contexts/SessionContext'
import type { TPendingOp, TSessionLocationState } from '@TTH/types'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { SandboxIdPrefix } from '@tdsk/domain'
import { MemoChildren } from '@tdsk/components'
import { openSession } from '@TTH/actions/sessions'
import { useParams, useLocation } from 'react-router'
import { useState, useMemo, useEffect, useRef } from 'react'
import { SessionContext } from '@TTH/contexts/SessionContext'
import { findSandboxForSession } from '@TTH/utils/sessionStorage'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { useUser, useOrgId, useSandboxes, useOpenSessions } from '@TTH/state/selectors'

export type TSessionProvider = {
  children: ReactNode
}

export const SessionProvider = (props: TSessionProvider) => {
  const { children } = props

  const [user] = useUser()
  const [orgId] = useOrgId()
  const location = useLocation()
  const [sandboxes] = useSandboxes()
  const [openSessions] = useOpenSessions()
  const [connecting, setConnecting] = useState(false)
  const { sessionId } = useParams<{ sessionId: string }>()
  const [pendingOp, setPendingOp] = useState<TPendingOp>(null)

  const session = sessionId ? openSessions.get(sessionId) : undefined
  const hasSession = !!session

  const locationState = location.state as TSessionLocationState | undefined

  // Resolve sandboxId: active session > route state > sessionStorage reverse lookup
  const sandboxId = useMemo(() => {
    if (session?.sandboxId) return session.sandboxId
    if (locationState?.sandboxId) return locationState.sandboxId
    if (sessionId) return findSandboxForSession(sessionId)
    return undefined
  }, [session?.sandboxId, locationState?.sandboxId, sessionId])

  const resolvedProjectId = useMemo((): string | undefined => {
    if (session?.projectId) return session.projectId
    if (locationState?.projectId) return locationState.projectId
    return undefined
  }, [session?.projectId, locationState?.projectId])

  const sandbox = useMemo(() => {
    if (!sandboxId) return undefined
    if (sandboxId.startsWith(SandboxIdPrefix))
      return sandboxes.find((s) => s.id === sandboxId)
    if (!resolvedProjectId) return undefined
    return sandboxes.find((s) =>
      s.projectConfigs?.some(
        (pc) => pc.alias === sandboxId && pc.projectId === resolvedProjectId
      )
    )
  }, [sandboxId, sandboxes, resolvedProjectId])

  const projectId = useMemo((): string | undefined => {
    if (resolvedProjectId) return resolvedProjectId
    return sandbox?.projects?.[0]?.id
  }, [resolvedProjectId, sandbox?.projects])

  const isOwner = useMemo(
    () => !!session && !!user && session.podOwnerUserId === user.id,
    [session, user]
  )

  // Auto-reconnect when provider mounts with a sessionId but no active WebSocket session
  const reconnectAttempted = useRef(false)
  const hadSession = useRef(false)
  const prevSessionId = useRef(sessionId)

  // Reset refs when navigating to a different session
  useEffect(() => {
    if (prevSessionId.current !== sessionId) {
      prevSessionId.current = sessionId
      reconnectAttempted.current = false
      hadSession.current = false
    }
  }, [sessionId])

  useEffect(() => {
    if (hasSession) hadSession.current = true
  }, [hasSession])

  useEffect(() => {
    if (
      hasSession ||
      connecting ||
      pendingOp ||
      reconnectAttempted.current ||
      hadSession.current ||
      !sessionId ||
      !sandboxId ||
      !orgId ||
      !projectId
    )
      return

    reconnectAttempted.current = true
    let mounted = true
    setConnecting(true)

    const { cols, rows } = estimateTerminalDimensions()
    openSession({ sandboxId, orgId, projectId, sessionId, cols, rows })
      .then((newSessionId) => {
        if (!mounted) return
        if (!newSessionId) {
          console.error(`[SessionProvider] reconnect returned no sessionId`)
          toast.error(`Reconnect failed`, { description: `No session was created` })
          return
        }
        if (newSessionId !== sessionId) {
          nav.session(orgId, projectId, newSessionId, {
            replace: true,
            state: { sandboxId, projectId },
          })
        }
      })
      .catch((err) => {
        if (!mounted) return
        console.error(`[SessionProvider] auto-reconnect failed:`, err)
        toast.error(`Failed to reconnect`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      })
      .finally(() => {
        if (mounted) setConnecting(false)
      })

    return () => {
      mounted = false
    }
  }, [orgId, projectId, pendingOp, sessionId, sandboxId, hasSession, connecting])

  const ctx = useMemo<TSessionCtx>(
    () => ({
      session,
      isOwner,
      sandboxId,
      projectId,
      pendingOp,
      connecting,
      setPendingOp,
    }),
    [session, isOwner, sandboxId, projectId, pendingOp, connecting]
  )

  return (
    <SessionContext.Provider value={ctx}>
      <MemoChildren>{children}</MemoChildren>
    </SessionContext.Provider>
  )
}
