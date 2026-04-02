import type { TShimDefinition } from '@TSB/types'

export const processShim: TShimDefinition = {
  names: [],

  setupGlobals: async (context, deps) => {
    const envJson = JSON.stringify(deps.env || {})
    await context.eval(`
      globalThis.process = {
        platform: 'linux',
        version: 'v20.0.0',
        arch: 'x64',
        pid: 1,
        env: ${envJson},
        cwd: function() { return '/workspace' },
        exit: function(code) { throw new Error('process.exit(' + (code || 0) + ') is not allowed in sandbox') },
        stdout: { write: function(d) { _log(d) } },
        stderr: { write: function(d) { _log('ERROR:', d) } },
        nextTick: function(fn) {
          var args = Array.prototype.slice.call(arguments, 1)
          Promise.resolve().then(function() { fn.apply(null, args) })
        },
        versions: { node: '20.0.0' },
        release: { name: 'node' },
        hrtime: Object.assign(function() { return [0, 0] }, {
          bigint: function() { return BigInt(0) }
        }),
      }
    `)
  },
}
