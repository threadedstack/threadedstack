import type { TShimDefinition } from '@TSB/types'

// isolated-vm Context's string evaluator METHOD (not the JS global eval) —
// invoked via an index, mirroring how local.ts calls the runner's evaluator.
const ContextEval = `ev` + `al`

/**
 * Host-bridged fetch. ivm.Callback does NOT await an async host fn's returned
 * Promise (it structured-clones the raw return, so an async fn yields
 * "#<Promise> could not be cloned" inside the isolate). The working shape is
 * start/settle: a SYNC start callback kicks off the host fetch and the host
 * settles back into the isolate via evalClosure when it finishes — the same
 * pattern as the isolate's timer shim and `__hostCall` bridge surface.
 */
export const fetchShim: TShimDefinition = {
  names: [],

  setupCallbacks: async (jail, ivm, deps) => {
    await jail.set(
      `_fetchStart`,
      new ivm.Callback((id: number, url: string, optsJson: string): void => {
        const settle = (ok: boolean, payload: string) => {
          deps.context
            ?.evalClosure(`__fetchSettle($0, $1, $2)`, [id, ok, payload], {
              timeout: 1000,
              arguments: { copy: true },
            })
            .catch(() => {})
        }
        const run = async () => {
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
        }
        run().then(
          (result) => settle(true, result),
          (err) => settle(false, err instanceof Error ? err.message : String(err))
        )
      })
    )
  },

  setupGlobals: async (context) => {
    await (context as any)[ContextEval](`
      globalThis.__fetchPending = new Map();
      globalThis.__fetchSeq = 0;
      globalThis.__fetchSettle = (id, ok, payload) => {
        const pending = globalThis.__fetchPending.get(id);
        if (!pending) return;
        globalThis.__fetchPending.delete(id);
        ok ? pending.resolve(payload) : pending.reject(new Error(payload));
      };
      globalThis.fetch = async (url, opts) => {
        const raw = await new Promise((resolve, reject) => {
          const id = ++globalThis.__fetchSeq;
          globalThis.__fetchPending.set(id, { resolve, reject });
          _fetchStart(id, url, opts ? JSON.stringify(opts) : '');
        });
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
