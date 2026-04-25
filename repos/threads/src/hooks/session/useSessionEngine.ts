import { useEffect } from 'react'
import { useGuiEngines } from '@TTH/state/selectors'
import { setEngineAst } from '@TTH/actions/gui/setEngineAst'
import { destroyEngine } from '@TTH/actions/gui/destroyEngine'
import { registerEngine } from '@TTH/actions/gui/registerEngine'
import { appendFeedEvents } from '@TTH/actions/gui/appendFeedEvents'
import { SessionEngine } from '@TTH/services/gui/engine/sessionEngine'

export function useSessionEngine(sessionId: string | null) {
  const [engines] = useGuiEngines()

  useEffect(() => {
    if (!sessionId || engines.get(sessionId)) return

    let cancelled = false
    let createdEngine: SessionEngine | null = null

    SessionEngine.create(sessionId, {
      onAST: (doc) => {
        if (cancelled) return
        setEngineAst(sessionId, doc)
      },
      onFeedEvents: (events) => {
        if (cancelled) return
        appendFeedEvents(sessionId, events)
      },
    })
      .then((e) => {
        if (cancelled) {
          e.destroy()
          return
        }
        createdEngine = e
        registerEngine(sessionId, e)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`[SessionEngine] WASM init failed for ${sessionId}:`, err)
        }
      })

    return () => {
      cancelled = true
      if (createdEngine) destroyEngine(sessionId)
    }
    // engines is read only as a guard — including it in deps causes an
    // infinite create/destroy loop when the atom updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return engines.get(sessionId ?? '') ?? null
}
