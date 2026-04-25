import type { TDocument } from '@TTH/types'

import { getGuiAsts, setGuiAsts, getGuiModes, setGuiModes } from '@TTH/state/accessors'

export const setEngineAst = (sessionId: string, doc: TDocument) => {
  const next = new Map(getGuiAsts())
  next.set(sessionId, doc)
  setGuiAsts(next)

  const modes = new Map(getGuiModes())
  modes.set(sessionId, doc.mode)
  setGuiModes(modes)
}
