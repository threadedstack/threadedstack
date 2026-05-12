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

    if (!command) throw new Exception(400, `command is required`)
    if (!instanceId) throw new Exception(400, `instanceId is required`)

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)
    const sbInstance = await sb.getSandbox(instanceId)
    const result = await sbInstance.exec(command, args)

    res.status(200).json({ data: result })
  },
}
