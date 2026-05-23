import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { Exception, EShellMsg, EPermAction, EPermResource } from '@tdsk/domain'
import {
  buildFileCommand,
  validateFileChange,
  isMutatingOp,
} from '@TBE/utils/sandbox/fileCommands'

export const fileOperation: TEndpointConfig = {
  path: `/:id/file`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.exec, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { fileChange, instanceId } = req.body

    if (!instanceId || typeof instanceId !== `string`)
      throw new Exception(400, `instanceId is required and must be a string`)

    if (!fileChange || typeof fileChange !== `object`)
      throw new Exception(400, `fileChange is required`)

    validateFileChange(fileChange)

    const sandbox = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const sb = req.app.locals.sandbox
    if (!sb) throw new Exception(503, `Sandbox service not available`)

    await sb.validateInstanceOwnership(instanceId, sandbox.orgId, req.params.projectId)

    const sbInstance = await sb.getSandbox(instanceId)
    const { command, args } = buildFileCommand(fileChange)

    // sbInstance.exec runs commands inside the K8s pod via the Kubernetes
    // Exec API (KubeClient.runInPod). It does NOT use child_process on the host.
    const result = await sbInstance.exec(command, args)

    res.status(200).json({ data: result })

    try {
      if (isMutatingOp(fileChange.op) && result.exitCode === 0) {
        const entryType = `entryType` in fileChange ? fileChange.entryType : `file`
        sb.broadcastFileTreeChange(
          {
            entryType,
            instanceId,
            sandboxId: id,
            path: fileChange.path,
            changeType: fileChange.op,
            type: EShellMsg.FileTreeChanged,
          },
          req.user?.id
        )
      }
    } catch (err) {
      logger.warn(`[FileOp] broadcast failed:`, (err as Error).message)
    }
  },
}
