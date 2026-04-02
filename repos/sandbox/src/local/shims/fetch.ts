import type { TShimDefinition } from '@TSB/types'

export const fetchShim: TShimDefinition = {
  names: [],

  setupCallbacks: async (jail, ivm) => {
    await jail.set(
      `_fetch`,
      new ivm.Callback(
        async (url: string, optsJson: string) => {
          const opts = optsJson ? JSON.parse(optsJson) : {}
          const response = await fetch(url, opts)
          const body = await response.text()
          return JSON.stringify({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body,
            url: response.url,
          })
        },
        { async: true }
      )
    )
  },

  setupGlobals: async (context) => {
    await context.eval(`
      globalThis.fetch = async (url, opts) => {
        const raw = await _fetch(url, opts ? JSON.stringify(opts) : '')
        const data = JSON.parse(raw)
        return {
          ok: data.ok,
          status: data.status,
          statusText: data.statusText,
          url: data.url,
          headers: {
            get: (n) => data.headers[n.toLowerCase()] || null,
            has: (n) => n.toLowerCase() in data.headers,
            entries: () => Object.entries(data.headers),
          },
          text: async () => data.body,
          json: async () => JSON.parse(data.body),
        }
      }
    `)
  },
}
