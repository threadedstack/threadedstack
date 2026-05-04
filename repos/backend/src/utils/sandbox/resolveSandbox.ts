import type { Sandbox } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { Exception, SandboxIdPrefix } from '@tdsk/domain'

export const resolveSandbox = async (
  service: TDatabase[`services`][`sandbox`],
  idOrAlias: string,
  projectId?: string
): Promise<Sandbox> => {
  if (idOrAlias.startsWith(SandboxIdPrefix)) {
    const { data, error } = await service.get(idOrAlias)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Sandbox not found`)
    return data
  }

  if (!projectId)
    throw new Exception(400, `projectId is required when connecting by sandbox alias`)

  const { data, error } = await service.getByProjectAlias(projectId, idOrAlias)
  if (error) throw new Exception(500, error.message)
  if (!data) throw new Exception(404, `Sandbox not found`)
  return data
}
