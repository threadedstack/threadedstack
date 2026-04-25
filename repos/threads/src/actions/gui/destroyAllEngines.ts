import { resetWasmCache } from '@TTH/services/gui/engine/wasmBridge'
import {
  setGuiAsts,
  setGuiFeeds,
  setGuiModes,
  getGuiEngines,
  setGuiEngines,
} from '@TTH/state/accessors'

export const destroyAllEngines = () => {
  const engines = getGuiEngines()
  for (const engine of engines.values()) {
    try {
      engine.destroy()
    } catch {
      /* already destroyed */
    }
  }
  setGuiEngines(new Map())
  setGuiAsts(new Map())
  setGuiFeeds(new Map())
  setGuiModes(new Map())
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyAllEngines()
    resetWasmCache()
  })
  import.meta.hot.accept()
}
