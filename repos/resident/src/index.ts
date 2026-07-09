import type { TEventLoop } from './loop'
import type { THeartbeat } from './heartbeat'

import { log } from './log'
import { createResidentApi } from './api'
import { createEventLoop } from './loop'
import { createActionPump } from './pump'
import { createCompactor } from './compactor'
import { createHeartbeat } from './heartbeat'
import { createTranscript } from './transcript'
import { createSubAgentPool } from './subagents'
import { createSessionManager } from './session'
import { readResidentEnv, createConfigManager } from './config'

export type TSignalTarget = {
  once: (signal: string, handler: () => void) => unknown
}

export type TSignalHandlerOpts = {
  loop: TEventLoop
  heartbeat: THeartbeat
  /** Injectable process boundary for tests. */
  proc?: TSignalTarget
  exitFn?: (code: number) => void
}

/**
 * The rolling-restart contract: on SIGTERM/SIGINT the resident finishes the
 * current turn, writes its checkpoint (compactor), and exits 0 — the watchdog
 * recreates the pod and the next session reseeds from the checkpoint.
 */
export const installSignalHandlers = (opts: TSignalHandlerOpts): void => {
  const proc = opts.proc ?? process
  const exitFn = opts.exitFn ?? ((code: number) => process.exit(code))
  let shuttingDown = false

  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log.info(`Received ${signal} — graceful shutdown (finish turn → checkpoint → exit 0)`)
    opts.heartbeat.stop()
    opts.loop
      .shutdown()
      .then(() => exitFn(0))
      .catch((err) => {
        log.error(`Shutdown failed:`, err)
        exitFn(1)
      })
  }

  proc.once(`SIGTERM`, () => shutdown(`SIGTERM`))
  proc.once(`SIGINT`, () => shutdown(`SIGINT`))
}

/**
 * Resident runtime wire-up — the pod's main process (launched by podManifest
 * as `node repos/resident/dist/index.js`):
 *
 *   env contract → api client → config (network-free boot from the injected
 *   TDSK_RESIDENT_CONFIG env, refreshed from the records API) → session
 *   (disk state) → pump/compactor/transcript/sub-agents → event loop +
 *   heartbeat → signal handlers.
 */
export const startResident = async (): Promise<{
  loop: TEventLoop
  heartbeat: THeartbeat
}> => {
  const env = readResidentEnv()
  log.info(`Resident runtime starting for agent ${env.agentId}`)

  const api = createResidentApi({
    backendUrl: env.backendUrl,
    token: env.token,
    orgId: env.orgId,
    projectId: env.projectId,
    agentId: env.agentId,
  })

  const config = createConfigManager({ env, api })
  const loaded = await config.load()
  log.info(
    `Config loaded: ${loaded.agenda.length} agenda item(s), ${loaded.watches.length} watch(es), inbox=${loaded.inbox.collection}`
  )

  const session = createSessionManager({
    stateDir: env.stateDir,
    workdir: env.workdir,
    turnTimeoutMs: loaded.session.turnTimeoutMs,
    // Ordered fallback providers injected by the watchdog — the in-pod turn
    // fails over on a transient primary failure, like the scheduled executor.
    fallbackEnvs: env.providerFallbacks,
  })

  const pump = createActionPump({ api, getConfig: config.get })
  const compactor = createCompactor({ session, pump, getConfig: config.get })
  const transcript = createTranscript({ api, getConfig: config.get })

  const loop = createEventLoop({
    api,
    session,
    pump,
    compactor,
    transcript,
    getConfig: config.get,
    maybeRefreshConfig: config.maybeRefresh,
  })

  const subAgents = createSubAgentPool({
    maxConcurrent: loaded.subAgents.maxConcurrent,
    workdir: env.workdir,
    fallbackEnvs: env.providerFallbacks,
    onComplete: (result) => loop.enqueueSubAgentResult(result),
  })
  loop.attachSubAgents(subAgents)

  const heartbeat = createHeartbeat({
    api,
    getConfig: config.get,
    getStatus: loop.getStatus,
  })

  installSignalHandlers({ loop, heartbeat })

  heartbeat.start()
  loop.start()
  log.info(`Resident runtime is live (session ${session.getSessionId() ?? `fresh`})`)

  return { loop, heartbeat }
}

// Entrypoint guard: run only as the pod main process, never on test import.
// The bundle is CJS (require.main from @types/node globals), so this works
// under bare `node dist/index.js`; in the ESM test runner `require` is
// undefined and the guard short-circuits.
if (
  typeof require !== `undefined` &&
  typeof module !== `undefined` &&
  require.main === module
) {
  startResident().catch((err) => {
    log.error(`Resident runtime failed to start:`, err)
    process.exit(1)
  })
}
