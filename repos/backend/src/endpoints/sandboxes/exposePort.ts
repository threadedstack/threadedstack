import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EShellMsg, EPermAction, EPermResource, EProto } from '@tdsk/domain'

export const exposePort: TEndpointConfig = {
  path: `/:id/ports`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { instanceId, port, protocol } = req.body

    if (!instanceId || typeof instanceId !== `string`)
      throw new Exception(400, `instanceId is required`)
    if (typeof port !== `number` || !Number.isInteger(port))
      throw new Exception(400, `port must be an integer`)

    const proto = protocol || EProto.http
    if (proto !== EProto.http && proto !== EProto.https)
      throw new Exception(400, `protocol must be "http" or "https"`)

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)
    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)

    const entry = await sb.exposePort(instanceId, port, proto)
    if (!entry) throw new Exception(404, `Instance not found in route map`)

    const subdomain = req.app.locals.kube?.findSubdomainByInstance(instanceId)
    const url = subdomain ? sb.buildPortUrl(subdomain, port) : undefined

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

    res.status(200).json({
      data: { port, protocol: proto, url },
    })
  },
}
