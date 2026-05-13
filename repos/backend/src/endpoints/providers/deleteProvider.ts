import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

const MaxNames = 3

const formatNames = (names: string[]) => {
  if (names.length <= MaxNames) return names.join(`, `)
  return `${names.slice(0, MaxNames).join(`, `)}, and ${names.length - MaxNames} more`
}

const buildRefMessage = (
  providerName: string,
  sandboxNames: string[],
  projectNames: string[]
) => {
  const parts: string[] = []

  if (sandboxNames.length)
    parts.push(
      `${sandboxNames.length} sandbox${sandboxNames.length > 1 ? `es` : ``} (${formatNames(sandboxNames)})`
    )

  if (projectNames.length)
    parts.push(
      `${projectNames.length} project${projectNames.length > 1 ? `s` : ``} (${formatNames(projectNames)})`
    )

  return `Cannot delete provider "${providerName}" — it is used by ${parts.join(` and `)}. Remove the provider from these first.`
}

/**
 * DELETE /providers/:id - Delete a provider
 * Requires admin+ role in the provider's org
 */
export const deleteProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.provider)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.provider.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Provider not found`)

    const refs = await db.services.provider.checkReferences(id)

    const sandboxMap = new Map<string, string>()
    for (const sb of refs.sandboxes) sandboxMap.set(sb.id, sb.name || sb.id)
    for (const sp of refs.sandboxProjects)
      if (!sandboxMap.has(sp.sandbox.id))
        sandboxMap.set(sp.sandbox.id, sp.sandbox.name || sp.sandbox.id)

    const projectMap = new Map<string, string>()
    for (const proj of refs.projects) projectMap.set(proj.id, proj.name || proj.id)
    for (const sp of refs.sandboxProjects)
      if (!projectMap.has(sp.project.id))
        projectMap.set(sp.project.id, sp.project.name || sp.project.id)

    if (sandboxMap.size || projectMap.size)
      throw new Exception(
        409,
        buildRefMessage(
          existing.name || id,
          [...sandboxMap.values()],
          [...projectMap.values()]
        )
      )

    const { error, status } = await db.services.provider.delete(id)
    if (error) throw new Exception(status || 500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}
