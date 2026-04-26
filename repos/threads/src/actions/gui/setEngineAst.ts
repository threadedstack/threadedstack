import type { TDocument } from '@TTH/types'

import { getGuiAsts, setGuiAsts, getGuiModes, setGuiModes } from '@TTH/state/accessors'

export const setEngineAst = (sessionId: string, doc: TDocument) => {
  const asts = getGuiAsts()
  const prev = asts.get(sessionId)
  if (prev === doc) return

  const nextAsts = new Map(asts)
  nextAsts.set(sessionId, doc)
  setGuiAsts(nextAsts)

  const modes = getGuiModes()
  if (modes.get(sessionId) !== doc.mode) {
    const nextModes = new Map(modes)
    nextModes.set(sessionId, doc.mode)
    setGuiModes(nextModes)
  }
}
