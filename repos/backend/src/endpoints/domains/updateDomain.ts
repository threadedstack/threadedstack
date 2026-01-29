import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PATCH /domains/:domain - Update a domain
 * Currently limited to verification status
 * User must have permission to update the domain's org or project
 */
export const updateDomain: TEndpointConfig = {
  path: `/:domain`,
  method: EPMethod.Patch,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { domain } = req.params
    const {
      verified,
      // For manually uploaded SSL certificates
      sslEnabled,
      sslExpiresAt,
      sslPrivateKey,
      sslCertificate,
    } = req.body

    if (!domain) {
      res.status(400).json({ error: `Domain parameter is required` })
      return
    }

    // Get the domain first to check permissions
    const { data: record, error } = await db.services.domain.by({ domain })

    if (error) {
      res.status(404).json({ error: error?.message || `Domain "${domain}" not found!` })
      return
    }

    // Check permission
    if (record.orgId) {
      await checkPermission(req, EPermAction.update, EPermResource.domain, {
        orgId: record.orgId,
      })
    } else if (record.projectId) {
      // Get project to find orgId
      const { data: project } = await db.services.project.get(record.projectId)
      if (project) {
        await checkPermission(req, EPermAction.update, EPermResource.domain, {
          orgId: project.orgId,
        })
      }
    }

    const { data, error: uperr } = await db.services.domain.update(
      cleanColl({
        id: record.id,
        verified,
        sslEnabled,
        sslExpiresAt,
        sslPrivateKey,
        sslCertificate,
      })
    )

    uperr
      ? res
          .status(400)
          .json({ error: uperr?.message || `Only verification status can be updated` })
      : res.status(200).json({ data })
  },
}
