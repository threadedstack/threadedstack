import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:sandboxId/config - Get sandbox project-level config overrides
 * Returns the sandboxProjects row for the given sandbox+project pair
 */
export const getSandboxProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Get the sandbox to check permissions
    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    // Check read permission on the sandbox's org
    await checkPermission(req, EPermAction.read, EPermResource.sandbox, {
      orgId: sandbox.orgId,
    })

    const { data: config, error } = await db.services.sandbox.getProjectConfig(
      sandboxId,
      projectId
    )

    if (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const status = msg.includes('not linked') ? 404 : 500
      throw new Exception(status, msg)
    }

    res.status(200).json({ data: config })
  },
}

/**
 * PUT /:sandboxId/config - Upsert sandbox project-level config overrides
 * Updates override columns on the sandboxProjects row
 * Returns the full effective sandbox config
 */
export const upsertSandboxProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Validate the sandbox exists and get org info
    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    // Check update permission on the sandbox's org
    await checkPermission(req, EPermAction.update, EPermResource.sandbox, {
      orgId: sandbox.orgId,
    })

    const { alias, enabled, config } = req.body

    const overrides = Object.fromEntries(
      Object.entries({ alias, enabled, config }).filter(([, v]) => v !== undefined)
    )

    const { error: upsertError } = await db.services.sandbox.upsertProjectConfig(
      sandboxId,
      projectId,
      overrides
    )

    if (upsertError) {
      const msg = upsertError instanceof Error ? upsertError.message : String(upsertError)
      const status = msg.includes('not linked') ? 404 : 500
      throw new Exception(status, msg)
    }

    // Re-fetch the sandbox to get updated projectConfigs and return effective config
    const { data: updatedSandbox, error: refetchError } =
      await db.services.sandbox.get(sandboxId)
    if (refetchError || !updatedSandbox)
      throw new Exception(500, `Failed to fetch updated sandbox`)

    const effectiveSandbox = updatedSandbox.getEffectiveConfig(projectId)

    res.status(200).json({ data: effectiveSandbox })
  },
}

/**
 * DELETE /:sandboxId/config - Reset sandbox project-level config overrides
 * Resets all override columns to null (enabled back to true)
 */
export const deleteSandboxProjectConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Validate the sandbox exists
    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    // Check update permission on the sandbox's org
    await checkPermission(req, EPermAction.update, EPermResource.sandbox, {
      orgId: sandbox.orgId,
    })

    // Reset all override columns to null
    const { error } = await db.services.sandbox.upsertProjectConfig(
      sandboxId,
      projectId,
      {
        alias: null,
        enabled: true,
        config: null,
      }
    )

    if (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const status = msg.includes('not linked') ? 404 : 500
      throw new Exception(status, msg)
    }

    res.status(200).json({ data: { id: sandboxId, configReset: true } })
  },
}
