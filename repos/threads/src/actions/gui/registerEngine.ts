import type { SessionEngine } from '@TTH/services/gui/engine/sessionEngine'

import { getGuiEngines, setGuiEngines } from '@TTH/state/accessors'

export const registerEngine = (sessionId: string, engine: SessionEngine) => {
  const next = new Map(getGuiEngines())
  next.set(sessionId, engine)
  setGuiEngines(next)
}
