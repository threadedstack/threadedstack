import type { TDatabase } from '@tdsk/database'

import { scanText } from '@TBE/utils/agent/textScan'
import {
  Secret,
  deriveKey,
  encryptValue,
  createHashKey,
  encodeEncrypted,
  extractLastFencedBlock,
} from '@tdsk/domain'

/**
 * The structured-output fence an agent emits to store a credential IT OBTAINED
 * (e.g. an API key from signing up for a service) as its OWN encrypted Secret —
 * a JSON object or array of `{ name, value, description? }`. Mirrors the
 * `tdsk-author-function` fence so scheduled + resident agents author identically.
 */
export const AuthorSecretFence = `tdsk-author-secret`

/** One parsed author-a-Secret submission (before agent scope is applied). */
export type TAuthorSecretSubmission = {
  name: string
  value: string
  description?: string
}

/**
 * Parse the LAST ```tdsk-author-secret``` fence out of a run's stdout — a JSON
 * object or array of submissions. Entries missing a non-empty name or value are
 * dropped; a missing/malformed block yields `[]` (no-op).
 *
 * SECURITY: the parsed `value` is a real credential. It is never scanned, never
 * logged, and never returned — only encrypted at rest. This parser trims the
 * NAME and DESCRIPTION but preserves the `value` byte-for-byte (trimming a
 * credential would corrupt it).
 */
export const parseAuthorSecretBlock = (text: string): TAuthorSecretSubmission[] => {
  const block = extractLastFencedBlock(text, AuthorSecretFence)
  if (block === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return []
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]

  const out: TAuthorSecretSubmission[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== `object` || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.name !== `string` || !item.name.trim().length) continue
    if (typeof item.value !== `string` || !item.value.length) continue
    out.push({
      name: item.name.trim(),
      // Preserve the credential exactly — never trim/mutate the value.
      value: item.value,
      description:
        typeof item.description === `string` && item.description.length
          ? item.description
          : undefined,
    })
  }
  return out
}

/** Secret names identify a credential per agent — keep them reasonable. */
export const MaxSecretNameChars = 200
export const MaxAuthorSecretDescriptionChars = 2000

export type TAuthorSecretInput = {
  orgId: string
  projectId: string
  /**
   * The authoring agent. The stored Secret is scoped to this agentId (the
   * exclusive-arc owner) — agent-ownership IS the authorship marker.
   */
  agentId: string
  name: string
  /**
   * The real credential to encrypt. NEVER scanned, NEVER logged, NEVER returned.
   */
  value: string
  description?: string
}

export type TAuthorSecretResult =
  | {
      ok: true
      status: 200 | 201
      secretId: string
      name: string
      rotated: boolean
      error?: undefined
    }
  | { ok: false; status: number; error: string; secretId?: undefined }

/**
 * The single author-a-Secret core — the platform stores a credential an agent
 * OBTAINED as that agent's OWN encrypted Secret. Mirrors `authorAgentFunctionCore`
 * so every execution mode (resident endpoint + scheduled `tdsk-author-secret`
 * fence) persists through one vetted path.
 *
 * SECURITY MODEL:
 * - The Secret is scoped to `agentId` (the exclusive-arc owner) — agent ownership
 *   IS the authorship marker (no meta column needed, mirroring the schema).
 * - The credential `value` is encrypted with `deriveKey(agentId)` +
 *   `encryptValue`/`encodeEncrypted` (the exact calls createSecret uses) and is
 *   NEVER scanned, NEVER logged, and NEVER returned in the result.
 * - Only the NAME and DESCRIPTION pass through the fail-closed deterministic
 *   scan — scanning a real API key could reject a valid credential and risks
 *   surfacing it in a findings/error string.
 * - Rotation: an existing Secret with the SAME `name` AND `agentId` is UPDATED
 *   (the encrypted value is rotated) rather than erroring. A name already owned
 *   by a DIFFERENT owner (org/project/provider/other-agent) is rejected 409.
 *
 * Never throws — returns a structured `{ ok, status, ... }` so a post-run loop
 * can process many submissions without one aborting the rest.
 */
