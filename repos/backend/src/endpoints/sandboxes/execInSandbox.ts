/**
 * SECURITY NOTE: sandbox.exec() uses the Kubernetes Exec API
 * (@kubernetes/client-node k8s.Exec) via KubeClient.runInPod().
 * It does NOT use child_process on the host. Commands execute inside the pod via sh -c.
 */
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const execInSandbox: TEndpointConfig = {
  path: `/:id/exec`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { command, args, instanceId } = req.body

    if (!command || typeof command !== `string`)
      throw new Exception(400, `command is required and must be a string`)
    if (command.length > 2048) throw new Exception(400, `command exceeds maximum length`)
    if (!instanceId || typeof instanceId !== `string`)
      throw new Exception(400, `instanceId is required and must be a string`)
    if (args !== undefined) {
      if (!Array.isArray(args)) throw new Exception(400, `args must be an array`)
      if (args.length > 64) throw new Exception(400, `too many args`)
      for (const arg of args) {
        if (typeof arg !== `string`) throw new Exception(400, `each arg must be a string`)
        if (arg.length > 1024 * 1024)
          throw new Exception(400, `arg exceeds maximum length`)
      }
    }

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)
    const sbInstance = await sb.getSandbox(instanceId)
    const result = await sbInstance.exec(command, args)

    res.status(200).json({ data: result })
  },
}
