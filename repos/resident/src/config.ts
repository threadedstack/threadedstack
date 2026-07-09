import type {
  TResidentApi,
  TResidentEnv,
  TResidentConfig,
  TProviderFallback,
} from './types/resident.types'

import { log } from './log'
import { isValidCron, EQueryOp } from '@tdsk/domain'
import {
  DefaultWorkdir,
  DefaultStateDir,
  DefaultMaxTurns,
  DefaultMaxBytes,
  ConfigRefreshMs,
  DefaultMinIdleMs,
  ResidentTokenEnvVar,
  DefaultInboxPollMs,
  ResidentOrgIdEnvVar,
  ResidentConfigEnvVar,
  ResidentAgentIdEnvVar,
  ResidentWorkdirEnvVar,
  ResidentStateDirEnvVar,
  ResidentConfigCollection,
  ResidentProjectIdEnvVar,
  DefaultInboxCollection,
  ResidentBackendUrlEnvVar,
  DefaultSubAgentMaxConcurrent,
  ResidentProviderFallbacksEnvVar,
} from './constants'

/**
 * Parse the ordered fallback provider envs injected by the watchdog. Never
 * fatal — a missing or malformed value yields `[]` (no failover) with a warn,
 * so a bad env can't stop the resident booting.
 */
const parseProviderFallbacks = (raw?: string): TProviderFallback[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (fb): fb is TProviderFallback =>
        Boolean(fb) &&
        typeof fb.brand === `string` &&
        Boolean(fb.env) &&
        typeof fb.env === `object`
    )
  } catch (err) {
    log.warn(
      `${ResidentProviderFallbacksEnvVar} is not valid JSON — no provider failover: ${
        (err as Error).message
      }`
    )
    return []
  }
}

/**
 * Read + validate the pod env contract. TDSK_RESIDENT_AGENT_ID rides the pod
 * manifest (podManifest.ts); TDSK_RESIDENT_TOKEN + TDSK_BACKEND_URL are minted/
 * injected at pod start (residentToken.ts); org + project scope the records and
 * dispatch URLs, injected alongside the token. TDSK_RESIDENT_CONFIG carries the
 * agent's resident_configs record as JSON, injected by the watchdog at pod
 * start so boot is network-free — the records API only REFRESHES it.
 */
export const readResidentEnv = (
  env: Record<string, string | undefined> = process.env
): TResidentEnv => {
  const configJson = env[ResidentConfigEnvVar]
  const inline = configJson ? parseInlineConfig(configJson) : undefined

  const agentId = env[ResidentAgentIdEnvVar] ?? inline?.agentId
  const token = env[ResidentTokenEnvVar]
  const backendUrl = env[ResidentBackendUrlEnvVar]
  const orgId = env[ResidentOrgIdEnvVar] ?? inline?.orgId
  const projectId = env[ResidentProjectIdEnvVar] ?? inline?.projectId

  const missing: string[] = []
  if (!agentId) missing.push(ResidentAgentIdEnvVar)
  if (!token) missing.push(ResidentTokenEnvVar)
  if (!backendUrl) missing.push(ResidentBackendUrlEnvVar)
  if (!orgId) missing.push(ResidentOrgIdEnvVar)
  if (!projectId) missing.push(ResidentProjectIdEnvVar)
  if (missing.length)
    throw new Error(`Missing required resident env: ${missing.join(`, `)}`)

  return {
    agentId,
    token,
    backendUrl,
    orgId,
    projectId,
    configJson,
    providerFallbacks: parseProviderFallbacks(env[ResidentProviderFallbacksEnvVar]),
    stateDir: env[ResidentStateDirEnvVar] || DefaultStateDir,
    workdir: env[ResidentWorkdirEnvVar] || DefaultWorkdir,
  }
}

const parseInlineConfig = (json: string): Partial<TResidentConfig> => {
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === `object` && !Array.isArray(parsed))
      return parsed as Partial<TResidentConfig>
  } catch (err) {
    throw new Error(
      `${ResidentConfigEnvVar} is not valid JSON: ${(err as Error).message}`
    )
  }
  throw new Error(`${ResidentConfigEnvVar} must be a JSON object`)
}

/**
 * Normalize a raw config document into a fully-defaulted TResidentConfig.
 * Invalid agenda items (bad cron, missing key/prompt) and malformed watches are
 * dropped with a warning — one bad entry never takes the resident down.
 */
