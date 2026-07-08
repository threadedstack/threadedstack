import type { TCompactor } from './compactor'
import type { TActionPump } from './pump'
import type { TSessionManager } from './session'
import type { TSubAgentPool } from './subagents'
import type { TTranscript } from './transcript'
import type {
  TInboxMessage,
  TResidentApi,
  TResidentEvent,
  TResidentConfig,
  TResidentStatus,
  TSubAgentResult,
} from './types/resident.types'

import { createHash } from 'node:crypto'

import { log } from './log'
import { EQueryOp } from '@tdsk/domain'
import { parseNextRun } from '@tdsk/domain'
import { parseSpawnBlock } from './subagents'
import { renderContextSources } from './contextSources'
import { EResidentEventKind } from './types/resident.types'
import {
  ScanIntervalMs,
  InboxQueryLimit,
  SeenMessagesMax,
  DefaultWatchPollMs,
  WatchRecordsMaxChars,
  DefaultWatchDebounceMs,
} from './constants'

/** Priority per event kind — lower runs first; FIFO within a priority. */
const EventPriority: Record<EResidentEventKind, number> = {
  [EResidentEventKind.agenda]: 0,
  [EResidentEventKind.inbox]: 1,
  [EResidentEventKind.internal]: 1,
  [EResidentEventKind.watch]: 2,
  [EResidentEventKind.selfDirected]: 3,
}

export type TEventLoopDeps = {
  api: TResidentApi
  getConfig: () => TResidentConfig
  /** Throttled config refresh, called once per scan pass. */
  maybeRefreshConfig?: () => Promise<void>
  session: TSessionManager
  pump: TActionPump
  compactor: TCompactor
  transcript?: TTranscript
  /** Set after construction (the pool's onComplete points back at the loop). */
  subAgents?: TSubAgentPool
  nowFn?: () => number
  scanIntervalMs?: number
}

export type TEventLoop = {
  start: () => void
  /** SIGTERM contract: stop scans, finish the in-flight turn, checkpoint. */
  shutdown: () => Promise<void>
  /** One scan pass over agenda/inbox/watches/self-directed (test seam + tick body). */
  scan: () => Promise<void>
  /** Run the highest-priority queued event; false when idle/empty (test seam + tick body). */
  runNext: () => Promise<boolean>
  enqueue: (event: Omit<TResidentEvent, `enqueuedAt` | `seq`>) => void
  /** Sub-agent completions enter the queue here (inbox priority). */
  enqueueSubAgentResult: (result: TSubAgentResult) => void
  attachSubAgents: (pool: TSubAgentPool) => void
  getQueueDepth: () => number
  getStatus: () => TResidentStatus
  isRunning: () => boolean
}

type TWatchState = {
  lastPolledAt: number
  lastFiredAt: number
  /** Hash of the last SEEN result set (baseline set on first poll — no fire on boot). */
  lastHash?: string
  primed: boolean
}

const hashRecords = (records: unknown): string =>
  createHash(`sha1`).update(JSON.stringify(records)).digest(`hex`)

/**
 * The serialized event loop — the resident's heart. A single-flight turn
 * executor drains a priority queue fed by four sources:
 *
 *   AGENDA        mandatory cron work; overdue items preempt everything
 *   INBOX         agent_messages addressed to this agent (+ sub-agent completions)
 *   WATCHES       records queries that fire on change (hash + debounce)
 *   SELF-DIRECTED fires only after the queue has been empty ≥ minIdleMs —
 *                 idle time IS work time (autonomy §1.1: an idle resident is a bug)
 *
 * Turns are strictly serialized; long work belongs in sub-agents so the
 * resident stays responsive. Queue depth is exposed for the heartbeat.
 */