export const authorAgentSecretCore = async (
  db: TDatabase,
  input: TAuthorSecretInput
): Promise<TAuthorSecretResult> => {
  const { orgId, projectId, agentId } = input
  const name = (input.name ?? ``).trim()
  const value = input.value ?? ``
  const description = (input.description ?? ``).trim()

  if (!name) return { ok: false, status: 400, error: `name is required` }
  if (name.length > MaxSecretNameChars)
    return {
      ok: false,
      status: 400,
      error: `name must be at most ${MaxSecretNameChars} characters`,
    }
  if (description.length > MaxAuthorSecretDescriptionChars)
    return {
      ok: false,
      status: 400,
      error: `description must be at most ${MaxAuthorSecretDescriptionChars} characters`,
    }
  // The value is a real credential — presence is validated, but its CONTENT is
  // never inspected, never scanned, never echoed into any error message.
  if (!value.length) return { ok: false, status: 400, error: `value is required` }

  const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
  if (agentErr) return { ok: false, status: 500, error: agentErr.message }
  if (!agent) return { ok: false, status: 404, error: `Agent not found` }
  if (agent.orgId !== orgId)
    return { ok: false, status: 403, error: `Agent does not belong to this organization` }
  if (!agent.projects?.some((project) => project.id === projectId))
    return { ok: false, status: 403, error: `Agent is not bound to this project` }

  // Fail-closed deterministic scan over ONLY the NAME + DESCRIPTION — NEVER the
  // value. The value is a real credential: scanning it could reject a valid key
  // (e.g. a token matching the literal-credential rule) and risks leaking it via
  // a findings string. A rejected name/description can rephrase and resubmit.
  const scan = scanText([name, description].join(`\n`))
  if (!scan.passed)
    return {
      ok: false,
      status: 422,
      error: `authorSecret rejected by security scan: ${scan.findings.join(`; `)}`,
    }

  // Collision/rotation lookup by (agentId, name): a match owned by THIS agent is
  // a rotation; a name owned by a different owner surfaces via createHashKey and
  // the exclusive-arc check below.
  const { data: existingRows, error: listErr } = await db.services.secret.list({
    where: { agentId, name },
  })
  if (listErr) return { ok: false, status: 500, error: listErr.message }
  const existing = existingRows?.[0]

  let derivedKey: Buffer
  let encryptedValue: string
  let hashKey: string
  try {
    // Encrypt under the agent's own key ref (agentId) — the exact createSecret
    // pipeline. The plaintext `value` lives only in these locals; nothing else
    // ever reads it.
    derivedKey = await deriveKey(agentId)
    const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
    encryptedValue = encodeEncrypted(iv, authTag, encrypted)
    hashKey = createHashKey(name)
  } catch (err) {
    // Never surface the value in an error — report only that encryption failed.
    const message = err instanceof Error ? err.message : `Failed to encrypt secret`
    return { ok: false, status: 500, error: message }
  }

  if (existing) {
    // Same agent + same name ⇒ rotate the encrypted value in place.
    const { data: updated, error: updateErr } = await db.services.secret.update({
      id: existing.id,
      name,
      hashKey,
      encryptedValue,
      description: description || existing.description,
    })
    if (updateErr || !updated)
      return {
        ok: false,
        status: 500,
        error: updateErr?.message ?? `Failed to update secret`,
      }

    return { ok: true, status: 200, secretId: updated.id, name, rotated: true }
  }

  // No agent-owned row with this name. Guard against a name already owned by a
  // DIFFERENT owner (org/project/provider/another agent) — such a name is not
  // this agent's to author, so reject 409 rather than minting a duplicate.
  const { data: nameRows, error: nameErr } = await db.services.secret.list({
    where: { name },
  })
  if (nameErr) return { ok: false, status: 500, error: nameErr.message }
  const foreign = (nameRows ?? []).find((row) => row.agentId !== agentId)
  if (foreign)
    return {
      ok: false,
      status: 409,
      error: `A secret named "${name}" already exists and is not owned by this agent`,
    }

  const secret = new Secret({
    name,
    hashKey,
    encryptedValue,
    agentId,
    description: description || undefined,
  })
  const { data: row, error: createErr } = await db.services.secret.create(secret)
  if (createErr || !row)
    return {
      ok: false,
      status: 500,
      error: createErr?.message ?? `Failed to create secret`,
    }

  return { ok: true, status: 201, secretId: row.id, name, rotated: false }
}
