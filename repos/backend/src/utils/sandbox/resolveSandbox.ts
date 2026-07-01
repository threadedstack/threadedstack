import type { Sandbox } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { Exception, SandboxIdPrefix } from '@tdsk/domain'

/**
 * Resolve a sandbox by id or project alias.
 *
 * When `orgId` is provided, the resolved sandbox MUST belong to that org or a
 * 403 is thrown. This closes a cross-org IDOR: `service.get(id)` fetches by id
 * alone, so without this check a caller scoped to orgA could read/mutate/delete
 * a `sb_*` id owned by orgB. Every callsite passes `req.params.orgId` (the
 * URL's org, which `authorize` already validated membership against).
 */
export const resolveSandbox = async (
  service: TDatabase[`services`][`sandbox`],
  idOrAlias: string,
  projectId?: string,
  orgId?: string
): Promise<Sandbox> => {
  const enforceOrg = (sandbox: Sandbox): Sandbox => {
    if (orgId && sandbox.orgId !== orgId)
      throw new Exception(
        403,
        `Sandbox does not belong to this organization`,
        `FORBIDDEN`
      )
    return sandbox
  }

  if (idOrAlias.startsWith(SandboxIdPrefix)) {
    const { data, error } = await service.get(idOrAlias)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Sandbox not found`)
    return enforceOrg(data)
  }

  if (!projectId)
    throw new Exception(400, `projectId is required when connecting by sandbox alias`)

  const { data, error } = await service.getByProjectAlias(projectId, idOrAlias)
  if (error) throw new Exception(500, error.message)
  if (!data) throw new Exception(404, `Sandbox not found`)
  return enforceOrg(data)
}
