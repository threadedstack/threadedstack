import type { Response } from 'express'
import type { TDBApiRes } from '@TDB/types'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { Exception } from '@TBE/utils/errors/exception'
import type { Domain } from '@tdsk/domain'
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

    if (!domain) throw new Exception(400, `Domain parameter is required`)

    // Get the domain first to check permissions
    const { data: record, error } = await db.services.domain.by({ domain })
    if (error) throw new Exception(404, error?.message || `Domain "${domain}" not found!`)

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

    const updateResult = await db.services.domain.update(
      cleanColl({
        id: record.id,
        verified,
        sslEnabled,
        sslExpiresAt,
        sslPrivateKey,
        sslCertificate,
      })
    )

    if (updateResult.error)
      throw new Exception(
        400,
        updateResult.error?.message || `Only verification status can be updated`
      )

    // Type guard: if there's no error, data must exist
    const data = (updateResult as TDBApiRes<Domain>).data

    res.status(200).json({ data })
  },
}
