import type { TDatabase } from '@tdsk/database'

import { Exception } from '@tdsk/domain'
import { isStr } from '@keg-hub/jsutils/isStr'

/**
 * Validates that an agent environment's sandboxId references a sandbox owned by
 * the agent's org. Without this check, `agent.environment.sandboxId` is written
 * verbatim and later consumed by `startPod` (which fetches the sandbox by id
 * alone), opening a cross-org sandbox IDOR.
 *
 * No-op when the environment has no sandboxId. Throws 400 when the sandbox does
 * not exist, 403 when it belongs to a different org.
 */
export const requireOrgSandbox = async (
  db: TDatabase,
  environment: unknown,
  orgId: string
): Promise<void> => {
  const sandboxId = (environment as Record<string, unknown> | null | undefined)?.sandboxId
  if (!isStr(sandboxId) || !sandboxId.length) return

  const { data: sandbox, error } = await db.services.sandbox.get(sandboxId)
  if (error) throw new Exception(500, error.message)
  if (!sandbox) throw new Exception(400, `Sandbox ${sandboxId} not found`)
  if (sandbox.orgId !== orgId)
    throw new Exception(
      403,
      `Sandbox ${sandboxId} does not belong to this organization`,
      `FORBIDDEN`
    )
}
