import {
  getGuiAsts,
  setGuiAsts,
  getGuiFeeds,
  setGuiFeeds,
  getGuiModes,
  setGuiModes,
  getGuiEngines,
  setGuiEngines,
} from '@TTH/state/accessors'

export const destroyEngine = (sessionId: string) => {
  const engines = new Map(getGuiEngines())
  const engine = engines.get(sessionId)
  if (engine) engine.destroy()
  engines.delete(sessionId)
  setGuiEngines(engines)

  const asts = new Map(getGuiAsts())
  asts.delete(sessionId)
  setGuiAsts(asts)

  const feeds = new Map(getGuiFeeds())
  feeds.delete(sessionId)
  setGuiFeeds(feeds)

  const modes = new Map(getGuiModes())
  modes.delete(sessionId)
  setGuiModes(modes)
}
