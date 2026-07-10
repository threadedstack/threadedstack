import type { TDatabase } from '@tdsk/database'
import type { TProxyEndpointConfig } from '@tdsk/domain'

import { scanText } from '@TBE/utils/agent/textScan'
import { assertSafeEgressUrl } from '@TBE/utils/proxy'
import {
  Exception,
  EEndpointType,
  SecretRefPattern,
  Endpoint as EndpointRecord,
  extractLastFencedBlock,
} from '@tdsk/domain'

/**
 * The structured-output fence an agent emits to build its OWN proxy Endpoint — a
 * JSON object or array of `{ name, path, type?, options, headers?, description? }`.
 * Mirrors `AuthorFunctionFence` so scheduled + resident agents author endpoints
 * identically.
 */
export const AuthorEndpointFence = `tdsk-author-endpoint`

/** One parsed author-an-Endpoint submission (before org/project/agent scope is applied). */
export type TAuthorEndpointSubmission = {
  name: string
  path: string
  type?: string
  options: Record<string, unknown>
  headers?: Record<string, string>
  description?: string
}

/**
 * Parse the LAST ```tdsk-author-endpoint``` fence out of a run's stdout — a JSON
 * object or array of submissions. Entries missing a non-empty name/path or an
 * options object are dropped; a missing/malformed block yields `[]` (no-op).
 */
