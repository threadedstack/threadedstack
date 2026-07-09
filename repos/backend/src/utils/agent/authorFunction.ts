import type { TDatabase } from '@tdsk/database'

import { scanText } from '@TBE/utils/agent/textScan'
import { EFunLanguage, Function as FnRecord, extractLastFencedBlock } from '@tdsk/domain'

/**
 * The structured-output fence an agent emits to build its OWN tool — a JSON
 * object or array of `{ name, description?, language?, content }`. Mirrors the
 * resident runtime's fence so scheduled + resident agents author identically.
 */
export const AuthorFunctionFence = `tdsk-author-function`

/** One parsed author-a-Function submission (before org/project/agent scope is applied). */
export type TAuthorFunctionSubmission = {
  name: string
  content: string
  language?: string
  description?: string
}

/**
 * Parse the LAST ```tdsk-author-function``` fence out of a run's stdout — a JSON
 * object or array of submissions. Entries missing a non-empty name or content
 * are dropped; a missing/malformed block yields `[]` (no-op).
 */
export const parseAuthorFunctionBlock = (text: string): TAuthorFunctionSubmission[] => {
  const block = extractLastFencedBlock(text, AuthorFunctionFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]

  const out: TAuthorFunctionSubmission[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== `object` || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== `string` || !item.name.trim().length) continue
    if (typeof item.content !== `string` || !item.content.trim().length) continue
    out.push({
      name: item.name.trim(),
      content: item.content,
      language:
        typeof item.language === `string` && item.language.length
          ? item.language
          : undefined,
      description:
        typeof item.description === `string` && item.description.length
          ? item.description
          : undefined,
    })
  }
  return out
}

/** Function names dispatch by exact name — keep them identifier-shaped. */
export const FunctionNamePattern = /^[A-Za-z][A-Za-z0-9_-]*$/
export const MaxFunctionNameChars = 100
export const MaxAuthorDescriptionChars = 2000
export const MaxAuthorContentChars = 100_000
/** Default language when an author-function submission omits one. */
export const DefaultAuthorLanguage = EFunLanguage.javascript

export type TAuthorFunctionInput = {
  orgId: string
  projectId: string
  /** The authoring agent — stamped as `meta.authoredBy` and the invoke-time authorization key. */
  agentId: string
  name: string
  content: string
  description?: string
  /** One of EFunLanguage; defaults to javascript when omitted. */
  language?: string
}

export type TAuthorFunctionResult =
  | { ok: true; status: 200 | 201; fn: FnRecord; error?: undefined }
  | { ok: false; status: number; error: string; fn?: undefined }

/**
 * The single author-a-Function core — the platform manufactures a project-scoped
 * Function from an agent submission `{ name, description?, language?, content }`.
 * Isolate-bound by construction (V8 sandbox, records-only bridge, no fs/net,
 * secrets never present). Shared by BOTH the resident `author-function` endpoint
 * AND the scheduled executor's `tdsk-author-function` fence, so every execution
 * mode authors through one vetted path.
 *
 * Safety = fail-closed deterministic scan (the same engine behind `context.scan`)
 * over every submitted text field BEFORE any row is written + project scope +
 * an authored-by audit trail. Provenance is stamped in `meta` (`{ authoredBy,
 * version }`); a name collision is rejected unless the existing row was authored
 * by the SAME agent, in which case the submission is a version-update.
 *
 * Never throws — returns a structured `{ ok, status, ... }` so a caller (an
 * executor post-run loop) can process many submissions without one aborting the
 * rest. The HTTP endpoint maps the result to a response.
 */
export const authorAgentFunctionCore = async (
  db: TDatabase,
  input: TAuthorFunctionInput
): Promise<TAuthorFunctionResult> => {
  const { orgId, projectId, agentId } = input
  const name = (input.name ?? ``).trim()
  const content = input.content ?? ``
  const description = (input.description ?? ``).trim()
  const language = input.language ?? DefaultAuthorLanguage

  if (!name) return { ok: false, status: 400, error: `name is required` }
  if (name.length > MaxFunctionNameChars)
    return {
      ok: false,
      status: 400,
      error: `name must be at most ${MaxFunctionNameChars} characters`,
    }
  if (!FunctionNamePattern.test(name))
    return {
      ok: false,
      status: 400,
      error: `name must be identifier-shaped (letters, digits, _ or -, starting with a letter)`,
    }
  if (description.length > MaxAuthorDescriptionChars)
    return {
      ok: false,
      status: 400,
      error: `description must be at most ${MaxAuthorDescriptionChars} characters`,
    }
  if (!content.trim().length)
    return { ok: false, status: 400, error: `content is required` }
  if (content.length > MaxAuthorContentChars)
    return {
      ok: false,
      status: 400,
      error: `content must be at most ${MaxAuthorContentChars} characters`,
    }
  const languages = Object.values(EFunLanguage) as string[]
  if (!languages.includes(language))
    return {
      ok: false,
      status: 400,
      error: `language must be one of: ${languages.join(`, `)}`,
    }

  const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
  if (agentErr) return { ok: false, status: 500, error: agentErr.message }
  if (!agent) return { ok: false, status: 404, error: `Agent not found` }
  if (agent.orgId !== orgId)
    return { ok: false, status: 403, error: `Agent does not belong to this organization` }
  if (!agent.projects?.some((project) => project.id === projectId))
    return { ok: false, status: 403, error: `Agent is not bound to this project` }

  // Fail-closed deterministic scan over EVERY submitted text field, BEFORE any
  // row exists. A rejected submission can rephrase and resubmit.
  const scan = scanText([name, description, content].join(`\n`))
  if (!scan.passed)
    return {
      ok: false,
      status: 422,
      error: `authorFunction rejected by security scan: ${scan.findings.join(`; `)}`,
    }

  const { data: existingRows, error: listErr } = await db.services.function.list({
    where: { projectId, name },
  })
  if (listErr) return { ok: false, status: 500, error: listErr.message }
  const existing = existingRows?.[0]

  if (existing) {
    // Collision gate: only the ORIGINAL author may evolve its own Function — a
    // human-authored or other-agent row is never silently overwritten.
    if (existing.meta?.authoredBy !== agentId)
      return {
        ok: false,
        status: 409,
        error: `A function named "${name}" already exists in this project and was not authored by this agent`,
      }

    const version =
      (typeof existing.meta?.version === `number` ? existing.meta.version : 1) + 1
    const { data: updated, error: updateErr } = await db.services.function.update({
      id: existing.id,
      name,
      content,
      language,
      projectId,
      description: description || existing.description,
      meta: { ...existing.meta, authoredBy: agentId, version },
    })
    if (updateErr || !updated)
      return { ok: false, status: 500, error: updateErr?.message ?? `Failed to update function` }

    return { ok: true, status: 200, fn: updated }
  }

  const created = new FnRecord({
    name,
    content,
    language,
    projectId,
    description: description || undefined,
    meta: { authoredBy: agentId, version: 1 },
  })
  const { data: row, error: createErr } = await db.services.function.create(created)
  if (createErr || !row)
    return { ok: false, status: 500, error: createErr?.message ?? `Failed to create function` }

  return { ok: true, status: 201, fn: row }
}
