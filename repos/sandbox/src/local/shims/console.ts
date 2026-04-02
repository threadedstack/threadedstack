import type { TShimDefinition } from '@TSB/types'

export const consoleShim: TShimDefinition = {
  names: [],

  setupCallbacks: async (jail, ivm, deps) => {
    await jail.set(
      `_log`,
      new ivm.Callback((...args: any[]) => {
        deps.onLog?.(...args)
      })
    )
  },

  setupGlobals: async (context) => {
    await context.eval(`
      globalThis.console = {
        log: (...args) => _log(...args),
        error: (...args) => _log('ERROR:', ...args),
        warn: (...args) => _log('WARN:', ...args),
        info: (...args) => _log('INFO:', ...args),
      }
    `)
  },
}
