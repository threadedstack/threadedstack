import type { TAgentAction } from '@tdsk/domain'
import type {
  TPumpReport,
  TResidentApi,
  TResidentConfig,
  TAuthorSecretRequest,
  TAuthorEndpointRequest,
  TAuthorFunctionRequest,
} from './types/resident.types'

import { log } from './log'
import {
  parseActionsBlock,
  MemoriesBlockFence,
  extractLastFencedBlock,
} from '@tdsk/domain'
import {
  DispatchMaxAttempts,
  DispatchRetryDelaysMs,
  DefaultAuthorLanguage,
  AuthorSecretBlockFence,
  AuthorFunctionBlockFence,
  AuthorEndpointBlockFence,
  DispatchMaxActionsPerCall,
} from './constants'

export type TActionPumpOpts = {
  api: TResidentApi
  getConfig: () => TResidentConfig
  chunkSize?: number
  maxAttempts?: number
  retryDelaysMs?: number[]
  /** Injectable backoff sleeper for tests. */
  sleepFn?: (ms: number) => Promise<void>
}

export type TActionPump = {
  /** Parse + dispatch every effect in one turn's output. */
  pump: (outputText: string) => Promise<TPumpReport>
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Extract ```tdsk-memories``` entries and convert them into `writeMemory`
 * dispatch actions when that Function name is configured. The platform side
 * (clamping, kind validation) belongs to the Function — the pump only drops
 * entries without a non-empty text.
 */
const extractMemoryActions = (
  text: string,
  writeMemoryFn: string | undefined
): { actions: TAgentAction[]; skipped: number } => {
  const block = extractLastFencedBlock(text, MemoriesBlockFence)
  if (block === undefined) return { actions: [], skipped: 0 }

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return { actions: [], skipped: 0 }
  }
  if (!Array.isArray(parsed)) return { actions: [], skipped: 0 }

  const entries = parsed.filter(
    (raw): raw is Record<string, unknown> =>
      Boolean(raw) &&
      typeof raw === `object` &&
      typeof (raw as any).text === `string` &&
      (raw as any).text.trim().length > 0
  )
  if (!entries.length) return { actions: [], skipped: 0 }

  if (!writeMemoryFn) {
    // Config-driven, no platform assumption: without a configured writeMemory
    // Function the memories are logged and skipped, never silently dropped.
    log.warn(
      `Turn emitted ${entries.length} tdsk-memories entr${entries.length === 1 ? `y` : `ies`} but no functions.writeMemory is configured — skipping`
    )
    return { actions: [], skipped: entries.length }
  }

  return {
    skipped: 0,
    actions: entries.map((entry) => ({
      function: writeMemoryFn,
      args: {
        text: entry.text,
        ...(typeof entry.importance === `number` ? { importance: entry.importance } : {}),
        ...(typeof entry.kind === `string` ? { kind: entry.kind } : {}),
        ...(entry.meta && typeof entry.meta === `object` ? { meta: entry.meta } : {}),
      },
    })),
  }
}

/**
 * Parse the resident-local ```tdsk-author-function``` fence (spec §5.1 fast
 * path) — mirror of the tdsk-spawn fence pattern: a JSON object or array of
 * `{ name, description?, language?, content }` submissions. Entries missing a
 * non-empty name or content are dropped; language defaults to javascript.
 */
export const parseAuthorFunctionBlock = (text: string): TAuthorFunctionRequest[] => {
  const block = extractLastFencedBlock(text, AuthorFunctionBlockFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]

  const requests: TAuthorFunctionRequest[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== `object` || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== `string` || !item.name.trim().length) continue
    if (typeof item.content !== `string` || !item.content.trim().length) continue
    requests.push({
      name: item.name.trim(),
      content: item.content,
      language:
        typeof item.language === `string` && item.language.length
          ? item.language
          : DefaultAuthorLanguage,
      description:
        typeof item.description === `string` && item.description.length
          ? item.description
          : undefined,
    })
  }
  return requests
}

