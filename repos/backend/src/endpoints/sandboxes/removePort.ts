import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { toNum } from '@keg-hub/jsutils/toNum'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EShellMsg, EPermAction, EPermResource } from '@tdsk/domain'

export const removePort: TEndpointConfig = {
  path: `/:id/ports/:port`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const portNum = toNum(req.params.port)
    const instanceId = (req.body.instanceId || req.query.instanceId) as string

    if (!instanceId) throw new Exception(400, `instanceId is required`)
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)
      throw new Exception(400, `Invalid port number`)

    const sandbox = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )
    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)

    const removed = await sb.removePort(instanceId, portNum)
    if (!removed)
      throw new Exception(404, `Port ${portNum} is not exposed on this instance`)

    const exposed = sb.getExposedPorts(instanceId) || {}
    const detected = await sb.scanPorts(instanceId)
    const exposedSet = new Set(Object.keys(exposed).map(Number))

    sb.broadcastPortsChanged({
      exposed,
      instanceId,
      sandboxId: sandbox.id,
      type: EShellMsg.PortsChanged,
      detected: detected.filter((d) => !exposedSet.has(d.port)),
    })

    res.status(200).json({ data: { success: true } })
  },
}
