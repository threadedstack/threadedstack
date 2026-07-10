import type { TApp } from '@TBE/types'

import http from 'http'
import { database } from '@tdsk/database'
import { logger } from '@TBE/utils/logger'
import { config } from '@TBE/configs/backend.config'
import { EgressProxy } from '@TBE/services/proxy/egress'
import { KubeClient, setupKubeWatcher } from '@tdsk/sandbox'

/**
 * Standalone MITM egress service entrypoint (`tdsk-egress` deployment).
 *
 * Runs the EgressProxy OUTSIDE the backend process so a backend deploy no
 * longer restarts the egress path. Sandbox pods DNAT all outbound 80/443 to
 * this pod's IP (resolved per sandbox launch by the backend), so keeping this
 * process long-lived is what keeps running sandboxes' egress alive across
 * backend rollouts.
 *
 * Boots ONLY what the proxy needs — deliberately none of the backend's
 * sandbox-lifecycle machinery:
 *  - db          → secret lookups for placeholder resolution (read path only)
 *  - KubeClient  → the live route map (source pod IP → placeholders) via a
 *                  READ-ONLY hydrate + watch. This process must never manage
 *                  pod lifecycle: no SandboxService, no onRemoveRoute cleanup,
 *                  no idle reaper, no GC deletes (its RBAC has no delete verb).
 *  - EgressProxy → the MITM itself, listening on config.egress.servicePort
 *
 * Fails LOUD: a missing CA or failed proxy start exits non-zero so the pod
 * crashloops visibly and a rolling update never replaces a working pod with a
 * broken one (readiness gates on /health below).
 */

/** Liveness: process is up. Readiness/startup: fully serviceable (see /health). */
const HealthPaths = { live: `/live`, health: `/health` } as const

const DbPingTimeoutMs = 5_000

const main = async () => {
  const app = { locals: { config } } as TApp

  app.locals.db = database()

  const kube = new KubeClient()
  // Read-only hydration: routes only, never GC/delete pods (backend owns lifecycle).
  await kube.hydrate({ gc: false })
  setupKubeWatcher(kube)
  app.locals.kube = kube

  const proxy = await EgressProxy.init(app)
  if (!proxy) {
    logger.error(
      `[Egress] EgressProxy failed to initialize (missing CA at the mount path, or startup error) — exiting so the rollout blocks instead of serving dead egress`
    )
    process.exit(1)
  }

  // Probe the exact query path secret injection depends on: a secrets lookup.
  // A missing row is healthy ({} with no error); only a connection/query
  // failure marks the service unready.
  const dbOk = async (): Promise<boolean> => {
    try {
      const res = await Promise.race([
        app.locals.db.services.secret.get(`egress_health_probe`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`DB ping timed out`)), DbPingTimeoutMs)
        ),
      ])
      if (res?.error) throw res.error
      return true
    } catch (err) {
      logger.warn(`[Egress] Health DB ping failed: ${(err as Error).message}`)
      return false
    }
  }

  const health = http.createServer(async (req, res) => {
    if (req.url === HealthPaths.live) {
      res.writeHead(200, { 'Content-Type': `application/json` })
      return res.end(JSON.stringify({ ok: true }))
    }
    if (req.url !== HealthPaths.health) {
      res.writeHead(404)
      return res.end()
    }

    // Ready = MITM accepting connections AND secrets resolvable. Routes were
    // hydrated before the proxy started (boot order above), so a 200 here can
    // never race an empty route map.
    const listening = proxy.listening
    const db = listening && (await dbOk())
    const ok = listening && db
    res.writeHead(ok ? 200 : 503, { 'Content-Type': `application/json` })
    res.end(JSON.stringify({ ok, listening, db }))
  })

  await new Promise<void>((resolve) => {
    health.listen(config.egress.healthPort, () => resolve())
  })

  logger.log(
    `[Egress] Standalone egress service live — proxy :${config.egress.servicePort}, health :${config.egress.healthPort}`
  )

  const shutdown = () => {
    logger.log(`[Egress] Shutting down`)
    try {
      health.close()
    } catch (err) {
      logger.error(`[Egress] Health server close failed:`, (err as Error).message)
    }
    try {
      proxy.stop?.()
    } catch (err) {
      logger.error(`[Egress] Proxy stop failed:`, (err as Error).message)
    }
    try {
      kube.cleanup?.()
    } catch (err) {
      logger.error(`[Egress] Kube cleanup failed:`, (err as Error).message)
    }
    process.exit(0)
  }

  process.on(`SIGTERM`, shutdown)
  process.on(`SIGINT`, shutdown)
}

main().catch((err) => {
  logger.error(`[Egress] Fatal boot error:`, err)
  process.exit(1)
})