/**
 * Parse the resident-local ```tdsk-author-endpoint``` fence — a JSON object or
 * array of `{ name, path, type?, options, headers?, description? }`
 * submissions, POSTed to the R3 author-endpoint endpoint. Entries missing a
 * non-empty name or an `options.url` are dropped (the platform manufactures a
 * proxy Endpoint, which requires a target URL). Mirrors the exact structure of
 * `parseAuthorFunctionBlock`.
 */
export const parseAuthorEndpointBlock = (text: string): TAuthorEndpointRequest[] => {
  const block = extractLastFencedBlock(text, AuthorEndpointBlockFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]

  const requests: TAuthorEndpointRequest[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== `object` || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== `string` || !item.name.trim().length) continue
    if (!item.options || typeof item.options !== `object` || Array.isArray(item.options))
      continue
    const options = item.options as Record<string, unknown>
    if (typeof options.url !== `string` || !options.url.trim().length) continue
    requests.push({
      name: item.name.trim(),
      path:
        typeof item.path === `string` && item.path.trim().length ? item.path.trim() : ``,
      options,
      type: typeof item.type === `string` && item.type.length ? item.type : undefined,
      headers:
        item.headers && typeof item.headers === `object` && !Array.isArray(item.headers)
          ? (item.headers as Record<string, string>)
          : undefined,
      description:
        typeof item.description === `string` && item.description.length
          ? item.description
          : undefined,
    })
  }
  return requests
}

/**
 * Parse the resident-local ```tdsk-author-secret``` fence — a JSON object or
 * array of `{ name, value, description? }` submissions, POSTed to the R3
 * author-secret endpoint. Entries missing a non-empty name or value are
 * dropped. Mirrors the exact structure of `parseAuthorFunctionBlock`.
 *
 * SECURITY: the `value` is a real credential — it is preserved byte-for-byte
 * (never trimmed) and MUST never be logged. Only the name is ever logged.
 */
export const parseAuthorSecretBlock = (text: string): TAuthorSecretRequest[] => {
  const block = extractLastFencedBlock(text, AuthorSecretBlockFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]

  const requests: TAuthorSecretRequest[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== `object` || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== `string` || !item.name.trim().length) continue
    if (typeof item.value !== `string` || !item.value.length) continue
    requests.push({
      name: item.name.trim(),
      // Preserve the credential exactly — never trim/mutate the value.
      value: item.value,
      description:
        typeof item.description === `string` && item.description.length
          ? item.description
          : undefined,
    })
  }
  return requests
}

/**
 * The action pump: parse ```tdsk-actions``` (the shared ② parser) +
 * ```tdsk-memories``` + ```tdsk-author-function``` out of EVERY turn's output
 * and POST them to the R1 dispatch / R3 author-function endpoints immediately
 * — dispatches chunked to the endpoint's 20-action cap, retried with backoff
 * on transport/5xx failures, every action's result logged. 4xx responses are
 * terminal (a malformed request never heals by retrying). Author submissions
 * are single-shot: a scan/collision rejection is logged and counted, and the
 * session can rephrase and re-emit on a later turn.
 */