export const createEventLoop = (deps: TEventLoopDeps): TEventLoop => {
  const { api, session, pump, compactor, transcript, getConfig } = deps
  const nowFn = deps.nowFn ?? Date.now
  const scanIntervalMs = deps.scanIntervalMs ?? ScanIntervalMs

  let subAgents = deps.subAgents
  let queue: TResidentEvent[] = []
  let seq = 0
  let running = false
  let stopped = false
  let scanning = false
  let inFlight: Promise<void> | null = null
  let timer: ReturnType<typeof setInterval> | undefined

  let turnCount = 0
  let lastTurnAt: string | undefined
  let currentActivity = `idle`
  let lastActivityAt = nowFn()
  let lastInboxPollAt = 0

  const agendaNextRun = new Map<string, number>()
  const watchStates = new Map<string, TWatchState>()
  const seenMessages: string[] = []
  const seenMessageSet = new Set<string>()

  const pendingKey = (kind: EResidentEventKind, key: string) => `${kind}:${key}`
  const pendingKeys = new Set<string>()

  const rememberMessage = (id: string) => {
    if (seenMessageSet.has(id)) return
    seenMessageSet.add(id)
    seenMessages.push(id)
    while (seenMessages.length > SeenMessagesMax) {
      const evicted = seenMessages.shift() as string
      seenMessageSet.delete(evicted)
    }
  }

  const dropPendingSelfDirected = () => {
    queue = queue.filter((event) => {
      if (event.kind !== EResidentEventKind.selfDirected) return true
      pendingKeys.delete(pendingKey(event.kind, event.key))
      return false
    })
  }

  const enqueue: TEventLoop[`enqueue`] = (event) => {
    const dedupeKey = pendingKey(event.kind, event.key)
    if (pendingKeys.has(dedupeKey)) return

    // Real work supersedes a queued self-directed turn
    if (event.kind !== EResidentEventKind.selfDirected) dropPendingSelfDirected()

    pendingKeys.add(dedupeKey)
    queue.push({ ...event, enqueuedAt: nowFn(), seq: ++seq })
    log.info(`Enqueued ${event.kind}:${event.key} (queue depth ${queue.length})`)
  }

  const dequeue = (): TResidentEvent | undefined => {
    if (!queue.length) return undefined
    let best = 0
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i]
      const b = queue[best]
      if (
        EventPriority[a.kind] < EventPriority[b.kind] ||
        (EventPriority[a.kind] === EventPriority[b.kind] && a.seq < b.seq)
      )
        best = i
    }
    const [event] = queue.splice(best, 1)
    pendingKeys.delete(pendingKey(event.kind, event.key))
    return event
  }

  // ── SCAN SOURCES ─────────────────────────────────────────────────────

  const scanAgenda = () => {
    const now = nowFn()
    const config = getConfig()
    const liveKeys = new Set<string>()

    for (const item of config.agenda) {
      liveKeys.add(item.key)
      let nextRunAt = agendaNextRun.get(item.key)
      if (nextRunAt === undefined) {
        // First sighting: schedule forward from now (no boot-storm of "missed" runs)
        nextRunAt = parseNextRun(item.cron, new Date(now)).getTime()
        agendaNextRun.set(item.key, nextRunAt)
      }

      if (now >= nextRunAt) {
        enqueue({
          kind: EResidentEventKind.agenda,
          key: item.key,
          prompt: item.prompt,
        })
        agendaNextRun.set(item.key, parseNextRun(item.cron, new Date(now)).getTime())
      }
    }

    // Prune agenda items removed from config
    for (const key of agendaNextRun.keys())
      if (!liveKeys.has(key)) agendaNextRun.delete(key)
  }

  const scanInbox = async () => {
    const now = nowFn()
    const config = getConfig()
    if (now - lastInboxPollAt < config.inbox.pollMs) return
    lastInboxPollAt = now

    const res = await api.queryRecords(config.inbox.collection, {
      where: [{ field: `to`, op: EQueryOp.eq, value: config.agentId }],
      limit: InboxQueryLimit,
    })
    if (!res.ok) {
      log.warn(`Inbox poll failed: ${res.error ?? res.status}`)
      return
    }

    const unread: TInboxMessage[] = (res.data ?? []).filter(
      (record) => !record.data?.readAt && !seenMessageSet.has(record.id)
    )
    if (!unread.length) return

    for (const message of unread) rememberMessage(message.id)
    enqueue({
      kind: EResidentEventKind.inbox,
      key: `messages-${unread[0].id}`,
      messages: unread,
    })
  }

  const scanWatches = async () => {
    const now = nowFn()
    const config = getConfig()
    const liveKeys = new Set<string>()

    for (const watch of config.watches) {
      liveKeys.add(watch.key)
      let state = watchStates.get(watch.key)
      if (!state) {
        state = { lastPolledAt: 0, lastFiredAt: 0, primed: false }
        watchStates.set(watch.key, state)
      }

      const pollMs = watch.pollMs ?? DefaultWatchPollMs
      if (now - state.lastPolledAt < pollMs) continue
      state.lastPolledAt = now

      const res = await api.queryRecords(watch.collection, watch.query)
      if (!res.ok) {
        log.warn(`Watch ${watch.key} poll failed: ${res.error ?? res.status}`)
        continue
      }

      const documents = (res.data ?? []).map((record) => ({
        id: record.id,
        ...(record.data as Record<string, unknown>),
      }))
      const hash = hashRecords(documents)

      if (!state.primed) {
        // First poll is the baseline — watches fire on CHANGE, not on boot
        state.primed = true
        state.lastHash = hash
        continue
      }
      if (hash === state.lastHash) continue

      const debounceMs = watch.debounceMs ?? DefaultWatchDebounceMs
      if (now - state.lastFiredAt < debounceMs) continue

      state.lastHash = hash
      state.lastFiredAt = now
      enqueue({
        kind: EResidentEventKind.watch,
        key: watch.key,
        prompt: watch.prompt,
        records: documents,
      })
    }

    for (const key of watchStates.keys()) if (!liveKeys.has(key)) watchStates.delete(key)
  }

  const maybeSelfDirected = () => {
    const config = getConfig()
    if (!config.selfDirected.prompt) return
    if (queue.length || running) return
    if (nowFn() - lastActivityAt < config.selfDirected.minIdleMs) return

    enqueue({
      kind: EResidentEventKind.selfDirected,
      key: `self-directed`,
      prompt: config.selfDirected.prompt,
    })
  }

  // ── TURN EXECUTION ───────────────────────────────────────────────────

  const buildFraming = (event: TResidentEvent): string => {
    switch (event.kind) {
      case EResidentEventKind.agenda:
        return `# Agenda: ${event.key}\n\n${event.prompt}`
      case EResidentEventKind.inbox: {
        const messages = (event.messages ?? []).map((message) => ({
          id: message.id,
          ...message.data,
        }))
        return [
          `# Inbox — ${messages.length} new message(s) addressed to you`,
          JSON.stringify(messages, null, 2),
          `Process each message and take the appropriate actions.`,
        ].join(`\n\n`)
      }
      case EResidentEventKind.internal:
        return `# Sub-agent completed: ${event.key}\n\n${event.detail ?? ``}`
      case EResidentEventKind.watch: {
        const body = JSON.stringify(event.records ?? [], null, 2)
        const capped =
          body.length > WatchRecordsMaxChars ? body.slice(0, WatchRecordsMaxChars) : body
        return `# Watch fired: ${event.key}\n\n${event.prompt}\n\n## Matched records\n${capped}`
      }
      case EResidentEventKind.selfDirected:
        return `# Self-directed turn\n\n${event.prompt}`
    }
  }

  const buildTurnInput = async (event: TResidentEvent): Promise<string> => {
    const config = getConfig()
    const sections: string[] = []

    if (!session.hasSession()) {
      // First turn of a session: seed identity + directives + checkpoint summary
      if (config.session.seedPrompt) sections.push(config.session.seedPrompt)
      if (config.session.standingDirectives)
        sections.push(`## Standing directives\n${config.session.standingDirectives}`)
      const summary = session.getCheckpointSummary()
      if (summary) sections.push(`## Previous session checkpoint\n${summary}`)
    }

    const context = await renderContextSources(api, config.session.contextSources)
    if (context) sections.push(context.trimEnd())

    sections.push(buildFraming(event))
    return sections.join(`\n\n`)
  }

  const markMessagesRead = async (event: TResidentEvent) => {
    const config = getConfig()
    const messages = event.messages ?? []
    if (!messages.length) return

    const markReadFn = config.functions?.markMessageRead
    const readAt = new Date().toISOString()

    if (markReadFn) {
      const res = await api.dispatch(
        messages.map((message) => ({ function: markReadFn, args: { id: message.id } }))
      )
      if (!res.ok) log.warn(`markMessageRead dispatch failed: ${res.error ?? res.status}`)
      return
    }

    // No Function configured — patch readAt straight through the records API.
    // Refire protection also rides the in-memory seen set either way.
    for (const message of messages) {
      const res = await api.upsertRecord(config.inbox.collection, {
        id: message.id,
        data: { ...message.data, readAt },
      })
      if (!res.ok)
        log.warn(`Failed to mark message ${message.id} read: ${res.error ?? res.status}`)
    }
  }

  const runNext = async (): Promise<boolean> => {
    if (running) return false
    const event = dequeue()
    if (!event) return false

    running = true
    currentActivity = `${event.kind}:${event.key}`
    const turn = (async () => {
      try {
        const input = await buildTurnInput(event)
        const result = await session.runTurn(input)
        turnCount += 1
        lastTurnAt = new Date().toISOString()

        if (!result.ok)
          log.warn(
            `Turn ${currentActivity} did not complete cleanly: ${result.error ?? `unknown`}`
          )

        await transcript?.append({
          event: currentActivity,
          input,
          output: result.output,
        })

        await pump.pump(result.output)

        if (subAgents)
          for (const request of parseSpawnBlock(result.output)) {
            const spawned = subAgents.spawnSubAgent(request)
            if (!spawned.ok)
              log.warn(
                `Sub-agent spawn refused (${request.key ?? `unnamed`}): ${spawned.error}`
              )
          }

        if (event.kind === EResidentEventKind.inbox) await markMessagesRead(event)

        if (compactor.shouldCompact()) await compactor.compact()
      } catch (err) {
        log.error(`Turn ${currentActivity} failed:`, (err as Error).message)
      } finally {
        running = false
        currentActivity = `idle`
        lastActivityAt = nowFn()
        inFlight = null
        // A completed turn is activity — any queued self-directed intent is stale
        dropPendingSelfDirected()
      }
    })()
    inFlight = turn
    await turn
    return true
  }

  const scan = async () => {
    await deps.maybeRefreshConfig?.()
    scanAgenda()
    await scanInbox()
    await scanWatches()
    maybeSelfDirected()
  }

  const tick = async () => {
    if (stopped || scanning) return
    scanning = true
    try {
      await scan()
    } catch (err) {
      log.error(`Scan failed:`, (err as Error).message)
    } finally {
      scanning = false
    }
    if (!running && queue.length)
      void runNext().catch((err) => log.error(`runNext failed:`, err))
  }

  return {
    scan,
    runNext,
    enqueue,
    isRunning: () => running,
    getQueueDepth: () => queue.length,
    attachSubAgents: (pool) => {
      subAgents = pool
    },

    enqueueSubAgentResult: (result) => {
      enqueue({
        kind: EResidentEventKind.internal,
        key: result.key,
        detail: [
          `ok: ${result.ok}${result.timedOut ? ` (timed out)` : ``}, exit: ${result.exitCode ?? `n/a`}, duration: ${Math.round(result.durationMs / 1000)}s`,
          `## Output (tail)`,
          result.output,
        ].join(`\n\n`),
      })
    },

    getStatus: () => ({
      sessionId: session.getSessionId(),
      queueDepth: queue.length,
      currentActivity,
      lastTurnAt,
      turnCount,
    }),

    start: () => {
      if (timer) return
      stopped = false
      timer = setInterval(() => {
        void tick()
      }, scanIntervalMs)
      // Ref'd ON PURPOSE: this interval is what keeps the resident process
      // alive — an unref'd timer let Node exit 0 right after boot (live
      // failure 2026-07-08, pods Completed minutes after "runtime is live").
      // Tests stop the loop via shutdown(), which clears the interval.
      log.info(`Event loop started (scan every ${scanIntervalMs}ms)`)
    },

    shutdown: async () => {
      stopped = true
      if (timer) clearInterval(timer)
      timer = undefined

      // The rolling-restart contract: finish the current turn, checkpoint, exit
      if (inFlight) {
        log.info(`Shutdown: waiting for in-flight turn to finish`)
        await inFlight
      }
      if (session.hasSession()) {
        log.info(`Shutdown: writing checkpoint`)
        await compactor.compact()
      }
      log.info(`Event loop shut down (queue depth ${queue.length} at exit)`)
    },
  }
}