export const parseAuthorEndpointBlock = (text: string): TAuthorEndpointSubmission[] => {
  const block = extractLastFencedBlock(text, AuthorEndpointFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]

  const out: TAuthorEndpointSubmission[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== `object` || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== `string` || !item.name.trim().length) continue
    if (typeof item.path !== `string` || !item.path.trim().length) continue
    if (!item.options || typeof item.options !== `object` || Array.isArray(item.options))
      continue
    out.push({
      name: item.name.trim(),
      path: item.path.trim(),
      options: item.options as Record<string, unknown>,
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
  return out
}

/** Endpoint names route by exact name — keep them identifier-shaped. */
export const EndpointNamePattern = /^[A-Za-z][A-Za-z0-9_-]*$/
export const MaxEndpointNameChars = 100
export const MaxAuthorDescriptionChars = 2000
export const MaxEndpointPathChars = 2000
/** Default HTTP method an authored proxy Endpoint routes on when omitted. */
export const DefaultAuthorEndpointMethod = `get`

export type TAuthorEndpointInput = {
  orgId: string
  projectId: string
  /** The authoring agent — stamped as `meta.authoredBy` and the invoke-time authorization key. */
  agentId: string
  name: string
  path: string
  options: Record<string, unknown>
  headers?: Record<string, string>
  description?: string
  /** Only `'proxy'` is permitted; any other value is rejected. */
  type?: string
}

export type TAuthorEndpointResult =
  | { ok: true; status: 200 | 201; endpoint: EndpointRecord; error?: undefined }
  | { ok: false; status: number; error: string; endpoint?: undefined }

/**
 * Collect EVERY secretId an Endpoint references — the direct `options.auth.secretId`
 * plus every `{{ NAME:secretId }}` template ANYWHERE in options or headers (oauth
 * tokenUrl/clientId/clientSecret/additionalParams/scopes, header values,
 * transform, …). Uses the CANONICAL resolver pattern (`SecretRefPattern` from
 * domain, dash-inclusive) so the author-time ownership check sees exactly the set
 * the runtime resolver will template — a narrower field list or regex (as an
 * earlier version had) let an agent smuggle a non-owned secret ref past the gate.
 * Every referenced secret MUST be owned by the SAME agent.
 */
const collectRefs = (value: unknown, ids: Set<string>): void => {
  if (typeof value === `string`) {
    for (const m of value.matchAll(SecretRefPattern)) ids.add(m[2])
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, ids)
    return
  }
  if (value && typeof value === `object`)
    for (const v of Object.values(value as Record<string, unknown>)) collectRefs(v, ids)
}

const collectSecretIds = (
  options: Record<string, unknown>,
  headers?: Record<string, unknown> | null
): string[] => {
  const ids = new Set<string>()
  const auth = options.auth as { secretId?: unknown } | undefined
  if (auth && typeof auth.secretId === `string` && auth.secretId.trim().length)
    ids.add(auth.secretId.trim())
  collectRefs(options, ids)
  if (headers) collectRefs(headers, ids)
  return [...ids]
}

/**
 * The single author-a-Endpoint core — the platform manufactures a project-scoped
 * proxy Endpoint from an agent submission `{ name, path, options, headers?,
 * description? }`. Shared by BOTH the resident `author-endpoint` endpoint AND the
 * scheduled executor's `tdsk-author-endpoint` fence, so every execution mode
 * authors through one vetted path.
 *
 * Endpoints reach EXTERNAL services, so this is the security-sensitive sibling of
 * `authorAgentFunctionCore` and layers extra gates on top of the shared ones:
 *   - `type` MUST be `'proxy'` (an agent may not author faas/agent endpoints),
 *   - `options.url` is REQUIRED and MUST pass the SSRF egress guard AT AUTHOR TIME
 *     (`assertSafeEgressUrl`) — an internal/private/metadata URL is rejected
 *     before any row is written,
 *   - `options.transform.injectSecrets` is REFUSED (that path templates secrets
 *     into responses the agent can read),
 *   - any referenced `secretId` MUST be owned by the SAME agent.
 * Plus the shared gates: identifier-shaped name + project scope + a fail-closed
 * deterministic `scanText` over every submitted text field + an authored-by audit
 * trail. A name collision is rejected unless the existing row was authored by the
 * SAME agent, in which case the submission is a version-update.
 *
 * Never throws — returns a structured `{ ok, status, ... }` so a caller (an
 * executor post-run loop) can process many submissions without one aborting the
 * rest. The HTTP endpoint maps the result to a response.
 */
export const authorAgentEndpointCore = async (
  db: TDatabase,
  input: TAuthorEndpointInput
): Promise<TAuthorEndpointResult> => {
  const { orgId, projectId, agentId } = input
  const name = (input.name ?? ``).trim()
  const path = (input.path ?? ``).trim()
  const description = (input.description ?? ``).trim()
  const type = (input.type ?? EEndpointType.proxy).trim()
  const options = (input.options ?? {}) as Record<string, unknown>
  const headers = input.headers

  if (!name) return { ok: false, status: 400, error: `name is required` }
  if (name.length > MaxEndpointNameChars)
    return {
      ok: false,
      status: 400,
      error: `name must be at most ${MaxEndpointNameChars} characters`,
    }
  if (!EndpointNamePattern.test(name))
    return {
      ok: false,
      status: 400,
      error: `name must be identifier-shaped (letters, digits, _ or -, starting with a letter)`,
    }
  if (!path) return { ok: false, status: 400, error: `path is required` }
  if (path.length > MaxEndpointPathChars)
    return {
      ok: false,
      status: 400,
      error: `path must be at most ${MaxEndpointPathChars} characters`,
    }
  if (description.length > MaxAuthorDescriptionChars)
    return {
      ok: false,
      status: 400,
      error: `description must be at most ${MaxAuthorDescriptionChars} characters`,
    }

  // An agent may ONLY author proxy endpoints — faas/agent endpoints reach
  // internal compute + other agents and are out of the self-extension surface.
  if (type !== EEndpointType.proxy)
    return {
      ok: false,
      status: 400,
      error: `type must be "${EEndpointType.proxy}"`,
    }

  if (!options || typeof options !== `object` || Array.isArray(options))
    return { ok: false, status: 400, error: `options must be an object` }

  const url = typeof options.url === `string` ? options.url.trim() : ``
  if (!url)
    return {
      ok: false,
      status: 400,
      error: `options.url is required for a proxy endpoint`,
    }

  // SSRF egress guard AT AUTHOR TIME — reject internal/private/metadata URLs
  // BEFORE the row is stored, so a poisoned target never persists.
  try {
    await assertSafeEgressUrl(url)
  } catch (err) {
    const message =
      err instanceof Exception ? err.message : `options.url failed the egress guard`
    return { ok: false, status: 400, error: message }
  }

  // Refuse secret injection into responses — that path templates decrypted
  // secrets into a body the agent (which drives + reads the request) can see.
  const transform = options.transform as { injectSecrets?: unknown } | undefined
  if (transform && transform.injectSecrets)
    return {
      ok: false,
      status: 400,
      error: `options.transform.injectSecrets is not permitted for an agent-authored endpoint`,
    }

  const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
  if (agentErr) return { ok: false, status: 500, error: agentErr.message }
  if (!agent) return { ok: false, status: 404, error: `Agent not found` }
  if (agent.orgId !== orgId)
    return { ok: false, status: 403, error: `Agent does not belong to this organization` }
  if (!agent.projects?.some((project) => project.id === projectId))
    return { ok: false, status: 403, error: `Agent is not bound to this project` }

  // Every referenced secret MUST exist AND be owned by THIS agent — an agent may
  // not aim its endpoint at another owner's secret.
  for (const secretId of collectSecretIds(
    options,
    input.headers as Record<string, unknown> | null | undefined
  )) {
    const { data: secret, error: secretErr } = await db.services.secret.get(secretId)
    if (secretErr) return { ok: false, status: 500, error: secretErr.message }
    if (!secret)
      return {
        ok: false,
        status: 400,
        error: `Referenced secret "${secretId}" does not exist`,
      }
    if (secret.agentId !== agentId)
      return {
        ok: false,
        status: 403,
        error: `Referenced secret "${secretId}" is not owned by this agent`,
      }
  }

  // Fail-closed deterministic scan over EVERY submitted text field, BEFORE any
  // row exists. Secret references are stripped from the scanned options so a
  // legitimate `{{ NAME:secretId }}` template is not itself flagged. A rejected
  // submission can rephrase and resubmit.
  const scannedOptions = JSON.stringify(options).replace(SecretRefPattern, ``)
  const scannedHeaders = input.headers
    ? JSON.stringify(input.headers).replace(SecretRefPattern, ``)
    : ``
  const scan = scanText(
    [name, description, scannedOptions, scannedHeaders, path].join(`\n`)
  )
  if (!scan.passed)
    return {
      ok: false,
      status: 422,
      error: `authorEndpoint rejected by security scan: ${scan.findings.join(`; `)}`,
    }

  const { data: existingRows, error: listErr } = await db.services.endpoint.list({
    where: { projectId, name },
  })
  if (listErr) return { ok: false, status: 500, error: listErr.message }
  const existing = existingRows?.[0]

  if (existing) {
    // Collision gate: only the ORIGINAL author may evolve its own Endpoint — a
    // human-authored or other-agent row is never silently overwritten.
    if (existing.meta?.authoredBy !== agentId)
      return {
        ok: false,
        status: 409,
        error: `An endpoint named "${name}" already exists in this project and was not authored by this agent`,
      }

    const version =
      (typeof existing.meta?.version === `number` ? existing.meta.version : 1) + 1
    const { data: updated, error: updateErr } = await db.services.endpoint.update({
      id: existing.id,
      name,
      path,
      type: EEndpointType.proxy,
      projectId,
      options: options as TProxyEndpointConfig,
      ...(headers && { headers }),
      meta: { ...existing.meta, authoredBy: agentId, version },
    })
    if (updateErr || !updated)
      return {
        ok: false,
        status: 500,
        error: updateErr?.message ?? `Failed to update endpoint`,
      }

    return { ok: true, status: 200, endpoint: updated }
  }

  const created = new EndpointRecord<EEndpointType.proxy>({
    name,
    path,
    type: EEndpointType.proxy,
    projectId,
    method: DefaultAuthorEndpointMethod,
    options: options as TProxyEndpointConfig,
    ...(headers && { headers }),
    meta: { authoredBy: agentId, version: 1 },
  })
  const { data: row, error: createErr } = await db.services.endpoint.create(created)
  if (createErr || !row)
    return {
      ok: false,
      status: 500,
      error: createErr?.message ?? `Failed to create endpoint`,
    }

  return { ok: true, status: 201, endpoint: row }
}
