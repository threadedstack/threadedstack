import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TKubeSandboxConfig } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { logger } from '@TDB/utils/logger'
import { ERoleType, Exception, Sandbox, SandboxPresets } from '@tdsk/domain'

/**
 * POST /orgs - Create a new org
 * Any authenticated user can create an org
 * Creator is automatically assigned 'owner' role
 */
export const createOrg: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, config } = req.app.locals
    const orgData = req.body
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    if (!orgData || !orgData.name) throw new Exception(400, `Org name is required`)

    const { data, error } = await db.services.org.create({
      ...orgData,
      ownerId: userId,
    })

    if (error) throw new Exception(500, error.message)

    // Automatically add user creator as owner
    if (data?.id) {
      const { error: roleError } = await db.services.role.create({
        userId,
        orgId: data.id,
        type: ERoleType.owner,
      })

      if (roleError) {
        logger.error(`Failed to assign owner role:`, roleError)
        await db.services.org.delete(data.id)
        throw new Exception(500, `Failed to assign owner role to organization`)
      }
    }

    // Seed default sandbox configs for the new org
    const seedFailures: string[] = []
    const presetEntries = Object.values(SandboxPresets)
    for (const preset of presetEntries) {
      const sandbox = new Sandbox({
        builtIn: true,
        orgId: data.id,
        name: preset.name,
        config: { image: config.sandbox.image, ...preset.config } as TKubeSandboxConfig,
      })

      const { error: seedError } = await db.services.sandbox.create(sandbox)
      if (seedError) {
        logger.warn(
          `Failed to seed sandbox "${preset.name}" for org ${data.id}:`,
          seedError
        )
        seedFailures.push(preset.name)
      }
    }

    const orgWithRole = { ...data, userRole: ERoleType.owner }

    if (seedFailures.length) {
      res.status(201).json({
        data: orgWithRole,
        warnings: [`Failed to seed default sandboxes: ${seedFailures.join(`, `)}`],
      })
      return
    }

    res.status(201).json({ data: orgWithRole })
  },
}