export const normalizeResidentConfig = (
  raw: Partial<TResidentConfig> | undefined,
  agentId: string
): TResidentConfig => {
  const cfg = raw ?? {}

  const agenda = (Array.isArray(cfg.agenda) ? cfg.agenda : []).filter((item) => {
    const valid =
      item &&
      typeof item.key === `string` &&
      item.key.length &&
      typeof item.prompt === `string` &&
      item.prompt.length &&
      typeof item.cron === `string` &&
      isValidCron(item.cron)
    if (!valid) log.warn(`Dropping invalid agenda item:`, JSON.stringify(item))
    return valid
  })

  const watches = (Array.isArray(cfg.watches) ? cfg.watches : []).filter((watch) => {
    const valid =
      watch &&
      typeof watch.key === `string` &&
      watch.key.length &&
      typeof watch.collection === `string` &&
      watch.collection.length &&
      typeof watch.prompt === `string` &&
      watch.prompt.length
    if (!valid) log.warn(`Dropping invalid watch:`, JSON.stringify(watch))
    return valid
  })

  return {
    agentId,
    orgId: cfg.orgId,
    projectId: cfg.projectId,
    agenda,
    watches,
    inbox: {
      pollMs: cfg.inbox?.pollMs ?? DefaultInboxPollMs,
      collection: cfg.inbox?.collection ?? DefaultInboxCollection,
    },
    compaction: {
      maxTurns: cfg.compaction?.maxTurns ?? DefaultMaxTurns,
      maxBytes: cfg.compaction?.maxBytes ?? DefaultMaxBytes,
    },
    session: {
      seedPrompt: cfg.session?.seedPrompt,
      standingDirectives: cfg.session?.standingDirectives,
      contextSources: cfg.session?.contextSources ?? [],
      turnTimeoutMs: cfg.session?.turnTimeoutMs,
    },
    subAgents: {
      maxConcurrent: cfg.subAgents?.maxConcurrent ?? DefaultSubAgentMaxConcurrent,
    },
    selfDirected: {
      prompt: cfg.selfDirected?.prompt ?? ``,
      minIdleMs: cfg.selfDirected?.minIdleMs ?? DefaultMinIdleMs,
    },
    functions: cfg.functions ?? {},
  }
}

export type TConfigManager = {
  load: () => Promise<TResidentConfig>
  get: () => TResidentConfig
  /** Throttled re-fetch from the records API; failures keep the last good config. */
  maybeRefresh: () => Promise<void>
}

export type TConfigManagerOpts = {
  env: TResidentEnv
  api: TResidentApi
  refreshMs?: number
  nowFn?: () => number
}

/**
 * Boot + refresh the resident config. Precedence:
 *  - BOOT: the TDSK_RESIDENT_CONFIG env JSON injected at pod start — boot is
 *    network-free and MUST succeed with the env config alone. When the env is
 *    absent (tests/legacy) load() fetches the record instead.
 *  - REFRESH: the `resident_configs` record for this agentId (records query
 *    API), re-fetched periodically. A failed refresh keeps the last good
 *    config — it is never fatal.
 */
export const createConfigManager = (opts: TConfigManagerOpts): TConfigManager => {
  const { env, api } = opts
  const nowFn = opts.nowFn ?? Date.now
  const refreshMs = opts.refreshMs ?? ConfigRefreshMs

  let current: TResidentConfig | undefined
  let lastFetchedAt = 0

  const fetchFromRecords = async (): Promise<TResidentConfig> => {
    const res = await api.queryRecords(ResidentConfigCollection, {
      where: [{ field: `agentId`, op: EQueryOp.eq, value: env.agentId }],
      limit: 1,
    })
    if (!res.ok)
      throw new Error(`Failed to load resident config: ${res.error ?? res.status}`)
    const record = res.data?.[0]
    if (!record)
      throw new Error(
        `No ${ResidentConfigCollection} record found for agent ${env.agentId}`
      )
    return normalizeResidentConfig(record.data as Partial<TResidentConfig>, env.agentId)
  }

  return {
    load: async () => {
      current = env.configJson
        ? normalizeResidentConfig(parseInlineConfig(env.configJson), env.agentId)
        : await fetchFromRecords()
      lastFetchedAt = nowFn()
      return current
    },

    get: () => {
      if (!current) throw new Error(`Resident config not loaded — call load() first`)
      return current
    },

    maybeRefresh: async () => {
      if (!current) return
      if (nowFn() - lastFetchedAt < refreshMs) return
      lastFetchedAt = nowFn()
      try {
        current = await fetchFromRecords()
      } catch (err) {
        log.warn(
          `Config refresh failed (keeping last good config):`,
          (err as Error).message
        )
      }
    },
  }
}
