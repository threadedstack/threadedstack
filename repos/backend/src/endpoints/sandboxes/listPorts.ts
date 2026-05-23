import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const listPorts: TEndpointConfig = {
  path: `/:id/ports`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const instanceId = req.query.instanceId as string

    if (!instanceId) throw new Exception(400, `instanceId query param is required`)

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)
    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)

    const exposed = sb.getExposedPorts(instanceId) || {}
    const detected = await sb.scanPorts(instanceId)

    const exposedSet = new Set(Object.keys(exposed).map(Number))
    const filteredDetected = detected.filter((d) => !exposedSet.has(d.port))

    const subdomain = req.app.locals.kube?.findSubdomainByInstance(instanceId)
    const portUrlTemplate = subdomain ? sb.buildPortUrlTemplate(subdomain) : undefined

    res.status(200).json({
      data: {
        exposed,
        instanceId,
        portUrlTemplate,
        detected: filteredDetected,
      },
    })
  },
}
