import type { Response } from 'express'
import type { TReqHandler } from '@tdsk/domain'
import type { TEndpointBuilder, TRequest } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { scanText } from '@TBE/utils/agent/textScan'
import { residentAuth } from '@TBE/middleware/residentAuth'
import {
  Exception,
  adminPath,
  EFunLanguage,
  Function as FunctionModel,
} from '@tdsk/domain'

/** Function names dispatch by exact name — keep them identifier-shaped. */
export const FunctionNamePattern = /^[A-Za-z][A-Za-z0-9_-]*$/
export const MaxFunctionNameChars = 100
export const MaxAuthorDescriptionChars = 2000
export const MaxAuthorContentChars = 100_000

/**
 * POST /_/orgs/:orgId/projects/:projectId/agents/:agentId/author-function
 *
 * The self-extension fast path (spec §5.1): a resident submits
 * `{ name, description, language, content }` and the platform manufactures a
 * project-scoped Function from it — isolate-bound by construction (V8 sandbox,
 * records-only bridge, no fs/net, secrets never present). This is a SECOND
 * resident-authenticated endpoint rather than a Function because a Function
 * body is records-only — it cannot create `functions` rows.
 *
 * Safety = scan + isolate + project scope + allowlist audit trail, not human
 * review: every submitted text field runs through the fail-closed
 * deterministic scanner (`scanText` — the same engine behind `context.scan`)
 * BEFORE any row is written; execution still requires the agent to add the
 * name to its OWN allowlist via `updateResidentConfig`. Provenance is stamped
 * in the row's `meta` (`{ authoredBy, version }`): a name collision is a 409
 * unless the existing row was authored by the SAME agent, in which case the
 * submission is a version-update (content/description/language replaced,
 * `meta.version` bumped).
 */
export const authorAgentFunction = async (
  req: TRequest,
  res: Response
): Promise<void> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params

  const body = (req.body ?? {}) as Record<string, unknown>
  const name = typeof body.name === `string` ? body.name.trim() : ``
  const content = typeof body.content === `string` ? body.content : ``
  const description = typeof body.description === `string` ? body.description.trim() : ``
  const language = body.language

  if (!name) throw new Exception(400, `name is required`)
  if (name.length > MaxFunctionNameChars)
    throw new Exception(400, `name must be at most ${MaxFunctionNameChars} characters`)
  if (!FunctionNamePattern.test(name))
    throw new Exception(
      400,
      `name must be identifier-shaped (letters, digits, _ or -, starting with a letter)`
    )
  if (description.length > MaxAuthorDescriptionChars)
    throw new Exception(
      400,
      `description must be at most ${MaxAuthorDescriptionChars} characters`
    )
  if (!content.trim().length) throw new Exception(400, `content is required`)
  if (content.length > MaxAuthorContentChars)
    throw new Exception(
      400,
      `content must be at most ${MaxAuthorContentChars} characters`
    )
  const languages = Object.values(EFunLanguage) as string[]
  if (typeof language !== `string` || !languages.includes(language))
    throw new Exception(400, `language must be one of: ${languages.join(`, `)}`)

  const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
  if (agentErr) throw new Exception(500, agentErr.message)
  if (!agent) throw new Exception(404, `Agent not found`)
  if (agent.orgId !== orgId)
    throw new Exception(403, `Agent does not belong to this organization`)
  if (!agent.projects?.some((project) => project.id === projectId))
    throw new Exception(403, `Agent is not bound to this project`)

  // Fail-closed deterministic scan over EVERY submitted text field, BEFORE
  // any row exists. A rejected submission can rephrase and resubmit.
  const scan = scanText([name, description, content].join(`\n`))
  if (!scan.passed)
    throw new Exception(
      422,
      `authorFunction rejected by security scan: ${scan.findings.join(`; `)}`
    )

  const { data: existingRows, error: listErr } = await db.services.function.list({
    where: { projectId, name },
  })
  if (listErr) throw new Exception(500, listErr.message)
  const existing = existingRows?.[0]

  if (existing) {
    // Collision gate: only the ORIGINAL author may evolve its own Function —
    // a human-authored or other-agent row is never silently overwritten.
    if (existing.meta?.authoredBy !== agentId)
      throw new Exception(
        409,
        `A function named "${name}" already exists in this project and was not authored by this agent`
      )

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
      throw new Exception(500, updateErr?.message ?? `Failed to update function`)

    res.status(200).json({ data: updated })
    return
  }

  const model = new FunctionModel({
    name,
    content,
    language,
    projectId,
    description: description || undefined,
    meta: { authoredBy: agentId, version: 1 },
  })
  const { data: created, error: createErr } = await db.services.function.create(model)
  if (createErr || !created)
    throw new Exception(500, createErr?.message ?? `Failed to create function`)

  res.status(201).json({ data: created })
}

/**
 * Top-level registration (sibling of `residentDispatch`, NOT nested under
 * `accounts`) so the resident token can authenticate without a
 * proxy-forwarded user. Registered before `accounts` for the same reason as
 * dispatch, with its own json parser and the same residentAuth gate — the
 * key must be resident-bound to exactly the `:agentId` in the URL.
 */
export const residentAuthorFunction: TEndpointBuilder = (app) => ({
  method: EPMethod.Post,
  path: `${adminPath(app.locals.config.server)}/orgs/:orgId/projects/:projectId/agents/:agentId/author-function`,
  middleware: [express.json() as unknown as TReqHandler<TRequest>, residentAuth],
  action: authorAgentFunction,
})
