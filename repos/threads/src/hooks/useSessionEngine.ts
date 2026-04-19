import { useEffect } from 'react'
import { useAtom } from 'jotai'
import {
  sessionEngineAtom,
  sessionASTAtom,
  sessionFeedAtom,
  sessionModeAtom,
} from '@TTH/state/gui'
import { SessionEngine } from '@TTH/engine/sessionEngine'

export function useSessionEngine(sessionId: string | null) {
  const [engines, setEngines] = useAtom(sessionEngineAtom)
  const [, setASTs] = useAtom(sessionASTAtom)
  const [, setFeeds] = useAtom(sessionFeedAtom)
  const [, setModes] = useAtom(sessionModeAtom)

  useEffect(() => {
    if (!sessionId || engines.get(sessionId)) return

    let cancelled = false
    let engine: SessionEngine | null = null

    SessionEngine.create(sessionId, {
      onAST: (doc) => {
        if (cancelled) return
        setASTs((prev) => {
          const next = new Map(prev)
          next.set(sessionId, doc)
          return next
        })
        setModes((prev) => {
          const next = new Map(prev)
          next.set(sessionId, doc.mode)
          return next
        })
      },
      onFeedEvents: (events) => {
        if (cancelled) return
        setFeeds((prev) => {
          const next = new Map(prev)
          const existing = next.get(sessionId) ?? []
          next.set(sessionId, [...existing, ...events])
          return next
        })
      },
    })
      .then((e) => {
        if (cancelled) {
          e.destroy()
          return
        }
        engine = e
        setEngines((prev) => {
          const next = new Map(prev)
          next.set(sessionId, e)
          return next
        })
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`[SessionEngine] WASM init failed for ${sessionId}:`, err)
        }
      })

    return () => {
      cancelled = true
      if (engine) {
        engine.destroy()
        setEngines((prev) => {
          const next = new Map(prev)
          next.delete(sessionId)
          return next
        })
        setASTs((prev) => {
          const next = new Map(prev)
          next.delete(sessionId)
          return next
        })
        setFeeds((prev) => {
          const next = new Map(prev)
          next.delete(sessionId)
          return next
        })
        setModes((prev) => {
          const next = new Map(prev)
          next.delete(sessionId)
          return next
        })
      }
    }
    // Jotai setters are stable; engines is read only as a guard — including it
    // in deps causes an infinite create/destroy loop when the atom updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return engines.get(sessionId ?? '') ?? null
}
