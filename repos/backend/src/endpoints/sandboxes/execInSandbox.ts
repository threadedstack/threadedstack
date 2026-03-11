/**
 * SECURITY NOTE: sandbox.exec() uses the Kubernetes Exec API
 * (@kubernetes/client-node k8s.Exec) via KubeClient.runInPod().
 * It does NOT use child_process on the host. Commands execute inside the pod via sh -c.
 */
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const execInSandbox: TEndpointConfig = {
  path: `/:id/exec`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { command, args, podName } = req.body

    if (!command) throw new Exception(400, `command is required`)
    if (!podName) throw new Exception(400, `podName is required`)

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (sb) => ({ orgId: sb.orgId })
    )

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validatePodOwnership(podName, sandbox.orgId)
    const sbInstance = await sb.getSandbox(podName)
    const result = await sbInstance.exec(command, args)

    res.status(200).json({ data: result })
  },
}