export const createActionPump = (opts: TActionPumpOpts): TActionPump => {
  const { api, getConfig } = opts
  const sleepFn = opts.sleepFn ?? defaultSleep
  const chunkSize = opts.chunkSize ?? DispatchMaxActionsPerCall
  const maxAttempts = opts.maxAttempts ?? DispatchMaxAttempts
  const retryDelaysMs = opts.retryDelaysMs ?? DispatchRetryDelaysMs

  const dispatchChunk = async (chunk: TAgentAction[]) => {
    let lastError: string | undefined
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0)
        await sleepFn(
          retryDelaysMs[attempt - 1] ?? retryDelaysMs[retryDelaysMs.length - 1] ?? 1000
        )

      const res = await api.dispatch(chunk)
      if (res.ok) return res

      lastError = res.error ?? `status ${res.status}`
      // Client errors are terminal; transport (status 0) and 5xx retry
      if (res.status >= 400 && res.status < 500) break
      log.warn(
        `Dispatch attempt ${attempt + 1}/${maxAttempts} failed (${lastError}) — ${
          attempt + 1 < maxAttempts ? `retrying` : `giving up`
        }`
      )
    }
    return { ok: false as const, status: 0, error: lastError }
  }

  return {
    pump: async (outputText: string): Promise<TPumpReport> => {
      const config = getConfig()
      const actions = parseActionsBlock(outputText)
      const memories = extractMemoryActions(outputText, config.functions?.writeMemory)
      const all = [...actions, ...memories.actions]

      const report: TPumpReport = {
        total: all.length,
        dispatched: 0,
        failed: 0,
        allowlistRejected: 0,
        memoriesSkipped: memories.skipped,
        functionsAuthored: 0,
        functionsRejected: 0,
        secretsStored: 0,
        secretsRejected: 0,
        endpointsAuthored: 0,
        endpointsRejected: 0,
      }

      // Self-extension fast path: POST each authored Function to the R3
      // author endpoint. Single-shot on purpose — a rejection (scan,
      // validation, collision) is terminal for this turn.
      for (const request of parseAuthorFunctionBlock(outputText)) {
        const res = await api.authorFunction(request)
        if (res.ok) {
          report.functionsAuthored += 1
          log.info(
            `Authored function ${request.name}${res.data?.id ? ` (${res.data.id})` : ``}`
          )
        } else {
          report.functionsRejected += 1
          log.warn(
            `authorFunction ${request.name} rejected: ${res.error ?? `status ${res.status}`}`
          )
        }
      }

      // Self-credential fast path: store each obtained credential as the
      // agent's OWN encrypted Secret. Secrets are authored BEFORE endpoints so
      // an endpoint authored the same turn can reference a secret by id. The
      // secret VALUE is never logged — only its name.
      for (const request of parseAuthorSecretBlock(outputText)) {
        const res = await api.authorSecret(request)
        if (res.ok) {
          report.secretsStored += 1
          log.info(
            `Stored secret ${request.name}${
              res.data?.secretId ? ` (${res.data.secretId})` : ``
            }`
          )
        } else {
          report.secretsRejected += 1
          log.warn(
            `authorSecret ${request.name} rejected: ${res.error ?? `status ${res.status}`}`
          )
        }
      }

      // Self-extension fast path for proxy Endpoints: POST each authored
      // Endpoint to the R3 author-endpoint endpoint. Single-shot on purpose —
      // a rejection (scan, validation, SSRF guard, collision) is terminal for
      // this turn.
      for (const request of parseAuthorEndpointBlock(outputText)) {
        const res = await api.authorEndpoint(request)
        if (res.ok) {
          report.endpointsAuthored += 1
          log.info(
            `Authored endpoint ${request.name}${res.data?.id ? ` (${res.data.id})` : ``}`
          )
        } else {
          report.endpointsRejected += 1
          log.warn(
            `authorEndpoint ${request.name} rejected: ${res.error ?? `status ${res.status}`}`
          )
        }
      }

      if (!all.length) return report

      for (let i = 0; i < all.length; i += chunkSize) {
        const chunk = all.slice(i, i + chunkSize)
        const res = await dispatchChunk(chunk)

        if (!res.ok || !res.data) {
          report.failed += chunk.length
          log.error(
            `Dispatch failed for ${chunk.length} action(s): ${res.error ?? `unknown`}`
          )
          continue
        }

        chunk.forEach((action, idx) => {
          const result = res.data?.[idx]
          if (result?.ok) {
            report.dispatched += 1
            log.info(`Dispatched action ${action.function}`)
          } else {
            report.failed += 1
            const error = result?.error ?? `no result returned`
            if (/not allowed/i.test(error)) report.allowlistRejected += 1
            log.warn(`Action ${action.function} rejected: ${error}`)
          }
        })
      }

      return report
    },
  }
}
